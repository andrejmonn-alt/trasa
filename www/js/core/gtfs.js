// Импорт GTFS-архива в компактную структуру (типизированные массивы).
import { listZip, textStream, hasFile } from './zip.js';
import { parseCsvStream, parseTime } from './csv.js';
import { inCounty } from './region.js';

export const REGION = { lat: 54.687, lon: 25.28 }; // центр Вильнюса

export function distM(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

class IntBuf {
  constructor(n = 1 << 16) { this.a = new Int32Array(n); this.n = 0; }
  push(v) { if (this.n === this.a.length) { const b = new Int32Array(this.a.length * 2); b.set(this.a); this.a = b; } this.a[this.n++] = v; }
  done() { return this.a.slice(0, this.n); }
}

function isRail(type) { return type === 2 || (type >= 100 && type < 200); }
function isTrolley(type, r) {
  if (type === 11 || type === 800) return true;
  const s = ((r.route_id || '') + ' ' + (r.route_desc || '')).toLowerCase();
  return /trol/.test(s);
}

export function routeCategory(feedKind, type, r) {
  if (isRail(type)) return 'train';
  if (feedKind === 'city') {
    if (isTrolley(type, r)) return 'trolley';
    if (/^\d+\s*G$/i.test((r.route_short_name || '').trim())) return 'express';
    return 'bus';
  }
  return 'intercity';
}

// feed: {id, kind:'city'|'regional', filter:'none'|'region'|'rail', radiusKm}
export async function importGtfs(buf, feed, progress = () => {}) {
  const zip = listZip(buf);
  for (const f of ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'])
    if (!hasFile(zip, f)) throw new Error('В архиве нет ' + f);
  const radius = (feed.radiusKm || 40) * 1000;
  const col = (row, idx, name) => { const i = idx[name]; return i === undefined ? '' : (row[i] || ''); };

  // --- stops
  progress('Остановки…');
  const sId = [], sName = [], sLat = [], sLon = [], stopMap = new Map();
  await parseCsvStream(textStream(zip, 'stops.txt'), (r, x) => {
    const id = col(r, x, 'stop_id');
    stopMap.set(id, sId.length);
    sId.push(id); sName.push(col(r, x, 'stop_name').trim());
    sLat.push(+col(r, x, 'stop_lat')); sLon.push(+col(r, x, 'stop_lon'));
  });
  const inRegion = sLat.map((la, i) => inCounty(la, sLon[i])); // Вильнюсский край = бывший Вильнюсский уезд

  // --- routes
  progress('Линии…');
  const routes = { id: [], short: [], long: [], cat: [], type: [] }, routeMap = new Map();
  await parseCsvStream(textStream(zip, 'routes.txt'), (r, x) => {
    const o = {}; for (const k in x) o[k] = r[x[k]];
    const type = +(o.route_type || 3);
    routeMap.set(o.route_id, routes.id.length);
    routes.id.push(o.route_id);
    routes.short.push((o.route_short_name || '').trim());
    routes.long.push((o.route_long_name || '').trim());
    routes.type.push(type);
    routes.cat.push(routeCategory(feed.kind, type, o));
  });

  // --- trips
  progress('Рейсы…');
  const tRoute = [], tSvc = [], tHead = [], tShape = [], tDir = [], tGid = [], tripMap = new Map();
  const svcMap = new Map(), svcIds = [];
  await parseCsvStream(textStream(zip, 'trips.txt'), (r, x) => {
    const ri = routeMap.get(col(r, x, 'route_id'));
    if (ri === undefined) return;
    if (feed.filter === 'rail' && routes.cat[ri] !== 'train') return;
    const sid = col(r, x, 'service_id');
    if (!svcMap.has(sid)) { svcMap.set(sid, svcIds.length); svcIds.push(sid); }
    tripMap.set(col(r, x, 'trip_id'), tRoute.length); tGid.push(feed.kind === 'city' ? col(r, x, 'trip_id') : '');
    tRoute.push(ri); tSvc.push(svcMap.get(sid));
    tHead.push(col(r, x, 'trip_headsign').trim());
    tShape.push(col(r, x, 'shape_id')); tDir.push(+(col(r, x, 'direction_id') || 0));
  });

  // --- calendar
  const services = svcIds.map(() => ({ days: [0, 0, 0, 0, 0, 0, 0], start: 0, end: 0, add: [], rem: [] }));
  if (hasFile(zip, 'calendar.txt')) {
    const dn = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    await parseCsvStream(textStream(zip, 'calendar.txt'), (r, x) => {
      const si = svcMap.get(col(r, x, 'service_id')); if (si === undefined) return;
      const s = services[si];
      s.days = dn.map(d => +col(r, x, d) || 0);
      s.start = +col(r, x, 'start_date'); s.end = +col(r, x, 'end_date');
    });
  }
  if (hasFile(zip, 'calendar_dates.txt')) {
    await parseCsvStream(textStream(zip, 'calendar_dates.txt'), (r, x) => {
      const si = svcMap.get(col(r, x, 'service_id')); if (si === undefined) return;
      const d = +col(r, x, 'date'), t = col(r, x, 'exception_type');
      if (t === '1') services[si].add.push(d); else if (t === '2') services[si].rem.push(d);
    });
  }

  // --- stop_times (самый большой файл)
  progress('Расписание (stop_times)…');
  const bT = new IntBuf(1 << 18), bSeq = new IntBuf(1 << 18), bStop = new IntBuf(1 << 18),
    bArr = new IntBuf(1 << 18), bDep = new IntBuf(1 << 18);
  let rowsSeen = 0;
  await parseCsvStream(textStream(zip, 'stop_times.txt'), (r, x) => {
    const ti = tripMap.get(r[x.trip_id]); if (ti === undefined) return;
    const si = stopMap.get(r[x.stop_id]); if (si === undefined) return;
    bT.push(ti); bSeq.push(+r[x.stop_sequence]); bStop.push(si);
    bArr.push(parseTime(r[x.arrival_time])); bDep.push(parseTime(r[x.departure_time]));
  }, chars => { if (++rowsSeen % 20 === 0) progress('Расписание: ' + Math.round(chars / 1e6) + ' млн симв.'); });

  const nT = tRoute.length, N = bT.n;
  const T = bT.a, SEQ = bSeq.a, STOP = bStop.a, ARR = bArr.a, DEP = bDep.a;
  // корзинная сортировка по рейсу, затем по stop_sequence
  const cnt = new Int32Array(nT + 1);
  for (let i = 0; i < N; i++) cnt[T[i] + 1]++;
  for (let i = 0; i < nT; i++) cnt[i + 1] += cnt[i];
  const pos = cnt.slice(), order = new Int32Array(N);
  for (let i = 0; i < N; i++) order[pos[T[i]]++] = i;
  for (let t = 0; t < nT; t++) { // вставками — обычно уже отсортировано
    for (let i = cnt[t] + 1; i < cnt[t + 1]; i++) {
      const v = order[i]; let j = i - 1;
      while (j >= cnt[t] && SEQ[order[j]] > SEQ[v]) { order[j + 1] = order[j]; j--; }
      order[j + 1] = v;
    }
  }

  // фильтр рейсов: по региону
  const keepTrip = new Uint8Array(nT);
  for (let t = 0; t < nT; t++) {
    if (cnt[t + 1] - cnt[t] < 2) continue;
    if (feed.filter === 'region' || feed.filter === 'rail') {
      for (let i = cnt[t]; i < cnt[t + 1]; i++) if (inRegion[STOP[order[i]]]) { keepTrip[t] = 1; break; }
    } else keepTrip[t] = 1;
  }

  // перенумерация остановок и рейсов
  const stopNew = new Int32Array(sId.length).fill(-1);
  const out = {
    id: feed.id, kind: feed.kind, importedAt: Date.now(),
    stops: { id: [], name: [], lat: [], lon: [] },
    routes: { short: routes.short, long: routes.long, cat: routes.cat },
    services,
    trips: { route: [], service: [], headsign: [], off: [0], gid: [] },
    st: null, lines: []
  };
  const oStop = new IntBuf(N || 1), oArr = new IntBuf(N || 1), oDep = new IntBuf(N || 1);
  const tripShape = [], tripDir = [];
  for (let t = 0; t < nT; t++) {
    if (!keepTrip[t]) continue;
    const a = cnt[t], b = cnt[t + 1];
    // интерполяция пропущенных времён
    const times = [];
    for (let i = a; i < b; i++) { const k = order[i]; times.push([ARR[k], DEP[k]]); }
    for (let i = 0; i < times.length; i++) {
      if (times[i][0] < 0 && times[i][1] >= 0) times[i][0] = times[i][1];
      if (times[i][1] < 0 && times[i][0] >= 0) times[i][1] = times[i][0];
    }
    let ok = times[0][1] >= 0 && times[times.length - 1][0] >= 0;
    if (!ok) continue;
    for (let i = 1; i < times.length - 1; i++) {
      if (times[i][0] >= 0) continue;
      let j = i; while (times[j][0] < 0) j++;
      const p = times[i - 1][1], q = times[j][0];
      for (let k = i; k < j; k++) { const v = Math.round(p + (q - p) * (k - i + 1) / (j - i + 1)); times[k] = [v, v]; }
    }
    for (let i = a; i < b; i++) {
      const s = STOP[order[i]];
      if (stopNew[s] < 0) {
        stopNew[s] = out.stops.id.length;
        out.stops.id.push(sId[s]); out.stops.name.push(sName[s]);
        out.stops.lat.push(sLat[s]); out.stops.lon.push(sLon[s]);
      }
      oStop.push(stopNew[s]); oArr.push(times[i - a][0]); oDep.push(times[i - a][1]);
    }
    out.trips.route.push(tRoute[t]); out.trips.service.push(tSvc[t]);
    out.trips.headsign.push(tHead[t]); out.trips.off.push(oStop.n); out.trips.gid.push(tGid[t]);
    tripShape.push(tShape[t]); tripDir.push(tDir[t]);
  }
  out.st = { stop: oStop.done(), arr: oArr.done(), dep: oDep.done() };
  out.trips.route = Int32Array.from(out.trips.route);
  out.trips.service = Int32Array.from(out.trips.service);
  out.trips.off = Int32Array.from(out.trips.off);
  out.stops.lat = Float64Array.from(out.stops.lat);
  out.stops.lon = Float64Array.from(out.stops.lon);

  // --- линии для карты: по одному самому длинному рейсу на (линия, направление)
  progress('Линии для карты…');
  const rep = new Map();
  for (let t = 0; t < out.trips.route.length; t++) {
    const key = out.trips.route[t] + ':' + tripDir[t];
    const len = out.trips.off[t + 1] - out.trips.off[t];
    const cur = rep.get(key);
    if (!cur || len > cur.len) rep.set(key, { t, len });
  }
  const needShapes = new Map();
  for (const { t } of rep.values()) if (tripShape[t]) needShapes.set(tripShape[t], []);
  if (needShapes.size && hasFile(zip, 'shapes.txt')) {
    await parseCsvStream(textStream(zip, 'shapes.txt'), (r, x) => {
      const arr = needShapes.get(r[x.shape_id]); if (!arr) return;
      arr.push([+r[x.shape_pt_sequence], +r[x.shape_pt_lat], +r[x.shape_pt_lon]]);
    });
  }
  for (const { t } of rep.values()) {
    let pts = needShapes.get(tripShape[t]);
    let coords;
    if (pts && pts.length > 1) {
      pts.sort((p, q) => p[0] - q[0]);
      coords = new Float32Array(pts.length * 2);
      pts.forEach((p, i) => { coords[2 * i] = p[1]; coords[2 * i + 1] = p[2]; });
    } else {
      const a = out.trips.off[t], b = out.trips.off[t + 1];
      coords = new Float32Array((b - a) * 2);
      for (let i = a; i < b; i++) { const s = out.st.stop[i]; coords[2 * (i - a)] = out.stops.lat[s]; coords[2 * (i - a) + 1] = out.stops.lon[s]; }
    }
    out.lines.push({ route: out.trips.route[t], cat: routes.cat[out.trips.route[t]], coords });
  }

  // диапазон дат
  let minD = 99999999, maxD = 0;
  for (const s of services) {
    if (s.start) minD = Math.min(minD, s.start); if (s.end) maxD = Math.max(maxD, s.end);
    for (const d of s.add) { minD = Math.min(minD, d); maxD = Math.max(maxD, d); }
  }
  out.dateRange = [minD === 99999999 ? 0 : minD, maxD];
  out.counts = { stops: out.stops.id.length, trips: out.trips.route.length, stopTimes: out.st.stop.length, routes: new Set(out.trips.route).size };
  progress('Готово');
  return out;
}

// ---- календарь
export function ymd(date) { return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate(); }
export function serviceActive(s, dateObj) {
  const d = ymd(dateObj);
  if (s.rem.includes(d)) return false;
  if (s.add.includes(d)) return true;
  if (!s.start || d < s.start || d > s.end) return false;
  const wd = (dateObj.getDay() + 6) % 7; // 0 = понедельник
  return !!s.days[wd];
}
