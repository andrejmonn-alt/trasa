import { readFileSync } from 'fs';
import { importGtfs } from '../www/js/core/gtfs.js';
import { buildNetwork, searchGroups } from '../www/js/core/network.js';
import { plan, fmtTime } from '../www/js/core/router.js';
const ab = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const net = buildNetwork([await importGtfs(ab('/home/claude/html/vilnius.zip'), { id: 'vilnius', kind: 'city', filter: 'none' }),
  await importGtfs(ab('/home/claude/vrap/vrap.zip'), { id: 'vrap', kind: 'regional', filter: 'none' })]);
const run = (title, a, b, d, t, n=8) => {
  const pick = q => q === 'miskiniai' ? searchGroups(net, q).find(g => net.stopFeed[g.stops[0]] === 1) : searchGroups(net, q)[0]; const A = pick(a), B = pick(b);
  console.log('\n== ' + title + ': ' + A.name + ' → ' + B.name);
  for (const j of plan(net, d, t, A.stops.map(s=>({stop:s,walk:0})), B.stops.map(s=>({stop:s,walk:0})), {buffer:120, count:n, windowH: 20}))
    console.log(' ', fmtTime(j.leave), '→', fmtTime(j.arrive), j.legs.filter(l=>l.type==='ride').map(l => `${net.routeShort[net.tripRoute[l.trip]]} ${fmtTime(l.dep)}`).join(' → '), net.tripHead[j.legs.filter(l=>l.type==='ride').pop().trip]);
};
run('Пн', 'dworzec', 'miskiniai', new Date(2026,10,16), 5*3600);
run('Сб', 'dworzec', 'miskiniai', new Date(2026,10,21), 5*3600);
run('Вс', 'dworzec', 'miskiniai', new Date(2026,10,22), 5*3600);
run('Пн обратно', 'miskiniai', 'dworzec', new Date(2026,10,16), 5*3600);
console.log(searchGroups(net, 'miskini').map(g => g.name + ' [' + (net.stopFeed[g.stops[0]] ? 'VRAP' : 'город') + '] ' + g.lat.toFixed(3)));
