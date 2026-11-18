// Обёртки над Capacitor (на телефоне) с запасным вариантом для браузера.
const Cap = window.Capacitor;
export const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
function plugin(name) {
  if (!Cap) return null;
  return (Cap.Plugins && Cap.Plugins[name]) || (Cap.registerPlugin ? Cap.registerPlugin(name) : null);
}
export const LN = isNative ? plugin('LocalNotifications') : null;
const FS = isNative ? plugin('Filesystem') : null;
const GEO = isNative ? plugin('Geolocation') : null;

// ---------- IndexedDB
let _db;
function db() {
  if (_db) return _db;
  _db = new Promise((res, rej) => {
    const r = indexedDB.open('trasa', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('feeds'); r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return _db;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    const out = fn(s); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out);
    t.onerror = () => rej(t.error);
  });
}
export const store = {
  put: (st, k, v) => tx(st, 'readwrite', s => s.put(v, k)),
  get: (st, k) => tx(st, 'readonly', s => s.get(k)),
  del: (st, k) => tx(st, 'readwrite', s => s.delete(k)),
  keys: (st) => tx(st, 'readonly', s => s.getAllKeys()),
};

// ---------- скачивание (на телефоне — нативно, без CORS)
export async function download(url, onProgress = () => {}) {
  if (FS && FS.downloadFile && /^https?:/.test(url)) {
    const name = 'gtfs_' + url.replace(/[^a-z0-9]+/gi, '_').slice(-60) + '.zip';
    let h;
    try {
      h = await FS.addListener('progress', p => {
        if (p.url === url && p.contentLength > 0) onProgress(p.bytes / p.contentLength, p.bytes);
        else if (p.url === url) onProgress(null, p.bytes);
      });
    } catch (e) { /* ок без прогресса */ }
    try {
      const r = await FS.downloadFile({ url, path: name, directory: 'CACHE', progress: true, recursive: true });
      const fileUri = r.path || (await FS.getUri({ path: name, directory: 'CACHE' })).uri;
      const resp = await fetch(Cap.convertFileSrc(fileUri));
      return await resp.arrayBuffer();
    } finally { if (h && h.remove) h.remove(); }
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return await resp.arrayBuffer();
}

// ---------- текст из интернета (на телефоне — нативный HTTP без CORS)
const HTTP = isNative ? plugin('CapacitorHttp') : null;
export async function fetchText(url) {
  if (HTTP) {
    const r = await HTTP.get({ url, responseType: 'text', headers: { 'Cache-Control': 'no-cache' }, connectTimeout: 10000, readTimeout: 10000 });
    if (r.status && r.status >= 400) throw new Error('HTTP ' + r.status);
    return typeof r.data === 'string' ? r.data : String(r.data);
  }
  const resp = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return await resp.text();
}

// ---------- геолокация
export async function getPosition() {
  if (GEO) {
    try { await GEO.requestPermissions(); } catch (e) {}
    const p = await GEO.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
    return { lat: p.coords.latitude, lon: p.coords.longitude };
  }
  return new Promise((res, rej) => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude }), rej, { enableHighAccuracy: true, timeout: 15000 })
    : rej(new Error('Нет геолокации')));
}

// ---------- уведомления
const webTimers = new Map();
export async function notifInit() {
  if (LN) {
    try { await LN.requestPermissions(); } catch (e) {}
    try {
      await LN.createChannel({ id: 'trasa-main', name: 'Поездки: важное', importance: 5, vibration: true, visibility: 1 });
      await LN.createChannel({ id: 'trasa-stops', name: 'Поездки: остановки', importance: 3, vibration: false, visibility: 1 });
    } catch (e) {}
    return true;
  }
  if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) {} }
  return false;
}
export async function exactAlarmStatus() {
  if (!LN || !LN.checkExactNotificationSetting) return null;
  try { return (await LN.checkExactNotificationSetting()).exact_alarm; } catch (e) { return null; }
}
export async function openExactAlarmSettings() {
  if (LN && LN.changeExactNotificationSetting) { try { await LN.changeExactNotificationSetting(); } catch (e) {} }
}
// items: [{id, at: Date, title, body, channel}]
export async function schedule(items) {
  const now = Date.now() + 5000;
  items = items.filter(n => n.at.getTime() > now);
  if (!items.length) return 0;
  if (LN) {
    for (let i = 0; i < items.length; i += 60) {
      await LN.schedule({
        notifications: items.slice(i, i + 60).map(n => ({
          id: n.id, title: n.title, body: n.body, largeBody: n.body,
          channelId: n.channel || 'trasa-main', schedule: { at: n.at, allowWhileIdle: true },
          autoCancel: true, extra: { plan: Math.floor(n.id / 10000) }
        }))
      });
    }
    return items.length;
  }
  for (const n of items) {
    const ms = n.at.getTime() - Date.now();
    if (ms > 2147483000) continue;
    webTimers.set(n.id, setTimeout(() => {
      if ('Notification' in window && Notification.permission === 'granted') new Notification(n.title, { body: n.body });
      else console.log('[уведомление]', n.title, n.body);
      webTimers.delete(n.id);
    }, ms));
  }
  return items.length;
}
export async function cancelPlan(planId) {
  if (LN) {
    const p = await LN.getPending();
    const ids = (p.notifications || []).filter(n => Math.floor(+n.id / 10000) === planId).map(n => ({ id: +n.id }));
    for (let i = 0; i < ids.length; i += 100) await LN.cancel({ notifications: ids.slice(i, i + 100) });
    return ids.length;
  }
  let k = 0;
  for (const [id, t] of webTimers) if (Math.floor(id / 10000) === planId) { clearTimeout(t); webTimers.delete(id); k++; }
  return k;
}
export async function pendingCount(planId) {
  if (LN) {
    const p = await LN.getPending();
    return (p.notifications || []).filter(n => Math.floor(+n.id / 10000) === planId).length;
  }
  let k = 0; for (const id of webTimers.keys()) if (Math.floor(id / 10000) === planId) k++; return k;
}
