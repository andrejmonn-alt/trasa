import { readFileSync } from 'fs';
import { importGtfs } from '../www/js/core/gtfs.js';
import { buildNetwork } from '../www/js/core/network.js';
import { dayIndex, activeVehicles, findTrip } from '../www/js/core/vehicles.js';
const ab = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const net = buildNetwork([await importGtfs(ab('/home/claude/html/vilnius.zip'), { id: 'vilnius', kind: 'city', filter: 'none' }),
  await importGtfs(ab('/home/claude/vrap/vrap.zip'), { id: 'vrap', kind: 'regional', filter: 'none' })]);
const mid = new Date(2026, 10, 16);
let t0 = performance.now(); const idx = dayIndex(net, mid); console.log('index', idx.length / 4, 'trips', Math.round(performance.now() - t0), 'ms');
for (const h of [8.5, 13.25, 23.9, 24.5 - 24]) {
  t0 = performance.now(); const v = activeVehicles(net, idx, h * 3600);
  console.log('at', h, '→', v.length, 'vehicles,', (performance.now() - t0).toFixed(1), 'ms; sample:', v.slice(0, 2).map(x => `${net.routeShort[net.tripRoute[x.trip]]} ${x.lat.toFixed(4)},${x.lon.toFixed(4)} next ${net.name[net.stStop[x.next]]}`));
}
const v171 = activeVehicles(net, idx, 16.5 * 3600).filter(x => net.routeShort[net.tripRoute[x.trip]] === '171');
console.log('171 at 16:30:', v171.map(x => `${net.tripHead[x.trip]} → след. ${net.name[net.stStop[x.next]]}`));
console.log(findTrip(net, { route: net.routeName[net.tripRoute[v171[0].trip]], short: '171', from: net.ltName[net.stStop[net.tripOff[v171[0].trip]]], dep: net.stDep[net.tripOff[v171[0].trip]] }), 'expected trip', v171[0].trip);
