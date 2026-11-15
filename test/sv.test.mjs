import { readFileSync } from 'fs';
import { importGtfs } from '../www/js/core/gtfs.js';
import { buildNetwork, searchGroups } from '../www/js/core/network.js';
import { plan, fmtTime } from '../www/js/core/router.js';
const ab = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const feeds = [await importGtfs(ab('/home/claude/html/vilnius.zip'), { id: 'vilnius', kind: 'city', filter: 'none' }),
  await importGtfs(ab('/home/claude/vrap/vrap.zip'), { id: 'vrap', kind: 'regional', filter: 'none' }),
  await importGtfs(ab('/home/claude/sv/svencionys.zip'), { id: 'sven', kind: 'regional', filter: 'none' })];
console.log(feeds[2].counts, feeds[2].dateRange);
const net = buildNetwork(feeds);
const show = (title, a, b, d, t) => {
  const A = searchGroups(net, a)[0], B = searchGroups(net, b)[0];
  console.log('\n== ' + title + ': ' + A.name + ' → ' + B.name);
  for (const j of plan(net, d, t, A.stops.map(s=>({stop:s,walk:0})), B.stops.map(s=>({stop:s,walk:0})), {buffer:120, count:3}))
    console.log(' ', fmtTime(j.leave), '→', fmtTime(j.arrive), j.legs.map(l => l.type==='ride' ? `[${net.routeShort[net.tripRoute[l.trip]]||net.routeName[net.tripRoute[l.trip]]} ${fmtTime(l.dep)} ${net.name[net.stStop[l.i0]]}→${net.name[net.stStop[l.i1]]} ${fmtTime(l.arr)}]` : `walk${Math.round(l.dur/60)}`).join(' '));
};
show('Пн', 'kalvariju turgus', 'svencionys', new Date(2026,10,16), 9*3600);
show('Сб', 'pabrade', 'dworzec', new Date(2026,10,21), 7*3600);
show('Пн', 'dworzec', 'pailge', new Date(2026,10,16), 10*3600);
