// Где сейчас автобусы — по расписанию (без GPS): интерполяция между остановками.
import { serviceActive } from './gtfs.js';

// Список рейсов дня: [trip, shift, start, end] * N. Учитывает рейсы вчерашнего дня после полуночи.
export function dayIndex(net, midnight) {
  const items = [];
  for (const dOff of [-1, 0]) {
    const day = new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate() + dOff, 12);
    const act = net.services.map(s => serviceActive(s, day));
    const shift = dOff * 86400;
    for (let t = 0; t < net.nTrips; t++) {
      if (!act[net.tripSvc[t]]) continue;
      const a = net.tripOff[t], b = net.tripOff[t + 1];
      const s = net.stDep[a] + shift, e = net.stArr[b - 1] + shift;
      if (e < 0) continue;
      items.push(t, shift, s, e);
    }
  }
  return Int32Array.from(items);
}

// Позиция рейса в момент now (секунды от полуночи, можно дробные)
export function vehiclePos(net, t, shift, now) {
  const a = net.tripOff[t], b = net.tripOff[t + 1];
  if (now < net.stDep[a] + shift || now > net.stArr[b - 1] + shift) return null;
  let lo = a, hi = b - 1; // последний i, где dep[i] <= now
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (net.stDep[m] + shift <= now) lo = m; else hi = m - 1; }
  const i = lo;
  if (i >= b - 1) { const s = net.stStop[b - 1]; return { lat: net.lat[s], lon: net.lon[s], at: b - 1, next: b - 1, nextArr: net.stArr[b - 1] + shift, end: true }; }
  const ta = net.stDep[i] + shift, tb = net.stArr[i + 1] + shift;
  const s1 = net.stStop[i], s2 = net.stStop[i + 1];
  if (now >= tb) return { lat: net.lat[s2], lon: net.lon[s2], at: i + 1, next: i + 1, nextArr: tb, dwell: true };
  const f = tb > ta ? (now - ta) / (tb - ta) : 1;
  return { lat: net.lat[s1] + (net.lat[s2] - net.lat[s1]) * f, lon: net.lon[s1] + (net.lon[s2] - net.lon[s1]) * f, at: i, next: i + 1, nextArr: tb };
}

export function activeVehicles(net, idx, now) {
  const out = [];
  for (let k = 0; k < idx.length; k += 4) {
    if (idx[k + 2] > now || idx[k + 3] < now) continue;
    const p = vehiclePos(net, idx[k], idx[k + 1], now);
    if (p) { p.trip = idx[k]; p.shift = idx[k + 1]; out.push(p); }
  }
  return out;
}

// Найти рейс по сохранённому описанию поездки (индексы меняются после обновления данных)
export function findTrip(net, ride) {
  for (let t = 0; t < net.nTrips; t++) {
    const r = net.tripRoute[t];
    if (net.routeName[r] !== ride.route && net.routeShort[r] !== ride.short) continue;
    for (let i = net.tripOff[t]; i < net.tripOff[t + 1]; i++) {
      if (net.ltName[net.stStop[i]] !== ride.from) continue;
      for (const shift of [0, -86400, 86400]) if (net.stDep[i] + shift === ride.dep) return { trip: t, shift, i0: i };
    }
  }
  return null;
}
