import { readFileSync } from 'fs';
import { importGtfs } from '../www/js/core/gtfs.js';
import { buildNetwork, searchGroups } from '../www/js/core/network.js';
import { plan, fmtTime } from '../www/js/core/router.js';
import { distM } from '../www/js/core/gtfs.js';
const ab = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const net = buildNetwork([await importGtfs(ab('/home/claude/html/vilnius.zip'), { id: 'vilnius', kind: 'city', filter: 'none' }),
  await importGtfs(ab('/home/claude/vrap/vrap.zip'), { id: 'vrap', kind: 'regional', filter: 'none' }),
  await importGtfs(ab('/home/claude/sv/svencionys.zip'), { id: 'svtxt', kind: 'regional', filter: 'none' })]);
const A = searchGroups(net, 'nemencines plentas')[0], B = searchGroups(net, 'miskiniai').find(g => net.stopFeed[g.stops[0]] === 1);
for (const d of [16, 21, 22]) {
  console.log('\n== 2026-11-' + d, A.name, '→', B.name);
  for (const j of plan(net, new Date(2026,10,d), 5*3600, A.stops.map(s=>({stop:s,walk:0})), B.stops.map(s=>({stop:s,walk:0})), {buffer:60, count:10, windowH: 19}))
    console.log(' ', fmtTime(j.leave), '→', fmtTime(j.arrive), j.legs.map(l => l.type==='ride' ? `${net.routeShort[net.tripRoute[l.trip]] || net.routeName[net.tripRoute[l.trip]]} ${fmtTime(l.dep)}` : 'пешком ' + Math.round(l.dur/60)).join(' → '));
}
