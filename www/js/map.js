// Карта-схема на Leaflet (подложка CARTO Positron — светлая, чтобы линии читались).
import { rideStops } from './core/router.js';

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
  if (map.getZoom() >= 15) { if (!map.hasLayer(stopLayer)) stopLayer.addTo(map); }
  else if (map.hasLayer(stopLayer)) map.removeLayer(stopLayer);
}
export function onStopClick(fn) { if (stopLayer) stopLayer.eachLayer(m => m.on('click', () => fn(m._stop))); }

export function setCatVisible(cat, on) { if (!map) return; if (on) layers[cat].addTo(map); else map.removeLayer(layers[cat]); }

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
