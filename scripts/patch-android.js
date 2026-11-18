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

// ---------- фоновое слежение за поездкой (сервис + плагин Tracker)
{
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'capacitor.config.json'), 'utf8'));
  const pkg = cfg.appId, javaDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', ...pkg.split('.'));
  fs.mkdirSync(javaDir, { recursive: true });
  for (const f of ['TrackService.java', 'TrackerPlugin.java'])
    fs.writeFileSync(path.join(javaDir, f), fs.readFileSync(path.join(__dirname, 'android-native', f), 'utf8').replace('__PKG__', pkg));
  const ma = path.join(javaDir, 'MainActivity.java');
  fs.writeFileSync(ma, `package ${pkg};

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TrackerPlugin.class);
        super.onCreate(savedInstanceState);
        WebView wv = getBridge().getWebView();
        if (Build.VERSION.SDK_INT >= 26) wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
    }
    // Свёрнутое приложение продолжает считать опоздания и заторы
    @Override public void onPause() {
        super.onPause();
        try { WebView wv = getBridge().getWebView(); wv.onResume(); wv.resumeTimers(); } catch (Exception e) {}
    }
}
`);
  let x = fs.readFileSync(mf, 'utf8');
  for (const p of ['android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_DATA_SYNC'])
    if (!x.includes(`"${p}"`)) x = x.replace(/(\s*)<\/manifest>/, `\n    <uses-permission android:name="${p}" />\n</manifest>`);
  if (!x.includes('.TrackService')) x = x.replace(/(\s*)<\/application>/, `\n        <service android:name=".TrackService" android:exported="false" android:foregroundServiceType="dataSync" />\n    </application>`);
  fs.writeFileSync(mf, x);
  console.log('Фоновое слежение: TrackService + TrackerPlugin в ' + javaDir);
}
