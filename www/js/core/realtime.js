// Реальное время Вильнюса: GPS-поток stops.lt (gps_full.txt), привязка к рейсам GTFS,
// опоздания и заторы. Без зависимостей от DOM — можно проверять тестами.
import { distM } from './gtfs.js';

export const GPS_URL = 'https://www.stops.lt/vilnius/gps_full.txt';

// Разбор CSV. Координаты — целые * 1e6, MatavimoLaikas — секунды от полуночи.
export function parseGps(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const h = lines[0].split(',').map(x => x.trim()), ix = n => h.indexOf(n);
  const I = { type: ix('Transportas'), route: ix('Marsrutas'), veh: ix('MasinosNumeris'), lon: ix('Ilguma'), lat: ix('Platuma'),
    speed: ix('Greitis'), az: ix('Azimutas'), start: ix('ReisoPradziaMinutemis'), dev: ix('NuokrypisSekundemis'),
    t: ix('MatavimoLaikas'), head: ix('KryptiesPavadinimas'), gid: ix('ReisoIdGTFS') };
  if (I.lat < 0 || I.lon < 0 || I.route < 0) return [];
  const num = (c, k) => (k >= 0 && c[k] !== undefined && c[k] !== '') ? +c[k] : null;
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    let lat = num(c, I.lat), lon = num(c, I.lon);
    if (lat === null || lon === null) continue;
    if (Math.abs(lat) > 1000) { lat /= 1e6; lon /= 1e6; }
    if (lat < 53.8 || lat > 56.5 || lon < 20.9 || lon > 26.9) continue;
    out.push({ type: c[I.type] || '', route: (c[I.route] || '').trim(), veh: (c[I.veh] || '').trim(), lat, lon,
      speed: num(c, I.speed) || 0, az: num(c, I.az), start: num(c, I.start), dev: num(c, I.dev), t: num(c, I.t),
      head: I.head >= 0 ? (c[I.head] || '').trim() : '', gid: I.gid >= 0 ? (c[I.gid] || '').trim() : '' });
  }
  return out;
}

function gidIndex(net) {
  if (net._gid) return net._gid;
  const m = new Map(), byStart = new Map();
  for (let t = 0; t < net.nTrips; t++) {
    const g = net.tripGid && net.tripGid[t]; if (g) m.set(g, t);
    const r = net.tripRoute[t]; if (net.routeFeed && net.feeds[net.routeFeed[r]] !== 'vilnius') continue;
    const k = net.routeShort[r] + '|' + Math.round(net.stDep[net.tripOff[t]] / 60);
    let a = byStart.get(k); if (!a) byStart.set(k, a = []); a.push(t);
  }
  return (net._gid = { m, byStart });
}

// Проекция точки на рейс: ближайший участок → расписанное время в этой точке.
export function project(net, t, shift, lat, lon, hint) {
  const a = net.tripOff[t], b = net.tripOff[t + 1];
  const kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540;
  let best = null;
  for (let i = a; i < b - 1; i++) {
    const s1 = net.stStop[i], s2 = net.stStop[i + 1];
    const x1 = (net.lon[s1] - lon) * kx, y1 = (net.lat[s1] - lat) * ky, x2 = (net.lon[s2] - lon) * kx, y2 = (net.lat[s2] - lat) * ky;
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    let f = L2 > 0 ? -(x1 * dx + y1 * dy) / L2 : 0; f = Math.max(0, Math.min(1, f));
    const px = x1 + f * dx, py = y1 + f * dy, d = Math.sqrt(px * px + py * py);
    if (d > 300) continue;
    // расписанное «окно» для этой точки
    let lo, hi;
    if (f < 0.06) { lo = net.stArr[i]; hi = net.stDep[i]; }
    else if (f > 0.94) { lo = net.stArr[i + 1]; hi = net.stDep[i + 1]; }
    else lo = hi = net.stDep[i] + f * (net.stArr[i + 1] - net.stDep[i]);
    lo += shift; hi += shift;
    const sched = hint < lo ? lo : hint > hi ? hi : hint;
    const score = d + Math.abs(hint - sched) / 6; // 1 мин ≈ 10 м
    if (!best || score < best.score) best = { i, f, d, lo, hi, score };
  }
  return best;
}

// Привязать GPS-машины к рейсам; вернуть Map trip -> состояние
export function matchVehicles(net, gps, nowSec) {
  const G = gidIndex(net);
  const res = new Map();
  for (const v of gps) {
    let t = v.gid ? G.m.get(v.gid) : undefined;
    if (t === undefined && v.start !== null) {
      const c = G.byStart.get(v.route + '|' + v.start);
      if (c && c.length === 1) t = c[0];
      else if (c && c.length > 1) { // несколько направлений — ближайший
        let bd = 1e9; for (const x of c) { const p = project(net, x, 0, v.lat, v.lon, v.t ?? nowSec); if (p && p.d < bd) { bd = p.d; t = x; } }
      }
    }
    if (t === undefined) continue;
    const meas = v.t !== null ? v.t : nowSec;
    // смена суток: рейс мог начаться «вчера» (после полуночи)
    const st0 = net.stDep[net.tripOff[t]];
    const shift = st0 - meas > 12 * 3600 ? -86400 : meas - st0 > 20 * 3600 ? 86400 : 0;
    if (meas < st0 + shift - 600) continue; // ещё не вышел на рейс (стоит в парке)
    const hint = meas - (v.dev || 0);
    const p = project(net, t, shift, v.lat, v.lon, hint);
    let delay, i;
    if (p) {
      delay = meas < p.lo ? meas - p.lo : meas > p.hi ? meas - p.hi : 0;
      i = p.i;
    } else {
      if (v.speed === 0 && v.dev === null) continue; // стоит в парке
      delay = v.dev || 0; i = -1;
    }
    delay = Math.max(-900, Math.min(3600, Math.round(delay)));
    res.set(t, { trip: t, shift, lat: v.lat, lon: v.lon, delay, seg: i, f: p ? p.f : 0, speed: v.speed, az: v.az,
      meas, age: Math.max(0, nowSec - meas), veh: v.veh, onRoute: !!p });
  }
  return res;
}

// ---------- заторы: рост опоздания машины за последние минуты на одном участке
export class JamTracker {
  constructor() { this.hist = new Map(); }
  update(net, matched, nowSec) {
    for (const m of matched.values()) {
      if (!m.onRoute || m.age > 120) continue;
      const key = m.veh || m.trip;
      let h = this.hist.get(key);
      if (!h || h.trip !== m.trip) this.hist.set(key, h = { trip: m.trip, pts: [] });
      const last = h.pts[h.pts.length - 1];
      if (!last || last.meas !== m.meas) h.pts.push({ meas: m.meas, delay: m.delay, seg: m.seg, speed: m.speed });
      while (h.pts.length && m.meas - h.pts[0].meas > 900) h.pts.shift();
    }
    for (const [k, h] of this.hist) { const l = h.pts[h.pts.length - 1]; if (!l || nowSec - l.meas > 900) this.hist.delete(k); }
  }
  // Участки (по названиям остановок «A>B») с потерями времени
  jams(net) {
    const seg = new Map();
    for (const h of this.hist.values()) {
      const p = h.pts; if (p.length < 3) continue;
      const last = p[p.length - 1];
      let first = null; for (const q of p) if (last.meas - q.meas <= 360) { first = q; break; }
      if (!first || last.meas - first.meas < 120) continue;
      const grow = last.delay - first.delay;
      const slow = p.filter(q => last.meas - q.meas <= 360).reduce((a, q) => a + q.speed, 0) / Math.max(1, p.filter(q => last.meas - q.meas <= 360).length);
      if (grow < 90 || slow > 18) continue;
      // все участки, по которым прошла машина за это время
      const a = Math.max(0, Math.min(first.seg, last.seg)), b = Math.max(first.seg, last.seg);
      for (let gi = a; gi <= b && gi < net.tripOff[h.trip + 1] - 1; gi++) {
        const k = net.name[net.stStop[gi]] + '>' + net.name[net.stStop[gi + 1]];
        let s = seg.get(k); if (!s) seg.set(k, s = { key: k, from: net.name[net.stStop[gi]], to: net.name[net.stStop[gi + 1]], loss: 0, n: 0, routes: new Set() });
        s.loss = Math.max(s.loss, grow); s.n++; s.routes.add(net.routeShort[net.tripRoute[h.trip]]);
      }
    }
    return [...seg.values()].filter(s => s.loss >= 240 || (s.n >= 2 && s.loss >= 120));
  }
}
