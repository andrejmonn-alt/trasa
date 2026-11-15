// Поиск пути по расписанию: Connection Scan Algorithm (CSA).
// Время — секунды от полуночи дня поездки (может быть > 86400 — после полуночи).
import { serviceActive } from './gtfs.js';

const INF = 0x3fffffff;

export function buildConnections(net, date, t0, tEnd) {
  const deps = [], arrs = [], trips = [], idxs = [];
  for (let dOff = -1; dOff <= 1; dOff++) {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate() + dOff, 12);
    const shift = dOff * 86400;
    const active = net.services.map(s => serviceActive(s, day));
    for (let t = 0; t < net.nTrips; t++) {
      if (!active[net.tripSvc[t]]) continue;
      const a = net.tripOff[t], b = net.tripOff[t + 1];
      if (net.stDep[a] + shift > tEnd || net.stArr[b - 1] + shift < t0) continue;
      for (let i = a; i < b - 1; i++) {
        const dep = net.stDep[i] + shift;
        if (dep < t0 || dep > tEnd) continue;
        deps.push(dep); arrs.push(net.stArr[i + 1] + shift); trips.push(t * 3 + dOff + 1); idxs.push(i);
      }
    }
  }
  const n = deps.length, key = new Float64Array(n);
  for (let i = 0; i < n; i++) key[i] = (deps[i] + 200000) * 8388608 + i; // (dep+сдвиг) * 2^23 + i
  key.sort();
  const C = { n, dep: new Int32Array(n), arr: new Int32Array(n), trip: new Int32Array(n), idx: new Int32Array(n), t0, tEnd };
  for (let k = 0; k < n; k++) {
    const i = key[k] % 8388608;
    C.dep[k] = deps[i]; C.arr[k] = arrs[i]; C.trip[k] = trips[i]; C.idx[k] = idxs[i];
  }
  return C;
}

function lowerBound(a, n, v) { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; }

// access: [{stop, walk}], egress: [{stop, walk}]
export function csa(net, C, t0, access, egress, opts = {}) {
  const buffer = opts.buffer ?? 60;
  const nS = net.nStops;
  const S = new Int32Array(nS).fill(INF), veh = new Uint8Array(nS);
  const Jk = new Uint8Array(nS), Je = new Int32Array(nS), Jx = new Int32Array(nS), Jf = new Int32Array(nS), Jd = new Int32Array(nS);
  const T = new Int32Array(net.nTrips * 3).fill(-1);
  const eg = new Map(); for (const e of egress) if (!eg.has(e.stop) || eg.get(e.stop) > e.walk) eg.set(e.stop, e.walk);
  let best = INF, bestStop = -1;
  for (const a of access) {
    const v = t0 + a.walk;
    if (v < S[a.stop]) { S[a.stop] = v; Jk[a.stop] = 1; Jd[a.stop] = a.walk; }
  }
  // пешком от стартовых остановок к соседним (напр. городская «Stotis» → автовокзал)
  for (const a of access) {
    const s0 = a.stop, base = t0 + a.walk;
    if (Jk[s0] !== 1 || S[s0] !== base) continue;
    for (let k = net.fpOff[s0]; k < net.fpOff[s0 + 1]; k++) {
      const u = net.fpTo[k], v = base + net.fpDur[k];
      if (v < S[u]) { S[u] = v; veh[u] = 0; Jk[u] = 3; Jf[u] = s0; Jd[u] = net.fpDur[k]; }
    }
  }
  // цель достижима сразу пешком (точка → точка рядом)
  for (const [s, w] of eg) if (S[s] < INF && S[s] + w < best) { best = S[s] + w; bestStop = s; }
  const relax = (s, v) => {
    if (eg.has(s)) { const w = v + eg.get(s); if (w < best) { best = w; bestStop = s; } }
  };
  for (let c = lowerBound(C.dep, C.n, t0); c < C.n; c++) {
    const dep = C.dep[c];
    if (dep >= best) break;
    const tr = C.trip[c], i = C.idx[c];
    if (T[tr] === -1) {
      const from = net.stStop[i];
      if (S[from] + (veh[from] ? buffer : 0) > dep) continue;
      T[tr] = c;
    }
    const to = net.stStop[i + 1], a = C.arr[c];
    if (a < S[to]) {
      S[to] = a; veh[to] = 1; Jk[to] = 2; Je[to] = T[tr]; Jx[to] = c;
      relax(to, a);
      for (let k = net.fpOff[to]; k < net.fpOff[to + 1]; k++) {
        const u = net.fpTo[k], v = a + net.fpDur[k] + buffer;
        if (v < S[u]) { S[u] = v; veh[u] = 0; Jk[u] = 3; Jf[u] = to; Jd[u] = net.fpDur[k]; relax(u, v); }
      }
    }
  }
  if (bestStop < 0) return null;

  // восстановление пути
  const legs = [];
  let s = bestStop, guard = 0, accessWalk = 0, originStop = -1;
  while (guard++ < 200) {
    const k = Jk[s];
    if (k === 1) { accessWalk = Jd[s]; originStop = s; break; }
    if (k === 3) { legs.unshift({ type: 'walk', from: Jf[s], to: s, dur: Jd[s] }); s = Jf[s]; continue; }
    if (k === 2) {
      const c1 = Je[s], c2 = Jx[s], tr = C.trip[c1];
      const trip = Math.floor(tr / 3), shift = (tr % 3 - 1) * 86400;
      legs.unshift({ type: 'ride', trip, shift, i0: C.idx[c1], i1: C.idx[c2] + 1, dep: C.dep[c1], arr: C.arr[c2] });
      s = net.stStop[C.idx[c1]]; continue;
    }
    return null;
  }
  const egressWalk = eg.get(bestStop) || 0;
  const rides = legs.filter(l => l.type === 'ride');
  let leave;
  if (rides.length) {
    // время до первой посадки: пешие участки до первой поездки
    let pre = accessWalk;
    for (const l of legs) { if (l.type === 'ride') break; pre += l.dur; }
    leave = rides[0].dep - pre;
  } else leave = t0;
  // время пеших пересадок
  let tcur = leave + accessWalk;
  for (const l of legs) {
    if (l.type === 'ride') tcur = l.arr;
    else { l.start = tcur; l.end = tcur + l.dur; tcur = l.end; }
  }
  return { originStop, accessWalk, legs, egressStop: bestStop, egressWalk, leave, arrive: best, transfers: Math.max(0, rides.length - 1) };
}

// CSA с учётом числа поездок (k): находит лучший приезд для 1..K поездок,
// затем выбирает вариант с меньшим числом пересадок, если он не намного позже.
export function csaK(net, C, t0, access, egress, opts = {}) {
  const K = opts.maxRides || 6, buffer = opts.buffer ?? 60, slack = opts.slack ?? 300;
  const nS = net.nStops, NT = net.nTrips * 3;
  const S = new Int32Array(nS * (K + 1)).fill(INF), veh = new Uint8Array(nS * (K + 1));
  const Jk = new Uint8Array(nS * (K + 1)), Je = new Int32Array(nS * (K + 1)), Jx = new Int32Array(nS * (K + 1)), Jf = new Int32Array(nS * (K + 1)), Jd = new Int32Array(nS * (K + 1));
  const Tk = new Int8Array(NT).fill(-1), Tc = new Int32Array(NT);
  const eg = new Map(); for (const e of egress) if (!eg.has(e.stop) || eg.get(e.stop) > e.walk) eg.set(e.stop, e.walk);
  const best = new Int32Array(K + 1).fill(INF), bestStop = new Int32Array(K + 1).fill(-1);
  const at = (k, s) => k * nS + s;
  const relaxEg = (k, s, v) => { const w = eg.get(s); if (w !== undefined && v + w < best[k]) { best[k] = v + w; bestStop[k] = s; } };
  for (const a of access) { const i = at(0, a.stop), v = t0 + a.walk; if (v < S[i]) { S[i] = v; Jk[i] = 1; Jd[i] = a.walk; } }
  for (const a of access) {
    const s0 = a.stop, base = S[at(0, s0)]; if (Jk[at(0, s0)] !== 1) continue;
    for (let q = net.fpOff[s0]; q < net.fpOff[s0 + 1]; q++) {
      const u = net.fpTo[q], v = base + net.fpDur[q], i = at(0, u);
      if (v < S[i]) { S[i] = v; veh[i] = 0; Jk[i] = 3; Jf[i] = s0; Jd[i] = net.fpDur[q]; }
    }
  }
  for (let s = 0; s < nS; s++) if (S[s] < INF) relaxEg(0, s, S[s]);
  let globalBest = best[0];
  for (let c = lowerBound(C.dep, C.n, t0); c < C.n; c++) {
    const dep = C.dep[c];
    if (dep >= globalBest + slack) break;
    const tr = C.trip[c], i = C.idx[c], from = net.stStop[i];
    // минимальное число поездок, с которым можно сесть здесь
    for (let k = 0; k < K; k++) {
      if (Tk[tr] !== -1 && Tk[tr] <= k + 1) break;
      const j = at(k, from);
      if (S[j] + (veh[j] ? buffer : 0) <= dep) { Tk[tr] = k + 1; Tc[tr] = c; break; }
    }
    if (Tk[tr] === -1) continue;
    const k = Tk[tr], to = net.stStop[i + 1], a = C.arr[c], ti = at(k, to);
    if (a < S[ti]) {
      S[ti] = a; veh[ti] = 1; Jk[ti] = 2; Je[ti] = Tc[tr]; Jx[ti] = c;
      relaxEg(k, to, a);
      for (let q = net.fpOff[to]; q < net.fpOff[to + 1]; q++) {
        const u = net.fpTo[q], v = a + net.fpDur[q] + buffer, ui = at(k, u);
        if (v < S[ui]) { S[ui] = v; veh[ui] = 0; Jk[ui] = 3; Jf[ui] = to; Jd[ui] = net.fpDur[q]; relaxEg(k, u, v); }
      }
      if (best[k] < globalBest) globalBest = best[k];
    }
  }
  // выбор: самый ранний приезд, но меньше пересадок, если не позже чем на slack
  let kBest = -1;
  for (let k = 0; k <= K; k++) if (bestStop[k] >= 0 && (kBest < 0 || best[k] < best[kBest])) kBest = k;
  if (kBest < 0) return null;
  for (let k = 0; k < kBest; k++) if (bestStop[k] >= 0 && best[k] <= best[kBest] + slack * (kBest - k)) { kBest = k; break; }
  // восстановление
  const legs = []; let s = bestStop[kBest], k = kBest, guard = 0, accessWalk = 0, originStop = -1;
  while (guard++ < 300) {
    const ii = at(k, s), kind = Jk[ii];
    if (kind === 1) { accessWalk = Jd[ii]; originStop = s; break; }
    if (kind === 3) { legs.unshift({ type: 'walk', from: Jf[ii], to: s, dur: Jd[ii] }); s = Jf[ii]; continue; }
    if (kind === 2) {
      const c1 = Je[ii], c2 = Jx[ii], tr = C.trip[c1];
      legs.unshift({ type: 'ride', trip: Math.floor(tr / 3), shift: (tr % 3 - 1) * 86400, i0: C.idx[c1], i1: C.idx[c2] + 1, dep: C.dep[c1], arr: C.arr[c2] });
      s = net.stStop[C.idx[c1]]; k--; continue;
    }
    return null;
  }
  const egressWalk = eg.get(bestStop[kBest]) || 0;
  const rides = legs.filter(l => l.type === 'ride');
  let leave = t0;
  if (rides.length) { let pre = accessWalk; for (const l of legs) { if (l.type === 'ride') break; pre += l.dur; } leave = rides[0].dep - pre; }
  let tcur = leave + accessWalk;
  for (const l of legs) { if (l.type === 'ride') tcur = l.arr; else { l.start = tcur; l.end = tcur + l.dur; tcur = l.end; } }
  return { originStop, accessWalk, legs, egressStop: bestStop[kBest], egressWalk, leave, arrive: best[kBest], transfers: Math.max(0, rides.length - 1) };
}

// несколько вариантов: следующий ищется с отправлением позже предыдущего
export function plan(net, date, t0, access, egress, opts = {}) {
  const count = opts.count || 4;
  const C = buildConnections(net, date, t0 - 3600, t0 + (opts.windowH || 14) * 3600);
  const res = []; let t = t0; const seen = new Set(); let lastArr = -1, step = 60;
  for (let k = 0; k < 60 && res.length < count; k++) {
    const j = csaK(net, C, t, access, egress, opts);
    if (!j) break;
    const sig = j.legs.filter(l => l.type === 'ride').map(l => l.trip + '@' + l.shift).join('|');
    if (!seen.has(sig)) { seen.add(sig); if (j.arrive !== lastArr) res.push(j); else res[res.length - 1] = j; }
    // тот же приезд — шагаем быстрее, чтобы найти следующий реально другой рейс
    step = j.arrive === lastArr ? Math.min(step * 2, 1800) : 60;
    lastArr = j.arrive;
    t = Math.max(j.leave, t) + step;
  }
  // если более поздний вариант приезжает так же — ранний не нужен
  let out = res.filter((j, i) => !res.some((o, k) => k > i && o.arrive <= j.arrive));
  // абсурдные крюки (намного дольше самого быстрого варианта) — убираем
  const minDur = Math.min(...out.map(j => j.arrive - j.leave));
  out = out.filter(j => j.arrive - j.leave <= minDur * 1.8 + 1200);
  return out;
}

// Остановки участка поездки
export function rideStops(net, leg) {
  const out = [];
  for (let i = leg.i0; i <= leg.i1; i++) out.push({ stop: net.stStop[i], arr: net.stArr[i] + leg.shift, dep: net.stDep[i] + leg.shift });
  return out;
}

export function fmtTime(sec) {
  let s = ((sec % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function fmtDur(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return m + ' мин';
  return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
}
