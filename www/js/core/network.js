// Объединение нескольких импортированных фидов в одну сеть для поиска пути.
import { stopDisplayName, translatePlaces, norm } from './names.js';
import { distM } from './gtfs.js';

export const WALK_SPEED = 1.25; // м/с ≈ 4.5 км/ч
export const DETOUR = 1.3;       // коэффициент «не по прямой»
export function walkSec(m, speed = WALK_SPEED) { return Math.ceil(m * DETOUR / speed); }

export function buildNetwork(feeds, opts = {}) {
  const scope = opts.scope || 'county';
  const overrides = opts.overrides || {};
  const transferRadius = opts.transferRadius || 350;
  let nS = 0, nT = 0, nST = 0, nR = 0;
  for (const f of feeds) { nS += f.stops.id.length; nT += f.trips.route.length; nST += f.st.stop.length; nR += f.routes.short.length; }

  const net = {
    nStops: nS, lat: new Float64Array(nS), lon: new Float64Array(nS),
    ltName: new Array(nS), name: new Array(nS), stopFeed: new Int16Array(nS),
    routeShort: [], routeName: [], routeCat: [], routeFeed: [],
    tripRoute: new Int32Array(nT), tripSvc: new Int32Array(nT), tripHead: new Array(nT),
    tripOff: new Int32Array(nT + 1),
    stStop: new Int32Array(nST), stArr: new Int32Array(nST), stDep: new Int32Array(nST),
    services: [], lines: [], feeds: feeds.map(f => f.id)
  };
  let so = 0, to = 0, sto = 0, ro = 0, svo = 0;
  feeds.forEach((f, fi) => {
    const ns = f.stops.id.length;
    for (let i = 0; i < ns; i++) {
      const g = so + i, la = f.stops.lat[i], lo = f.stops.lon[i];
      net.lat[g] = la; net.lon[g] = lo; net.ltName[g] = f.stops.name[i]; net.stopFeed[g] = fi;
      net.name[g] = stopDisplayName(f.stops.name[i], la, lo, scope, overrides);
    }
    const nr = f.routes.short.length;
    for (let i = 0; i < nr; i++) {
      const sh = f.routes.short[i], lg = f.routes.long[i];
      net.routeShort.push(sh);
      net.routeCat.push(f.routes.cat[i]);
      net.routeFeed.push(fi);
      let disp;
      if (f.kind === 'city') disp = sh || translatePlaces(lg, scope);
      else disp = (lg ? translatePlaces(lg, scope) : '') || sh;
      net.routeName.push(disp);
    }
    for (const s of f.services) net.services.push(s);
    const nt = f.trips.route.length;
    for (let t = 0; t < nt; t++) {
      net.tripRoute[to + t] = ro + f.trips.route[t];
      net.tripSvc[to + t] = svo + f.trips.service[t];
      net.tripHead[to + t] = translatePlaces(f.trips.headsign[t], scope);
      net.tripOff[to + t] = sto + f.trips.off[t];
    }
    const nst = f.st.stop.length;
    for (let i = 0; i < nst; i++) {
      net.stStop[sto + i] = so + f.st.stop[i];
      net.stArr[sto + i] = f.st.arr[i]; net.stDep[sto + i] = f.st.dep[i];
    }
    for (const l of f.lines) net.lines.push({ cat: l.cat, route: ro + l.route, coords: l.coords });
    so += ns; to += nt; sto += nst; ro += nr; svo += f.services.length;
  });
  net.tripOff[nT] = nST;
  net.nTrips = nT;

  // --- пространственная сетка
  const CELL = 0.005; // ~ 550 м по широте
  net.grid = new Map();
  for (let i = 0; i < nS; i++) {
    const k = Math.floor(net.lat[i] / CELL) + ':' + Math.floor(net.lon[i] / (CELL * 1.7));
    let a = net.grid.get(k); if (!a) net.grid.set(k, a = []); a.push(i);
  }
  net.cell = CELL;

  // --- пешие пересадки (CSR)
  const fpOff = new Int32Array(nS + 1), to2 = [], dur = [];
  for (let i = 0; i < nS; i++) {
    fpOff[i] = to2.length;
    for (const j of nearby(net, net.lat[i], net.lon[i], transferRadius)) {
      if (j === i) continue;
      const d = distM(net.lat[i], net.lon[i], net.lat[j], net.lon[j]);
      if (d <= transferRadius) { to2.push(j); dur.push(walkSec(d)); }
    }
  }
  fpOff[nS] = to2.length;
  net.fpOff = fpOff; net.fpTo = Int32Array.from(to2); net.fpDur = Int32Array.from(dur);

  // --- какие линии ходят через остановку
  const sr = Array.from({ length: nS }, () => new Set());
  for (let t = 0; t < nT; t++) {
    const r = net.tripRoute[t];
    for (let i = net.tripOff[t]; i < net.tripOff[t + 1]; i++) sr[net.stStop[i]].add(r);
  }
  net.stopRoutes = sr.map(s => Array.from(s));

  // --- группы для поиска: одинаковое имя + близко (≤ 1.5 км)
  const byName = new Map();
  for (let i = 0; i < nS; i++) {
    if (!net.stopRoutes[i].length) continue;
    const k = net.name[i];
    let a = byName.get(k); if (!a) byName.set(k, a = []); a.push(i);
  }
  net.groups = [];
  for (const [nm, list] of byName) {
    const clusters = [];
    for (const s of list) {
      let c = clusters.find(c => distM(c.lat, c.lon, net.lat[s], net.lon[s]) < 1500);
      if (!c) clusters.push(c = { lat: net.lat[s], lon: net.lon[s], stops: [] });
      c.stops.push(s);
    }
    for (const c of clusters) {
      const routes = new Set(); c.stops.forEach(s => net.stopRoutes[s].forEach(r => routes.add(r)));
      net.groups.push({
        name: nm, lt: net.ltName[c.stops[0]], stops: c.stops, lat: c.lat, lon: c.lon,
        routes: Array.from(routes), key: norm(nm) + ' ' + norm(net.ltName[c.stops[0]])
      });
    }
  }
  return net;
}

export function nearby(net, lat, lon, radius) {
  const C = net.cell, cy = Math.floor(lat / C), cx = Math.floor(lon / (C * 1.7));
  const ry = Math.ceil(radius / 550) , rx = Math.ceil(radius / (550 * 1.7 * Math.cos(lat * Math.PI / 180)));
  const out = [];
  for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
    const a = net.grid.get(y + ':' + x); if (a) for (const i of a) out.push(i);
  }
  return out;
}

export function searchGroups(net, q, limit = 12) {
  const qn = norm(q); if (!qn) return [];
  const parts = qn.split(' ');
  const res = [];
  for (const g of net.groups) {
    if (parts.every(p => g.key.includes(p))) {
      const starts = norm(g.name).startsWith(qn) || norm(g.lt).startsWith(qn);
      res.push({ g, score: (starts ? 0 : 1000) + g.name.length - g.routes.length * 0.5 });
    }
  }
  res.sort((a, b) => a.score - b.score);
  return res.slice(0, limit).map(r => r.g);
}

// Точки доступа: от координаты к остановкам пешком
export function accessFromPoint(net, lat, lon, maxWalk = 1200) {
  const out = [];
  for (const s of nearby(net, lat, lon, maxWalk)) {
    const d = distM(lat, lon, net.lat[s], net.lon[s]);
    if (d <= maxWalk && net.stopRoutes[s].length) out.push({ stop: s, walk: walkSec(d), dist: Math.round(d) });
  }
  return out;
}
