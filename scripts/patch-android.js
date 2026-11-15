// Добавляет в AndroidManifest разрешения: уведомления, точные будильники, геолокация.
const fs = require('fs'), path = require('path');
const mf = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let xml = fs.readFileSync(mf, 'utf8');
const perms = [
  'android.permission.INTERNET',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];
const add = perms.filter(p => !xml.includes(`"${p}"`)).map(p => `    <uses-permission android:name="${p}" />`).join('\n');
if (add) xml = xml.replace(/(\s*)<\/manifest>/, `\n${add}\n</manifest>`);
fs.writeFileSync(mf, xml);
console.log('AndroidManifest: добавлены разрешения\n' + add);
