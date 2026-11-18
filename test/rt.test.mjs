import { readFileSync } from 'fs';
import { importGtfs } from '../www/js/core/gtfs.js';
import { buildNetwork } from '../www/js/core/network.js';
import { parseGps, matchVehicles, JamTracker } from '../www/js/core/realtime.js';
const ab = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const net = buildNetwork([await importGtfs(ab('/home/claude/html/vilnius.zip'), { id: 'vilnius', kind: 'city', filter: 'none' })]);
const txt = `Transportas,Marsrutas,ReisoID,MasinosNumeris,Ilguma,Platuma,Greitis,Azimutas,ReisoPradziaMinutemis,NuokrypisSekundemis,MatavimoLaikas,MasinosTipas,KryptiesTipas,KryptiesPavadinimas,ReisoIdGTFS,IntervalasPries,IntervalasPaskui,
Autobusai,10,,4113,25291759,54720338,0,170,,,52739,KWZ,D>A,Fabijoniškės,,,,
Troleibusai,16,27448581900,2775,25214369,54703197,0,96,1140,0,52740,KWNZ,A>D,2-asis troleibusų parkas (Justiniškių g.),,,,
Troleibusai,18,27417361845,2780,25215209,54703149,7,106,1125,0,52731,KWNZ,A>D,2-asis troleibusų parkas (Justiniškių g.),,,,
Autobusai,117,27217581438,586,25130884,54713472,43,220,878,59,52746,KWNZ,B1>A1,Pilaitė,A117-02-1-260901-b1a1-1440,,,
Autobusai,120,27217781404,557,25264652,54757646,0,156,844,0,52744,KWNZ,B>A,Visoriai,A120-02-1-260901-ab-1450,1710,2100,
Autobusai,14,27218621402,7010,25397726,54629321,52,198,842,28,52744,KWZ,B>A,Rudamina,A14-01-1-260901-ba-1400,2025,2222,
Autobusai,22,27220881357,791,25270464,54691045,11,326,837,167,52743,KZ,A>B,Centras,A22-01-1-260901-ba-1440,1465,1153,
Autobusai,59,27221181402,792,25244805,54698885,22,130,842,68,52743,KZ,A>B,Žvėrynas,A59-04-1-260901-ba-1450,1509,1557,`;
const g = parseGps(txt); console.log('parsed', g.length, g[3]);
const m = matchVehicles(net, g, 52750);
for (const x of m.values()) console.log(net.routeShort[net.tripRoute[x.trip]], net.tripGid[x.trip], 'delay', x.delay, 's; onRoute', x.onRoute, 'seg', x.seg >= 0 ? net.name[net.stStop[x.seg]] + ' → ' + net.name[net.stStop[x.seg + 1]] : '-');
// синтетический затор: машина 22 стоит, опоздание растёт
const jt = new JamTracker(); const one = [...m.values()].find(x => net.routeShort[net.tripRoute[x.trip]] === '22');
for (let k = 0; k < 6; k++) { const mm = new Map([[one.trip, { ...one, meas: one.meas + k * 60, delay: one.delay + k * 60, speed: 3 }]]); jt.update(net, mm, one.meas + k * 60); }
console.log('jams', jt.jams(net).map(j => `${j.from} → ${j.to} +${Math.round(j.loss / 60)} мин [${[...j.routes]}]`));
