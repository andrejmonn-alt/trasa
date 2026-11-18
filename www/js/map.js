// Карта-схема на Leaflet (подложка CARTO Positron — светлая, чтобы линии читались).
import { rideStops } from './core/router.js';
import { dayIndex, activeVehicles, vehiclePos } from './core/vehicles.js';


export const CAT = {
  bus: { color: '#1f6fe5', name: 'Автобусы', w: 2.5 },
  trolley: { color: '#e03131', name: 'Троллейбусы', w: 2.5 },
  express: { color: '#2b9a3e', name: 'Экспрессы (G)', w: 3 },
  intercity: { color: '#f2b705', name: 'Пригородные / междугородние', w: 3 },
  train: { color: '#111111', name: 'Поезда', w: 4 },
};

let map, renderer, layers = {}, stopLayer, journeyLayer, marksLayer, pickHandler = null, longPressHandler = null;
export const mapState = { ready: false };

export function initMap(el) {
  if (!window.L) { el.innerHTML = '<div class="map-missing">Карта недоступна: библиотека Leaflet не загружена.<br>В собранном APK она есть (папка www/vendor).</div>'; return null; }
  map = L.map(el, { zoomControl: false, preferCanvas: true }).setView([54.687, 25.28], 12);
  renderer = L.canvas({ padding: 0.3, tolerance: 6 });
  if (window.TRASA_BASEMAP) drawBasemap(window.TRASA_BASEMAP);   // встроенная подложка OSM (HTML-версия)
  else if (window.TRASA_DEMO_FEEDS) drawSchemeBase();             // демо без подложки
  else L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
    attribution: '© OpenStreetMap, © CARTO'
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  for (const k in CAT) layers[k] = L.layerGroup().addTo(map);
  stopLayer = L.layerGroup(); journeyLayer = L.layerGroup().addTo(map); marksLayer = L.layerGroup().addTo(map);
  map.on('click', e => { if (pickHandler) { const h = pickHandler; pickHandler = null; h(e.latlng); } });
  map.on('contextmenu', e => { if (longPressHandler) longPressHandler(e.latlng); });
  map.on('zoomend', updateStops);
  mapState.ready = true;
  return map;
}

// Подложка из векторных путей (SVG-команды M/l/z в локальной проекции)
function parsePaths(str, o, k) {
  const out = []; let ring = null, x = 0, y = 0, cmd = '';
  const re = /[Mlz]|-?\d+(?:\.\d+)?/g; let m, nums = [];
  const flush = () => {
    for (let i = 0; i + 1 < nums.length; i += 2) {
      if (cmd === 'M' && i === 0) { x = nums[0]; y = nums[1]; ring = [[o[1] - y / k[1], o[0] + x / k[0]]]; out.push(ring); }
      else { x += nums[i]; y += nums[i + 1]; ring.push([o[1] - y / k[1], o[0] + x / k[0]]); }
    }
    nums = [];
  };
  while ((m = re.exec(str))) {
    const t = m[0];
    if (t === 'M' || t === 'l' || t === 'z') { flush(); cmd = t; continue; }
    nums.push(+t);
  }
  flush();
  return out;
}
function drawBasemap(bm) {
  map.createPane('base'); map.getPane('base').style.zIndex = 250;
  const r = L.canvas({ pane: 'base', padding: 0.4 });
  const P = name => bm.layers[name] ? parsePaths(bm.layers[name], bm.origin, bm.k) : [];
  const opt = (o) => Object.assign({ renderer: r, interactive: false, pane: 'base' }, o);
  L.polygon(P('green').map(r => [r]), opt({ stroke: false, fillColor: '#dcebd2', fillOpacity: 1 })).addTo(map);
  L.polygon(P('water').map(r => [r]), opt({ stroke: false, fillColor: '#bcdcf0', fillOpacity: 1 })).addTo(map);
  L.polyline(P('river'), opt({ color: '#bcdcf0', weight: 5 })).addTo(map);
  L.polyline(P('minor'), opt({ color: '#ffffff', weight: 1.4, opacity: 1 })).addTo(map);
  L.polyline(P('link'), opt({ color: '#ffffff', weight: 2.2 })).addTo(map);
  L.polyline(P('mid'), opt({ color: '#ffffff', weight: 3.2 })).addTo(map);
  L.polyline(P('major'), opt({ color: '#d9cfb8', weight: 5.5 })).addTo(map);
  L.polyline(P('major'), opt({ color: '#fbf3dd', weight: 3.5 })).addTo(map);
  L.polyline(P('rail'), opt({ color: '#a9a49a', weight: 1.6, dashArray: '5 4' })).addTo(map);
  const labels1 = L.layerGroup().addTo(map), labels2 = L.layerGroup();
  const tr = window.__trasaTranslatePlace || (s => s);
  for (const p of bm.places || []) {
    const ll = [bm.origin[1] - p.y / bm.k[1], bm.origin[0] + p.x / bm.k[0]];
    const t = L.tooltip({ permanent: true, direction: 'center', className: 'area-label', interactive: false, pane: 'base' }).setLatLng(ll).setContent(tr(p.n));
    (p.k === 1 ? labels1 : labels2).addLayer(t);
  }
  const upd = () => { if (map.getZoom() >= 14) labels2.addTo(map); else map.removeLayer(labels2); };
  map.on('zoomend', upd); upd();
  map.attributionControl.addAttribution('© OpenStreetMap contributors');
}

function drawSchemeBase() {
  // река Нярис (приблизительно) и подписи районов — только для ориентира
  const neris = [[54.78, 25.42], [54.745, 25.35], [54.73, 25.33], [54.715, 25.315], [54.70, 25.305], [54.693, 25.29], [54.689, 25.278],
    [54.693, 25.262], [54.689, 25.248], [54.681, 25.238], [54.687, 25.225], [54.697, 25.21], [54.69, 25.185], [54.675, 25.15], [54.67, 25.10], [54.70, 24.95]];
  L.polyline(neris, { color: '#a5d8ff', weight: 9, opacity: 0.9, interactive: false }).addTo(map);
  const lbl = [['Senamiestis · Stare Miasto', 54.680, 25.290], ['Antakalnis · Antokol', 54.710, 25.330], ['Žirmūnai · Żyrmuny', 54.718, 25.300],
    ['Šeškinė · Szeszkinie', 54.718, 25.255], ['Lazdynai', 54.672, 25.215], ['Naujoji Vilnia · Nowa Wilejka', 54.700, 25.425],
    ['Nemenčinė · Niemenczyn', 54.855, 25.475], ['Maišiagala · Mejszagoła', 54.875, 25.057], ['Šalčininkai', 54.318, 25.380]];
  for (const [t, a, b] of lbl) L.tooltip({ permanent: true, direction: 'center', className: 'area-label', interactive: false }).setLatLng([a, b]).setContent(t).addTo(map);
}

export function invalidate() { if (map) setTimeout(() => map.invalidateSize(), 50); }

export function drawNetwork(net, onRouteClick) {
  if (!map) return;
  for (const k in layers) layers[k].clearLayers();
  const order = ['intercity', 'bus', 'trolley', 'express', 'train'];
  const byCat = {}; for (const l of net.lines) (byCat[l.cat] = byCat[l.cat] || []).push(l);
  for (const cat of order) for (const l of byCat[cat] || []) {
    const pts = []; for (let i = 0; i < l.coords.length; i += 2) pts.push([l.coords[i], l.coords[i + 1]]);
    layers[cat].addLayer(L.polyline(pts, { color: '#ffffff', weight: CAT[cat].w + 2.5, opacity: 0.85, renderer, interactive: false }));
    const pl = L.polyline(pts, { color: CAT[cat].color, weight: CAT[cat].w, opacity: 0.9, renderer });
    pl.on('click', e => onRouteClick && onRouteClick(l.route, e.latlng));
    layers[cat].addLayer(pl);
  }
  // остановки (показываются при приближении)
  stopLayer.clearLayers();
  for (let s = 0; s < net.nStops; s++) {
    if (!net.stopRoutes[s].length) continue;
    const m = L.circleMarker([net.lat[s], net.lon[s]], { radius: 4, color: '#0d1630', weight: 1.5, fillColor: '#fff', fillOpacity: 1, renderer });
    m.bindTooltip(net.name[s], { direction: 'top' });
    m._stop = s; stopLayer.addLayer(m);
  }
  updateStops();
}
function updateStops() {
  if (!map || !stopLayer) return;
  if (map.getZoom() >= 14) { if (!map.hasLayer(stopLayer)) stopLayer.addTo(map); }
  else if (map.hasLayer(stopLayer)) map.removeLayer(stopLayer);
}
export function onStopClick(fn) { if (stopLayer) stopLayer.eachLayer(m => m.on('click', () => fn(m._stop))); }

export function setCatVisible(cat, on) { if (!map) return; if (on) layers[cat].addTo(map); else map.removeLayer(layers[cat]); V.visible[cat] = on; drawVehicles(); }

export function showJourney(net, j, origin, dest) {
  if (!map) return;
  map.invalidateSize();
  journeyLayer.clearLayers();
  const all = [];
  const startPt = origin && origin.lat ? [origin.lat, origin.lon] : null;
  let prev = startPt;
  for (const leg of j.legs) {
    if (leg.type === 'walk') {
      const a = [net.lat[leg.from], net.lon[leg.from]], b = [net.lat[leg.to], net.lon[leg.to]];
      journeyLayer.addLayer(L.polyline([a, b], { color: '#555', weight: 4, dashArray: '4 8', renderer }));
      all.push(a, b); prev = b; continue;
    }
    const st = rideStops(net, leg), cat = net.routeCat[net.tripRoute[leg.trip]];
    const pts = st.map(s => [net.lat[s.stop], net.lon[s.stop]]);
    if (prev && prev !== startPt) {} // уже нарисовано
    if (prev === startPt && startPt) journeyLayer.addLayer(L.polyline([startPt, pts[0]], { color: '#555', weight: 4, dashArray: '4 8', renderer }));
    journeyLayer.addLayer(L.polyline(pts, { color: '#fff', weight: 10, opacity: 0.9, renderer }));
    journeyLayer.addLayer(L.polyline(pts, { color: CAT[cat].color, weight: 6, renderer }));
    st.forEach((s, i) => journeyLayer.addLayer(L.circleMarker(pts[i], {
      radius: i === 0 || i === st.length - 1 ? 7 : 4, color: CAT[cat].color, weight: 2, fillColor: '#fff', fillOpacity: 1, renderer
    }).bindTooltip(net.name[s.stop])));
    all.push(...pts); prev = pts[pts.length - 1];
  }
  if (dest && dest.lat && prev) journeyLayer.addLayer(L.polyline([prev, [dest.lat, dest.lon]], { color: '#555', weight: 4, dashArray: '4 8', renderer }));
  if (startPt) { journeyLayer.addLayer(L.marker(startPt, { icon: pin('A') })); all.push(startPt); }
  if (dest && dest.lat) { journeyLayer.addLayer(L.marker([dest.lat, dest.lon], { icon: pin('B') })); all.push([dest.lat, dest.lon]); }
  if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [40, 40] });
}
export function clearJourney() { if (journeyLayer) journeyLayer.clearLayers(); }

function pin(t) { return L.divIcon({ className: 'pin', html: `<div class="pin-in ${t === 'A' ? 'a' : 'b'}"><b>${t}</b></div>`, iconSize: [30, 30], iconAnchor: [15, 34] }); }

export function drawMarks(marks, maxAgeH, onRemove) {
  if (!map) return;
  marksLayer.clearLayers();
  const now = Date.now();
  for (const m of marks) {
    const ageH = (now - m.ts) / 3600000; if (ageH > maxAgeH) continue;
    const mk = L.marker([m.lat, m.lon], { icon: L.divIcon({ className: 'ctrl', html: `<div class="ctrl-in" style="opacity:${Math.max(0.45, 1 - ageH / maxAgeH)}">К</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) });
    const mins = Math.round(ageH * 60);
    mk.bindPopup(`<b>Контролёры</b><br>отмечено ${mins < 60 ? mins + ' мин' : Math.round(ageH) + ' ч'} назад${m.note ? '<br>' + escapeHtml(m.note) : ''}<br><button class="btn small" data-rm="${m.ts}">Убрать</button>`);
    mk.on('popupopen', e => { const b = e.popup.getElement().querySelector('[data-rm]'); if (b) b.onclick = () => { onRemove(m.ts); map.closePopup(); }; });
    marksLayer.addLayer(mk);
  }
}
export function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export function pickPoint(fn) { pickHandler = fn; }
export function onLongPress(fn) { longPressHandler = fn; }
export function flyTo(lat, lon, z = 16) { if (map) map.setView([lat, lon], z); }
export function getCenter() { return map ? map.getCenter() : null; }

// ================= Автобусы на карте (по расписанию) =================
const V = { rt: null, rtAt: 0, net: null, idx: null, idxDay: -1, canvas: null, ctx: null, list: [], timer: null, getTracked: null, follow: true, lastTracked: null, onBanner: null, visible: {} };

export function startVehicles(net, getTracked, onBanner) {
  if (!map) return;
  V.net = net; V.idx = null; V.idxDay = -1; V.getTracked = getTracked; V.onBanner = onBanner;
  if (!V.canvas) {
    V.canvas = document.createElement('canvas');
    V.canvas.className = 'veh-canvas';
    map.getContainer().appendChild(V.canvas);
    V.ctx = V.canvas.getContext('2d');
    const redraw = () => drawVehicles();
    map.on('move zoom resize viewreset', redraw);
    map.on('dragstart', () => { V.follow = false; if (V.onBanner) V.onBanner(null, true); });
    map.on('click', e => { if (!pickHandler) vehicleClick(e); });
  }
  clearInterval(V.timer);
  V.timer = setInterval(tickVehicles, 1000);
  tickVehicles();
}
// реальное время: matched — Map(trip -> {lat, lon, delay, seg, ...}); null — нет данных
export function setRealtime(matched) { V.rt = matched; V.rtAt = Date.now(); tickVehicles(); }
function rtFresh() { return V.rt && Date.now() - V.rtAt < 90000; }
function isCity(trip) { const n = V.net, r = n.tripRoute[trip]; return n.feeds[n.routeFeed[r]] === 'vilnius'; }
function liveToPos(m) {
  const n = V.net, nx = m.seg >= 0 ? m.seg + 1 : -1;
  return { lat: m.lat, lon: m.lon, at: m.seg, next: nx >= 0 ? nx : n.tripOff[m.trip], nextArr: (nx >= 0 ? n.stArr[nx] : n.stDep[n.tripOff[m.trip]]) + m.shift + m.delay,
    delay: m.delay, live: true, age: m.age, trip: m.trip, shift: m.shift };
}
export function setVehicleFollow(on) { V.follow = on; V.zoomIn = on; tickVehicles(); }
export function vehiclesSetCat(cat, on) { V.visible[cat] = on; drawVehicles(); }

function nowSec(midnight) { return (Date.now() - midnight.getTime()) / 1000; }
function tickVehicles() {
  if (!map || !V.net || !map.getContainer().offsetParent) return; // карта скрыта — не считаем
  const d = new Date(); const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (V.idxDay !== midnight.getTime()) { V.idx = dayIndex(V.net, midnight); V.idxDay = midnight.getTime(); }
  const t = nowSec(midnight);
  V.list = activeVehicles(V.net, V.idx, t);
  if (rtFresh()) {
    const seen = new Set();
    V.list = V.list.map(v => {
      const m = V.rt.get(v.trip);
      if (m) { seen.add(v.trip); return liveToPos(m); }
      if (isCity(v.trip)) v.ghost = true;
      return v;
    });
    for (const m of V.rt.values()) if (!seen.has(m.trip)) V.list.push(liveToPos(m)); // опаздывающие сверх расписания
  }
  const lg = document.querySelector('.map-legend');
  if (lg) lg.textContent = rtFresh() ? `● GPS · ${Math.round((Date.now() - V.rtAt) / 1000)} с назад · бледные — без сигнала` : 'Положение автобусов — по расписанию';
  // наш рейс
  const tr = V.getTracked ? V.getTracked() : null;
  V.lastTracked = null;
  if (tr) {
    const tt = (Date.now() - tr.midnight.getTime()) / 1000;
    // текущий участок: первый, который ещё не закончился
    const lateOf = l => { const m = rtFresh() && V.rt.get(l.trip); return m ? Math.max(0, m.delay) : 0; };
    const leg = tr.legs.find(l => tt <= V.net.stArr[V.net.tripOff[l.trip + 1] - 1] + l.shift + lateOf(l) && tt <= l.arr + lateOf(l)) || tr.legs[tr.legs.length - 1];
    const live = rtFresh() && V.rt.get(leg.trip);
    let p = live ? liveToPos(live) : vehiclePos(V.net, leg.trip, leg.shift, tt);
    const waiting = !p || (live && p.next <= leg.i0);
    if (!p) { const s = V.net.stStop[leg.i0]; p = { lat: V.net.lat[s], lon: V.net.lon[s], next: leg.i0, nextArr: leg.dep }; }
    V.lastTracked = { ...p, trip: leg.trip, shift: leg.shift, leg, waiting, tt };
    if (V.follow) {
      if (V.zoomIn) { V.zoomIn = false; map.setView([p.lat, p.lon], Math.max(map.getZoom(), 14), { animate: true }); }
      else map.panTo([p.lat, p.lon], { animate: true, duration: 0.8 });
    }
    if (V.onBanner) V.onBanner(V.lastTracked, !V.follow);
  } else if (V.onBanner) V.onBanner(null, false);
  drawVehicles();
}

function fmt(sec) { const s = ((Math.floor(sec) % 86400) + 86400) % 86400; return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0'); }
function label(r) {
  const n = V.net, sh = n.routeShort[r];
  if (sh) return sh;
  return n.routeCat[r] === 'train' ? '🚆' : '🚌';
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

function drawVehicles() {
  if (!V.canvas || !map) return;
  const size = map.getSize(), dpr = window.devicePixelRatio || 1;
  if (V.canvas.width !== size.x * dpr || V.canvas.height !== size.y * dpr) {
    V.canvas.width = size.x * dpr; V.canvas.height = size.y * dpr;
    V.canvas.style.width = size.x + 'px'; V.canvas.style.height = size.y + 'px';
  }
  const c = V.ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, size.x, size.y);
  const z = map.getZoom(), big = z >= 13;
  c.font = '700 11px Manrope, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  V.drawn = [];
  const trk = V.lastTracked;
  for (const v of V.list) {
    if (trk && v.trip === trk.trip && v.shift === trk.shift) continue;
    const r = V.net.tripRoute[v.trip], cat = V.net.routeCat[r];
    if (V.visible[cat] === false) continue;
    const p = map.latLngToContainerPoint([v.lat, v.lon]);
    if (p.x < -30 || p.y < -30 || p.x > size.x + 30 || p.y > size.y + 30) continue;
    const col = CAT[cat].color;
    c.globalAlpha = v.ghost ? 0.35 : 1;
    if (!big) { c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.rect(p.x - 3.5, p.y - 3.5, 7, 7); c.fill(); c.stroke(); V.drawn.push({ v, x: p.x, y: p.y }); continue; }
    const txt = label(r), w = Math.max(22, c.measureText(txt).width + 10), h = 18;
    c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 4; c.shadowOffsetY = 1;
    rrect(c, p.x - w / 2, p.y - h / 2, w, h, 5); c.fillStyle = col; c.fill();
    c.shadowColor = 'transparent'; c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke();
    c.fillStyle = cat === 'intercity' ? '#2b2100' : '#fff'; c.fillText(txt, p.x, p.y + 0.5);
    if (v.live && v.delay >= 120) delayTag(c, p.x + w / 2 - 2, p.y - h / 2 - 2, v.delay);
    V.drawn.push({ v, x: p.x, y: p.y });
  }
  c.globalAlpha = 1;
  if (trk) { // наш автобус — крупнее, с пульсом
    const r = V.net.tripRoute[trk.trip], cat = V.net.routeCat[r], col = CAT[cat].color;
    const p = map.latLngToContainerPoint([trk.lat, trk.lon]);
    const ph = (Date.now() % 1600) / 1600;
    c.beginPath(); c.arc(p.x, p.y, 16 + ph * 14, 0, Math.PI * 2); c.fillStyle = `rgba(31,111,229,${0.35 * (1 - ph)})`; c.fill();
    c.font = '800 13px Manrope, system-ui, sans-serif';
    const txt = label(r), w = Math.max(34, c.measureText(txt).width + 16), h = 26;
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 8; c.shadowOffsetY = 2;
    rrect(c, p.x - w / 2, p.y - h / 2, w, h, 8); c.fillStyle = col; c.fill();
    c.shadowColor = 'transparent'; c.lineWidth = 3; c.strokeStyle = '#1f6fe5'; c.stroke();
    c.fillStyle = cat === 'intercity' ? '#2b2100' : '#fff'; c.fillText(txt, p.x, p.y + 0.5);
    if (trk.live && trk.delay >= 60) delayTag(c, p.x + w / 2, p.y - h / 2, trk.delay);
    c.font = '800 10px Manrope, system-ui, sans-serif'; c.fillStyle = '#1f6fe5';
    rrect(c, p.x - 14, p.y - h / 2 - 15, 28, 13, 6); c.fillStyle = '#1f6fe5'; c.fill(); c.fillStyle = '#fff'; c.fillText('ВЫ', p.x, p.y - h / 2 - 8.5);
  }
}

function delayTag(c, x, y, d) {
  const t = '+' + Math.round(d / 60);
  c.save(); c.font = '800 9px Manrope, system-ui, sans-serif';
  const w = c.measureText(t).width + 8;
  rrect(c, x - w / 2, y - 6, w, 12, 6); c.fillStyle = d >= 300 ? '#c0262d' : '#e8730c'; c.fill();
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x, y + 0.5); c.restore();
}
function vehicleClick(e) {
  if (!V.drawn || !V.drawn.length) return;
  const p = map.latLngToContainerPoint(e.latlng);
  let best = null, bd = 18 * 18;
  for (const d of V.drawn) { const dx = d.x - p.x, dy = d.y - p.y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = d; } }
  if (!best) return;
  const n = V.net, v = best.v, r = n.tripRoute[v.trip], cat = n.routeCat[r];
  const last = n.tripOff[v.trip + 1] - 1;
  const html = `<span class="badge ${cat}">${escapeHtml(label(r))}</span> ${escapeHtml(n.routeName[r] !== n.routeShort[r] ? n.routeName[r] : '')}<br>
    → <b>${escapeHtml(n.tripHead[v.trip] || n.name[n.stStop[last]])}</b><br>
    <small>${v.dwell ? 'стоит' : 'следующая'}: «${escapeHtml(n.name[n.stStop[v.next]])}» в ${fmt(v.nextArr)}<br>конечная в ${fmt(n.stArr[last] + v.shift + (v.live ? v.delay : 0))} · ${v.live
      ? `<b style="color:${v.delay >= 120 ? '#c0262d' : '#1f8a3a'}">${v.delay >= 60 ? 'опаздывает на ' + Math.round(v.delay / 60) + ' мин' : v.delay <= -60 ? 'раньше на ' + Math.round(-v.delay / 60) + ' мин' : 'по графику'}</b> (GPS, ${Math.round(v.age)} с назад)`
      : v.ghost ? 'нет сигнала GPS — по расписанию' : 'по расписанию'}</small>`;
  L.popup().setLatLng([v.lat, v.lon]).setContent(html).openOn(map);
}
