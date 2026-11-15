import { readFileSync } from 'fs';
import { importGtfs } from '../www/js/core/gtfs.js';
import { buildNetwork, searchGroups } from '../www/js/core/network.js';
import { plan, fmtTime } from '../www/js/core/router.js';
const ab = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const net = buildNetwork([await importGtfs(ab('/home/claude/html/vilnius.zip'), { id: 'vilnius', kind: 'city', filter: 'none' }),
  await importGtfs(ab('/home/claude/vrap/vrap.zip'), { id: 'vrap', kind: 'regional', filter: 'none' }),
  await importGtfs(ab('/home/claude/sv/svencionys.zip'), { id: 'svtxt', kind: 'regional', filter: 'none' })]);
for (const [a, b, h] of [['niemenczyn', 'dworzec', 7], ['dworzec', 'niemenczyn', 10]]) {
  const A = searchGroups(net, a)[0], B = searchGroups(net, b)[0];
  console.log('\n==', A.name, '→', B.name);
  for (const j of plan(net, new Date(2026,10,16), h*3600, A.stops.map(s=>({stop:s,walk:0})), B.stops.map(s=>({stop:s,walk:0})), {buffer:120, count:8}))
    console.log(' ', fmtTime(j.leave), '→', fmtTime(j.arrive), j.legs.filter(l=>l.type==='ride').map(l => (net.routeShort[net.tripRoute[l.trip]] || net.routeName[net.tripRoute[l.trip]]) + ' ' + fmtTime(l.dep)).join(' → '));
}
