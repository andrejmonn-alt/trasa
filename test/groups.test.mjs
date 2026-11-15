import { readFileSync } from 'fs';
import { importGtfs } from '../www/js/core/gtfs.js';
import { buildNetwork, searchGroups } from '../www/js/core/network.js';
const ab = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const net = buildNetwork([await importGtfs(ab('/home/claude/html/vilnius.zip'), { id: 'vilnius', kind: 'city', filter: 'none' }),
  await importGtfs(ab('/home/claude/vrap/vrap.zip'), { id: 'vrap', kind: 'regional', filter: 'none' }),
  await importGtfs(ab('/home/claude/sv/svencionys.zip'), { id: 'svtxt', kind: 'regional', filter: 'none' })]);
for (const q of ['miskin', 'pailge', 'niemenczyn', 'raudondvaris', 'girinink'])
  console.log(q, searchGroups(net, q, 10).map(g => `${g.name} [${g.stops.map(s => net.feeds[net.stopFeed[s]]).join(',')}] ${g.lat.toFixed(3)},${g.lon.toFixed(3)}`));
