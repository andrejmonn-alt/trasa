import { importGtfs, distM } from './core/gtfs.js';
import { buildNetwork, searchGroups, accessFromPoint, nearby } from './core/network.js';
import { plan, rideStops, fmtTime, fmtDur } from './core/router.js';
import { stopDisplayName, norm, translatePlaces } from './core/names.js';
window.__trasaTranslatePlace = n => { const t = translatePlaces(n, 'county'); return t !== n ? t : n; };
import * as P from './platform.js';
import { journeyNotifications, legInfo } from './notify.js';
import * as M from './map.js';
import { ICON, CAT_ICON } from './icons.js';
import { findTrip } from './core/vehicles.js';
import { startLive, LIVE, pollNow, liveSay } from './live.js';
import { getTicket, activateTicket, clearTicket, ticketHint, ticketJourneyNotes } from './ticket.js';

// ---------------- источники данных
const FEEDS = [
  { id: 'vilnius', title: 'Вильнюс: городской транспорт', url: 'https://www.stops.lt/vilnius/vilnius/gtfs.zip', kind: 'city', filter: 'none', def: true },
  { id: 'vilniausr', title: 'Вильнюсский район (пригородные)', url: 'https://www.visimarsrutai.lt/gtfs/VilniausR.zip', kind: 'regional', filter: 'none', def: true },
  { id: 'vrap', title: 'VRAP: направление Неменчине (171, 148, 154, 157, 158, 160)', url: 'data/vrap.zip', kind: 'regional', filter: 'none', def: true, exp: 'из таблиц vrap.lt' },
  { id: 'svtxt', title: 'Švenčionys – Pabradė – Vilnius (Transporto centras, Meteorit turas, Seknija)', url: 'data/svencionys.zip', kind: 'regional', filter: 'none', def: false, exp: 'по тексту svencionys.lt — включайте, если районный файл не скачался' },
  { id: 'ltsar', title: 'Междугородние рейсы через Вильнюсский край (LTSA)', url: 'https://www.visimarsrutai.lt/gtfs/LTSAR.zip', kind: 'regional', filter: 'region', def: true },
  { id: 'ltg', title: 'Поезда LTG Link (GTFS, transitous/jbb)', url: 'https://jbb.ghsq.de/gtfs/lt-ltglink.gtfs.zip', kind: 'regional', filter: 'region', def: true },
  { id: 'railtxt', title: 'Поезда по PDF LTG Link (встроено)', url: 'data/rail.zip', kind: 'regional', filter: 'none', def: false, exp: 'запасной вариант, если файл выше не скачался' },
  { id: 'trains', title: 'Поезда (из общего файла Литвы)', url: 'https://www.visimarsrutai.lt/gtfs/google_transit.zip', kind: 'regional', filter: 'rail', def: false, exp: 'большой файл; не включайте вместе с другими «Поездами»' },
  { id: 'salc', title: 'Шальчининкский район', url: 'https://www.visimarsrutai.lt/gtfs/SalcininkuR.zip', kind: 'regional', filter: 'region', def: true },
  { id: 'sven', title: 'Швянчёнский район', url: 'https://www.visimarsrutai.lt/gtfs/SvencioniuR.zip', kind: 'regional', filter: 'region', def: true },
  { id: 'trak', title: 'Тракайский район', url: 'https://www.visimarsrutai.lt/gtfs/TrakuR.zip', kind: 'regional', filter: 'region', def: true },
  { id: 'sirv', title: 'Ширвинтский район', url: 'https://www.visimarsrutai.lt/gtfs/SirvintuR.zip', kind: 'regional', filter: 'region', def: true },
  { id: 'ukm', title: 'Укмергский район', url: 'https://www.visimarsrutai.lt/gtfs/UkmergesR.zip', kind: 'regional', filter: 'region', def: true },
  { id: 'elek', title: 'Электренай', url: 'https://www.visimarsrutai.lt/gtfs/Elektrenu.zip', kind: 'regional', filter: 'region', def: true },
];

// ---------------- состояние
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem('trasa.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem('trasa.' + k, JSON.stringify(v)); } catch (e) {} },
};
const settings = Object.assign({
  feeds: Object.fromEntries(FEEDS.map(f => [f.id, f.def])),
  scope: 'county', perStop: true, buffer: 2, maxWalk: 1200, markHours: 3, overrides: {}
}, LS.get('settings', {}));
if (!settings.v3) { settings.v2 = false; settings.v3 = true; }
if (!settings.v2) { settings.scope = 'county'; for (const f of FEEDS) if (settings.feeds[f.id] === undefined || (f.def && ['salc', 'sven', 'trak', 'sirv', 'elek', 'ukm', 'vrap', 'ltg'].includes(f.id))) settings.feeds[f.id] = f.def; settings.v2 = true; }
const saveSettings = () => LS.set('settings', settings);
let plans = LS.get('plans', []);
const savePlans = () => LS.set('plans', plans);
let marks = LS.get('marks', []);
const saveMarks = () => LS.set('marks', marks);

let net = null, feedMeta = LS.get('feedMeta', {});
// демо-режим: встроенное вымышленное расписание, хранится в памяти
const DEMO = window.TRASA_DEMO_FEEDS || window.TRASA_PRELOADS || null;
const EMBED = window.TRASA_PRELOADS ? window.TRASA_PRELOADS[0] : null;
const memFeeds = new Map();
const feedStore = DEMO ? { get: async (st, k) => memFeeds.get(k), put: async (st, k, v) => { memFeeds.set(k, v); } } : P.store;
const ep = { from: null, to: null };
let lastResults = null;

const $ = s => document.querySelector(s);
const esc = M.escapeHtml;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms); }
function log(msg) { const l = $('#log'); l.classList.add('on'); l.textContent += msg + '\n'; l.scrollTop = 1e9; }
function sheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.remove('hidden'); return $('#sheetBody'); }
function closeSheet() { $('#sheet').classList.add('hidden'); }
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

// ---------------- вкладки
function showTab(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'map') M.invalidate();
  if (name === 'plans') renderPlans();
  if (name === 'data') renderFeeds();
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));

// ---------------- загрузка сети
async function loadNetwork() {
  $('#netStatus').textContent = 'Загрузка расписаний…';
  const feeds = [];
  for (const f of FEEDS) {
    if (!settings.feeds[f.id]) continue;
    const d = await feedStore.get('feeds', f.id);
    if (d) feeds.push(d);
  }
  if (!feeds.length) {
    net = null;
    $('#netStatus').textContent = 'Нет данных';
    $('#results').innerHTML = `<div class="card empty">Расписания ещё не скачаны.<br><br><button class="btn primary" id="goData">Перейти к загрузке</button></div>`;
    $('#goData').onclick = () => showTab('data');
    return;
  }
  await new Promise(r => setTimeout(r, 30));
  const t = performance.now();
  net = buildNetwork(feeds, { scope: settings.scope, overrides: settings.overrides, approx: ['vrap', 'svtxt', 'railtxt'] });
  const stale = feeds.some(f => Date.now() - f.importedAt > 10 * 86400000);
  $('#netStatus').textContent = `${net.nStops} ост. · ${net.nTrips} рейсов` + (stale ? ' · ⚠ обновите' : '');
  console.log('network built in', Math.round(performance.now() - t), 'ms');
  if (M.mapState.ready) { M.drawNetwork(net, routePopup); M.onStopClick(stopPopup); M.startVehicles(net, getTracked, rideBanner); }
  startLive(net, { getTracked, reroute: rerouteHook, update: L => { if (!L.err) M.setRealtime(L.matched); }, alert: (t, b) => toast(t + ' — ' + b, 6000) });
  trackCache.clear();
  if ($('#results').querySelector('#goData')) $('#results').innerHTML = '';
  refreshRepeatPlans();
}

// ---------------- выбор точек
function epLabel(e) { return e ? e.label : ''; }
function setEp(which, e) {
  ep[which] = e; $('#' + which + 'Input').value = epLabel(e);
}
const epSave = e => e && ({ type: e.type, label: e.label, name: e.name, lat: e.lat, lon: e.lon });
function groupEp(g) {
  return { type: 'group', label: g.name, name: g.name, lat: g.lat, lon: g.lon, stops: g.stops };
}
function resolveStops(e) {
  if (!net || !e) return [];
  if (e.type === 'point') return accessFromPoint(net, e.lat, e.lon, settings.maxWalk);
  // группа: ищем по имени рядом с сохранёнными координатами (после обновления данных индексы меняются)
  let best = null, bd = 1e9;
  for (const g of net.groups) {
    if (g.name !== e.name && g.lt !== e.name) continue;
    const d = distM(g.lat, g.lon, e.lat, e.lon); if (d < bd) { bd = d; best = g; }
  }
  if (best && bd < 3000) return best.stops.map(s => ({ stop: s, walk: 0 }));
  return accessFromPoint(net, e.lat, e.lon, 600);
}
function routeChips(routes, max = 6, size = '') {
  const seen = new Set();
  const sorted = routes.slice().sort((a, b) => (net.routeShort[a] || '').localeCompare(net.routeShort[b] || '', 'lt', { numeric: true }))
    .filter(r => { const k = net.routeCat[r] + (net.routeShort[r] || net.routeName[r]); if (seen.has(k)) return false; seen.add(k); return true; });
  return sorted.slice(0, max).map(r => `<span class="badge ${size} ${net.routeCat[r]}">${esc(net.routeShort[r] || net.routeName[r])}</span>`).join('') + (routes.length > max ? ` <small style="display:inline">+${routes.length - max}</small>` : '');
}
// подпись «где это»: чтобы различать одноимённые остановки (три Miškiniai и т.п.)
const HUBS = [['Wilno', 54.687, 25.28], ['Niemenczyn', 54.849, 25.475], ['Podbrodzie', 54.98, 25.76], ['Święciany', 55.134, 26.159],
  ['Troki', 54.637, 24.934], ['Landwarów', 54.643, 25.051], ['Soleczniki', 54.31, 25.38], ['Jaszuny', 54.44, 25.33],
  ['Mejszagoła', 54.868, 25.057], ['Szyrwinty', 55.045, 24.956], ['Wiłkomierz', 55.25, 24.75], ['Elektreny', 54.786, 24.663],
  ['Bezdany', 54.783, 25.545], ['Sużany', 54.976, 25.626], ['Rudziszki', 54.52, 24.83], ['Nowe Święciany', 55.163, 26.0],
  ['Ignalina', 55.345, 26.167], ['Visaginas', 55.596, 26.437], ['Molėtai', 55.23, 25.42], ['Varėna', 54.22, 24.57], ['Kiena', 54.65, 25.633]];
function whereLabel(g) {
  const isTrain = g.routes.some(r => net.routeCat[r] === 'train');
  const city = g.stops.some(s => net.feeds[net.stopFeed[s]] === 'vilnius');
  let lab;
  if (city) lab = 'Вильнюс, город';
  else {
    let best = null, bd = 1e12;
    for (const [n, la, lo] of HUBS) { const d = distM(g.lat, g.lon, la, lo); if (d < bd) { bd = d; best = n; } }
    lab = bd < 2500 ? best : `≈ ${Math.round(bd / 1000)} км от ${best}`;
  }
  return (isTrain ? 'ж/д станция · ' : '') + lab;
}
function badge(cat, text, size = '') { return `<span class="badge ${size} ${cat}">${CAT_ICON[cat] || ''}${esc(text)}</span>`; }
for (const which of ['from', 'to']) {
  const inp = $('#' + which + 'Input'), box = $('#' + which + 'Sugg');
  inp.addEventListener('input', () => {
    ep[which] = null;
    if (!net) return;
    const res = searchGroups(net, inp.value, 10);
    box.innerHTML = res.map((g, i) => `<div data-i="${i}">${esc(g.name)}${g.lt !== g.name ? `<small>${esc(g.lt)}</small>` : ''}<small>${esc(whereLabel(g))}</small><div class="lines">${routeChips(g.routes, 8, 'sm')}</div></div>`).join('');
    box.classList.toggle('open', res.length > 0);
    box.querySelectorAll('[data-i]').forEach(d => d.onclick = () => { setEp(which, groupEp(res[+d.dataset.i])); box.classList.remove('open'); });
  });
  inp.addEventListener('blur', () => setTimeout(() => box.classList.remove('open'), 200));
}
document.querySelectorAll('[data-gps]').forEach(b => b.onclick = async () => {
  const which = b.dataset.gps;
  try {
    toast('Определяю местоположение…');
    const p = await P.getPosition();
    setEp(which, { type: 'point', label: '📍 Моё место', lat: p.lat, lon: p.lon });
  } catch (e) { toast('Не удалось получить GPS: ' + (e.message || e)); }
});
document.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
  const which = b.dataset.pick;
  showTab('map'); $('#pickBanner').classList.add('on');
  M.pickPoint(ll => {
    $('#pickBanner').classList.remove('on');
    let label = `Точка ${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`;
    if (net) { const near = accessFromPoint(net, ll.lat, ll.lng, 400).sort((a, b) => a.dist - b.dist)[0]; if (near) label = '📌 у «' + net.name[near.stop] + '»'; }
    setEp(which, { type: 'point', label, lat: ll.lat, lon: ll.lng });
    showTab('route');
  });
});
$('#pickCancel').onclick = () => { M.pickPoint(null); $('#pickBanner').classList.remove('on'); };
$('#swapBtn').onclick = () => { const a = ep.from, b = ep.to; setEp('from', b); setEp('to', a); };

function setNow() {
  const d = new Date();
  $('#dateInput').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  $('#timeInput').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
$('#nowBtn').onclick = setNow;
setNow();

// ---------------- поиск
function parseDT(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number), [hh, mm] = timeStr.split(':').map(Number);
  return { midnight: new Date(y, m - 1, d), t0: hh * 3600 + mm * 60 };
}
function findJourneys(from, to, midnight, t0, count = 4) {
  const access = resolveStops(from), egress = resolveStops(to);
  if (!access.length) throw new Error('Рядом с началом пути нет остановок');
  if (!egress.length) throw new Error('Рядом с концом пути нет остановок');
  return plan(net, midnight, t0, access, egress, { buffer: settings.buffer * 60, count });
}
// «Приехать к»: самые поздние выезды, которые успевают к сроку
function findArriveBy(from, to, midnight, tArr, count = 4) {
  const access = resolveStops(from), egress = resolveStops(to);
  if (!access.length) throw new Error('Рядом с началом пути нет остановок');
  if (!egress.length) throw new Error('Рядом с концом пути нет остановок');
  let out = [];
  for (let span = 5400; span <= 6 * 3600 && !out.length; span += 5400) {
    const js = plan(net, midnight, tArr - span, access, egress, { buffer: settings.buffer * 60, count: 14, windowH: span / 3600 + 0.5 });
    out = js.filter(j => j.arrive <= tArr);
  }
  out.sort((a, b) => b.leave - a.leave || a.arrive - b.arrive);
  return out.slice(0, count);
}
const timeMode = () => ($('#timeMode') && $('#timeMode').value) || 'dep';
$('#searchBtn').onclick = () => {
  if (!net) { toast('Сначала скачайте расписания (вкладка «Данные»)'); return; }
  for (const w of ['from', 'to']) if (!ep[w]) {
    const g = searchGroups(net, $('#' + w + 'Input').value, 1)[0];
    if (g) setEp(w, groupEp(g)); else { toast(w === 'from' ? 'Укажите, откуда' : 'Укажите, куда'); return; }
  }
  const { midnight, t0 } = parseDT($('#dateInput').value, $('#timeInput').value);
  $('#results').innerHTML = '<div class="card empty">Ищу…</div>';
  setTimeout(() => {
    try {
      const t = performance.now();
      const mode = timeMode();
      const js = mode === 'arr' ? findArriveBy(ep.from, ep.to, midnight, t0) : findJourneys(ep.from, ep.to, midnight, t0);
      lastResults = { js, midnight, t0, from: ep.from, to: ep.to, mode, deadline: mode === 'arr' ? t0 : null };
      renderResults(Math.round(performance.now() - t));
    } catch (e) { console.error(e); $('#results').innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
  }, 20);
};

function marksNear(j) {
  const now = Date.now(), live = marks.filter(m => now - m.ts < settings.markHours * 3600000);
  if (!live.length) return [];
  const hit = new Set();
  for (const l of j.legs) if (l.type === 'ride') for (const s of rideStops(net, l)) {
    for (const m of live) if (distM(m.lat, m.lon, net.lat[s.stop], net.lon[s.stop]) < 300) hit.add(net.name[s.stop]);
  }
  return Array.from(hit);
}

function renderResults(ms) {
  const { js, midnight, mode, deadline } = lastResults;
  if (!js.length) { $('#results').innerHTML = `<div class="card empty"><span class="big">${ICON.route}</span>${mode === 'arr' ? 'Не нашлось вариантов, которые успевают к ' + fmtTime(deadline) + '.' : 'Подходящих рейсов в ближайшие 14 часов нет.'}<br>Попробуйте другое время или дату.</div>`; return; }
  const nowSec = (Date.now() - midnight.getTime()) / 1000;
  const W = sec => Math.max(1, Math.round(sec / 60));
  $('#results').innerHTML = `<div class="section-label">${mode === 'arr' ? `Успеть к ${fmtTime(deadline)} · выезд как можно позже` : 'Варианты'} · ${js.length}</div>` + js.map((j, k) => {
    const rides = j.legs.filter(l => l.type === 'ride');
    const parts = [];
    if (j.accessWalk >= 60) parts.push(`<span class="badge walk">${ICON.walk}${W(j.accessWalk)}</span>`);
    for (const l of j.legs) {
      if (l.type === 'walk') parts.push(`<span class="badge walk">${ICON.walk}${W(l.dur)}</span>`);
      else { const i = legInfo(net, l); parts.push(badge(i.cat, i.short || i.route)); }
    }
    if (j.egressWalk >= 60) parts.push(`<span class="badge walk">${ICON.walk}${W(j.egressWalk)}</span>`);
    const inMin = Math.round((j.leave - nowSec) / 60);
    const soon = inMin >= 0 && inMin <= 90 ? `<span class="soon">выход через ${inMin} мин</span>` : `выход ${fmtTime(j.leave)}`;
    let h = `<div class="card res" data-k="${k}">
      <div class="res-head"><div class="res-time">${fmtTime(j.leave)}<span class="arrow"> → </span>${fmtTime(j.arrive)}</div><span class="pill">${fmtDur(j.arrive - j.leave)}</span></div>
      <div class="res-sub"><div class="res-chips">${parts.join('<span class="sep">›</span>')}</div>
      <div class="res-meta">${soon} · ${j.transfers ? j.transfers + ' перес.' : 'без пересадок'}${mode === 'arr' ? ` · <b class="spare">запас ${Math.round((deadline - j.arrive) / 60)} мин</b>` : ''}</div></div>`;
    const th = ticketHint(net, rides, midnight, getTicket());
    if (th) h += `<div class="tkhint ${th.ok ? '' : 'bad'}">🎫 ${esc(th.text)}</div>`;
    const near = marksNear(j);
    if (near.length) h += `<div class="warn">${ICON.shield}<span>Недавно отмечали контролёров: ${near.slice(0, 3).map(esc).join(', ')}</span></div>`;
    // таймлайн
    let tl = '';
    const row = (t, railCls, c, node, content, tcls = '') => `<div class="t ${tcls}">${t}</div><div class="rail ${railCls}" style="--c:${c}">${node}</div><div class="c">${content}</div>`;
    if (j.accessWalk >= 60) tl += `<div class="tl">${row(fmtTime(j.leave), 'walk first', 'var(--walk)', '<span class="node" style="--c:var(--walk)"></span>', `<b>Старт</b><div class="walk-info">${ICON.walk} пешком ~${W(j.accessWalk)} мин</div>`)}</div>`;
    j.legs.forEach((l, li) => {
      if (l.type === 'walk') { tl += `<div class="tl">${row(fmtTime(l.start), 'walk', 'var(--walk)', '', `<div class="walk-info">${ICON.walk} пешком ${W(l.dur)} мин до «${esc(net.name[l.to])}»</div>`, 'mute')}</div>`; return; }
      const i = legInfo(net, l), col = M.CAT[i.cat].color;
      const first = li === 0 && j.accessWalk < 60, last = li === j.legs.length - 1 && j.egressWalk < 60;
      let x = `<div class="tl">`;
      x += row(fmtTime(l.dep), first ? 'first' : '', col, `<span class="node"></span>`,
        `<b>${esc(i.from)}</b><div class="ride-info">${badge(i.cat, i.short || i.route)}${i.short && i.route !== i.short ? esc(i.route) : ''}${i.head && !i.route.endsWith(i.head) ? ' → ' + esc(i.head) : ''}</div>` +
        (i.stops.length > 2 ? `<div class="more">${i.stops.length - 2} ост. по пути ${ICON.chevron}</div>` : `<div class="more" style="color:var(--mute)">без остановок</div>`));
      x += `<div class="stops">` + i.stops.slice(1, -1).map(s => row(fmtTime(s.arr), '', col, '<span class="node sm"></span>', `<div class="mid">${esc(net.name[s.stop])}</div>`, 'mute')).join('') + `</div>`;
      x += row(fmtTime(l.arr), last ? 'last' : '', col, `<span class="node"></span>`, `<b>${esc(i.to)}</b>${i.lastOfTrip && (!i.head || i.head.split(' (')[0].endsWith(i.to)) ? '<span class="term">конечная</span>' : ''}`);
      tl += x + `</div>`;
    });
    if (j.egressWalk >= 60) tl += `<div class="tl">${row(fmtTime(j.arrive), 'walk last', 'var(--walk)', '<span class="node" style="--c:var(--trolley)"></span>', `<div class="walk-info">${ICON.walk} пешком ~${W(j.egressWalk)} мин</div><b>Финиш</b>`)}</div>`;
    h += `<div class="legs">${tl}</div><div class="actions"><button class="btn small" data-act="map">${ICON.map} На карте</button><button class="btn small primary" data-act="remind">${ICON.bell} Напоминать</button></div></div>`;
    return h;
  }).join('') + `<p class="hint small">${ms != null ? 'Найдено за ' + ms + ' мс · ' : ''}время по расписанию</p>`;
  document.querySelectorAll('.res').forEach(card => {
    const j = js[+card.dataset.k];
    card.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]'), act = btn && btn.dataset.act;
      if (act === 'map') {
        showTab('map'); M.showJourney(net, j, lastResults.from, lastResults.to);
        const d = new Date(), today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        if (lastResults.midnight.getTime() === today && Date.now() < today + j.arrive * 1000) {
          const rides = ridesOf(j);
          trackedManual = { midnight: lastResults.midnight, arrive: j.arrive, from: lastResults.from, to: lastResults.to, deadline: lastResults.deadline, legs: j.legs.filter(l => l.type === 'ride').map((l, k) => ({ trip: l.trip, shift: l.shift, i0: l.i0, dep: l.dep, arr: l.arr, i1off: rides[k].i1off })) };
          setTimeout(() => M.setVehicleFollow(true), 600);
          ticketJourneyNotes(net, trackedManual).catch(() => {}); pollNow();
        }
        return;
      }
      if (act === 'remind') { remindSheet(j); return; }
      const more = e.target.closest('.more'); if (more) { more.closest('.tl').classList.toggle('show'); return; }
      if (e.target.closest('.legs')) return;
      card.classList.toggle('open');
    });
  });
  const first = document.querySelector('.res'); if (first) first.classList.add('open');
}

// ---------------- напоминания
const DAYN = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
function newPlanId() { const id = (LS.get('planSeq', 0) % 200000) + 1; LS.set('planSeq', id); return id; }
function planTitle(p) { return `${p.from.label.replace(/^📍 |^📌 /, '')} → ${p.to.label.replace(/^📍 |^📌 /, '')}`; }

function remindSheet(j) {
  const { midnight } = lastResults;
  const wd = (midnight.getDay() + 6) % 7;
  const b = sheet(`<h3>Напоминать об этой поездке</h3>
    <p class="hint">Выход ${fmtTime(j.leave)}, прибытие ${fmtTime(j.arrive)}. ${EMBED ? 'На этой веб-странице уведомления придут, только пока она открыта; в APK — даже если приложение закрыто.' : 'Уведомления придут по расписанию, даже если приложение закрыто.'}</p>
    <button class="btn primary wide" id="rOnce">Только эту поездку (${midnight.toLocaleDateString('ru-RU')})</button>
    <h3 style="margin-top:16px">Или регулярно</h3>
    <p class="hint">Каждый выбранный день — ${lastResults.mode === 'arr' ? 'самый поздний выезд, который успевает к ' + $('#timeInput').value : 'первый вариант с отправлением после ' + $('#timeInput').value}.</p>
    <div class="days">${DAYN.map((d, i) => `<label><input type="checkbox" value="${i}" ${i === wd ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
    <button class="btn wide" id="rRepeat">Сохранить регулярную поездку</button>
    <button class="btn ghost wide" id="rClose">Отмена</button>
    <h3 style="margin-top:16px">Как будут выглядеть уведомления</h3>
    <div class="nprev">${journeyNotifications(net, j, midnight, 0, settings).map(n => `<div class="nitem ${n.channel === 'trasa-stops' ? 'quiet' : ''}"><div class="nt"><b>Trasa</b><span>${n.at.toTimeString().slice(0, 5)}</span></div><div class="ntitle">${esc(n.title)}</div><div class="nbody">${esc(n.body)}</div></div>`).join('')}</div>`);
  b.querySelector('#rClose').onclick = closeSheet;
  b.querySelector('#rOnce').onclick = async () => {
    await P.notifInit();
    const id = newPlanId();
    const items = journeyNotifications(net, j, midnight, id * 10000, settings);
    const n = await P.schedule(items);
    plans.push({ id, kind: 'once', from: epSave(lastResults.from), to: epSave(lastResults.to), date: midnight.getTime(), leave: j.leave, arrive: j.arrive,
      summary: summary(j), rides: ridesOf(j), deadline: lastResults.deadline, created: Date.now() });
    savePlans(); closeSheet(); toast(`Готово: ${n} уведомлений запланировано`);
  };
  b.querySelector('#rRepeat').onclick = async () => {
    const days = Array.from(b.querySelectorAll('.days input:checked')).map(i => +i.value);
    if (!days.length) { toast('Выберите дни'); return; }
    await P.notifInit();
    const p = { id: newPlanId(), kind: 'repeat', days, time: $('#timeInput').value, mode: lastResults.mode, from: epSave(lastResults.from), to: epSave(lastResults.to), created: Date.now() };
    plans.push(p); savePlans();
    const n = await scheduleRepeat(p);
    closeSheet(); toast(`Регулярная поездка сохранена: ${n} уведомлений на неделю вперёд`);
  };
}
function ridesOf(j) {
  return j.legs.filter(l => l.type === 'ride').map(l => {
    const r = net.tripRoute[l.trip];
    return { route: net.routeName[r], short: net.routeShort[r], from: net.ltName[net.stStop[l.i0]], dep: l.dep, shift: l.shift, arr: l.arr, i1off: l.i1 - l.i0 };
  });
}
// ---- слежение «где мой автобус»
let trackedManual = null;
const trackCache = new Map();
function resolveRides(key, midnight, rides, extra = {}) {
  if (trackCache.has(key)) return trackCache.get(key);
  const legs = [];
  for (const r of rides || []) {
    const f = findTrip(net, { route: r.route, short: r.short, from: r.from, dep: r.dep - (r.shift || 0) });
    if (!f) { trackCache.set(key, null); return null; }
    legs.push({ trip: f.trip, shift: r.shift || 0, i0: f.i0, dep: r.dep, arr: r.arr, i1off: r.i1off });
  }
  const res = legs.length ? { midnight, legs, ...extra } : null;
  if (res) ticketJourneyNotes(net, res).catch(() => {});
  trackCache.set(key, res); return res;
}
function getTracked() {
  if (!net) return null;
  const now = Date.now();
  if (trackedManual) {
    const end = trackedManual.midnight.getTime() + trackedManual.arrive * 1000 + 60000;
    if (now <= end) return trackedManual; else trackedManual = null;
  }
  const d = new Date(); const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  for (const p of plans) {
    if (p.hideTrack && now - p.hideTrack < 3 * 3600000) continue;
    const occ = p.kind === 'once' ? [{ date: p.date, leave: p.leave, arrive: p.arrive, rides: p.rides, deadline: p.deadline }] : (p.next || []);
    for (const o of occ) {
      if (o.date !== today || !o.rides) continue;
      if (now < today + (o.leave - 15 * 60) * 1000 || now > today + o.arrive * 1000 + 60000) continue;
      return resolveRides(p.id + ':' + o.date, new Date(today), o.rides, { from: p.from, to: p.to, deadline: o.deadline || null, planId: p.id, planKind: p.kind, dayIdx: o.dayIdx });
    }
  }
  return null;
}
function rideBanner(tr, notFollowing) {
  const el = $('#rideBanner'); if (!el) return;
  if (!tr) { el.classList.remove('on'); return; }
  const leg = tr.leg, r = net.tripRoute[tr.trip], i = legInfo(net, { trip: tr.trip, shift: tr.shift, i0: leg.i0, i1: Math.min(net.tripOff[tr.trip + 1] - 1, leg.i0 + (leg.i1off || 999)) });
  const nm = net.routeShort[r] || net.routeName[r];
  const d = tr.live ? tr.delay : 0;
  const dchip = tr.live ? (d >= 60 ? ` <span class="dl ${d >= 300 ? 'bad' : ''}">+${Math.round(d / 60)} мин</span>` : ' <span class="dl ok">по графику</span>') : '';
  const from = esc(net.name[net.stStop[leg.i0]]);
  let body = tr.waiting
    ? (tr.live ? `Едет к вам: на «${from}» ~${fmtTime(leg.dep + Math.max(0, d))}${dchip}` : `Ещё не отправился · ${fmtTime(leg.dep)} с «${from}»`)
    : `${tr.dwell ? 'Стоит' : 'Следующая'}: «${esc(net.name[net.stStop[tr.next]])}» ${tr.live ? '~' : 'в '}${fmtTime(tr.nextArr)}${dchip}`;
  const tk = getTicket();
  if (tk) { const left = Math.round((tk.end - Date.now()) / 60000); body += ` · <span class="dl ${left <= 5 ? 'bad' : 'tk'}">🎫 ${left > 0 ? 'ещё ' + left + ' мин' : 'билет кончился'}</span>`; }
  el.innerHTML = `<div class="rb-main"><div class="rb-title"><span class="badge ${net.routeCat[r]}">${esc(nm)}</span> → ${esc(i.to)} ${tr.live && d >= 60 ? '~' + fmtTime(leg.arr + d) : 'в ' + fmtTime(leg.arr)}</div>${body}</div>
    ${notFollowing ? '<button class="btn small" id="rbFollow">◎ Следить</button>' : ''}<button class="btn small ghost" id="rbClose">✕</button>`;
  el.classList.add('on');
  const f = el.querySelector('#rbFollow'); if (f) f.onclick = () => M.setVehicleFollow(true);
  el.querySelector('#rbClose').onclick = () => { trackedManual = null; for (const p of plans) p.hideTrack = Date.now(); el.classList.remove('on'); M.setVehicleFollow(false); };
}
// ---- смена маршрута при заторе: самый ранний по приезду вариант, который объезжает затор
let lastReroute = 0;
const REROUTE_PLAN = 200003;
function rerouteHook(tr, info) {
  if (!net || !tr.to || Date.now() - lastReroute < 5 * 60000) return;
  const now = info.now, legs = tr.legs;
  if (legs[legs.length - 1].arr - now < 6 * 60) return;
  const k0 = legs.findIndex(l => { const x = info.matched.get(l.trip); return now <= l.arr + (x ? Math.max(0, x.delay) : 0) + 60; }); if (k0 < 0) return;
  const leg = legs[k0], m = info.matched.get(leg.trip);
  let access, tStart, where, exitIdx = -1;
  if (now < leg.dep - 30 && (!m || m.seg < leg.i0)) {
    where = k0 === 0 ? 'start' : 'transfer';
    access = k0 === 0 ? resolveStops(tr.from) : [{ stop: net.stStop[leg.i0], walk: 0 }];
    tStart = now;
  } else {
    if (!m || m.seg < leg.i0) return; // без GPS не знаем, где именно автобус
    exitIdx = m.seg + 1;
    if (exitIdx >= leg.i0 + (leg.i1off || 0)) return;
    where = 'ride'; access = [{ stop: net.stStop[exitIdx], walk: 0 }];
    tStart = net.stArr[exitIdx] + m.shift + Math.max(0, m.delay);
  }
  if (!access.length) return;
  let js;
  try { js = plan(net, tr.midnight, Math.round(tStart), access, resolveStops(tr.to), { buffer: settings.buffer * 60, count: 5, windowH: 3 }); } catch (e) { return; }
  const jam = new Set(info.jams.map(j => j.key));
  let best = null, bestEta = Infinity;
  for (const j of js) {
    const rides = j.legs.filter(l => l.type === 'ride'); if (!rides.length) continue;
    let bad = false;
    for (const l of rides) for (let i = l.i0; i < l.i1 && !bad; i++) if (jam.has(net.name[net.stStop[i]] + '>' + net.name[net.stStop[i + 1]])) bad = true;
    if (bad) continue;
    const fm = info.matched.get(rides[0].trip), e = j.arrive + (fm && fm.delay > 0 ? fm.delay : 0);
    if (e < bestEta) { bestEta = e; best = j; }
  }
  if (!best || bestEta > info.eta - 180) return; // выигрыш меньше 3 минут — не дёргаем
  lastReroute = Date.now();
  const rides = best.legs.filter(l => l.type === 'ride');
  const newLegs = rides.map(l => ({ trip: l.trip, shift: l.shift, i0: l.i0, dep: l.dep, arr: l.arr, i1off: l.i1 - l.i0 }));
  if (where === 'ride') newLegs.unshift({ trip: leg.trip, shift: leg.shift, i0: leg.i0, dep: leg.dep, arr: Math.round(tStart), i1off: exitIdx - leg.i0 });
  trackedManual = { midnight: tr.midnight, arrive: best.arrive, from: tr.from, to: tr.to, deadline: tr.deadline, legs: newLegs, rerouted: true };
  const f = legInfo(net, rides[0]), nm = f.short || f.route;
  const walk = f.from !== net.name[access[0].stop] ? ` (пешком к «${f.from}»)` : '';
  const tail = `Приедете ~${fmtTime(bestEta)} вместо ~${fmtTime(info.eta)}` + (tr.deadline ? (bestEta <= tr.deadline ? `, успеваете к ${fmtTime(tr.deadline)}.` : `, к ${fmtTime(tr.deadline)} всё равно не успеть, но так быстрее.`) : '.');
  const body = where === 'ride'
    ? `Выйдите на «${net.name[net.stStop[exitIdx]]}» (~${fmtTime(tStart)}), дальше ${nm} в ${fmtTime(rides[0].dep)} с «${f.from}»${walk}. ${tail}`
    : `Вместо прежнего: ${nm} в ${fmtTime(rides[0].dep)} с «${f.from}»${walk}` + (rides.length > 1 ? `, ${rides.length - 1} перес.` : '') + `. ${tail}`;
  liveSay('reroute:' + lastReroute, 'Маршрут изменён: затор на пути', body, 0);
  // старые уведомления по расписанию этой поездки → новые
  (async () => {
    if (tr.planId) await P.cancelWhere(id => Math.floor(id / 10000) === tr.planId && (tr.planKind === 'once' || Math.floor((id % 10000) / 1000) === tr.dayIdx));
    await P.cancelPlan(REROUTE_PLAN);
    await P.schedule(journeyNotifications(net, best, tr.midnight, REROUTE_PLAN * 10000, settings));
  })().catch(() => {});
  if (document.querySelector('#page-map.active')) M.showJourney(net, best, null, tr.to);
}
function renderTicketBar() {
  const el = $('#ticketBar'); if (!el) return;
  const t = getTicket();
  if (t) {
    const left = Math.ceil((t.end - Date.now()) / 60000);
    el.innerHTML = `<span class="tk-ico">🎫</span><div class="tk-main"><b>${t.min}-минутный билет</b><span>${left > 0 ? `ещё ${left} мин · до ${new Date(t.end).toTimeString().slice(0, 5)}` : 'закончился'}</span></div><button class="btn small ghost" id="tkClear">Сбросить</button>`;
    el.className = 'ticket-bar on' + (left <= 5 ? ' low' : '');
    el.querySelector('#tkClear').onclick = async () => { await clearTicket(); renderTicketBar(); if (lastResults) renderResults(); };
  } else {
    el.innerHTML = `<span class="tk-ico">🎫</span><div class="tk-main"><b>Активировали билет в JUDU?</b><span>Напомню, когда он будет кончаться</span></div><button class="btn small" data-tk="30">30 мин</button><button class="btn small" data-tk="60">60 мин</button>`;
    el.className = 'ticket-bar';
    el.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => ticketSheet(+b.dataset.tk));
  }
}
function ticketSheet(min) {
  const b = sheet(`<h3>${min}-минутный билет</h3>
    <p class="hint">Trasa не видит JUDU — отметьте, когда активировали. Напомню за 5 и за 1 минуту до конца, а если вы едете по маршруту — предупрежу, если билет кончится в пути или до пересадки.</p>
    <div class="tk-ago">${[0, 2, 5, 10, 15].map(a => `<button class="btn ${a ? '' : 'primary'}" data-ago="${a}">${a ? a + ' мин назад' : 'Только что'}</button>`).join('')}</div>
    <button class="btn ghost wide" id="tkCancel">Отмена</button>`);
  b.querySelector('#tkCancel').onclick = closeSheet;
  b.querySelectorAll('[data-ago]').forEach(x => x.onclick = async () => {
    const t = await activateTicket(min, Date.now() - +x.dataset.ago * 60000);
    closeSheet(); renderTicketBar(); if (lastResults) renderResults();
    const tr = getTracked(); if (tr) ticketJourneyNotes(net, tr).catch(() => {});
    toast(`Билет до ${new Date(t.end).toTimeString().slice(0, 5)} — напомню заранее`);
  });
}
setInterval(renderTicketBar, 20000);
setTimeout(renderTicketBar, 0);
function summary(j) {
  return j.legs.filter(l => l.type === 'ride').map(l => { const i = legInfo(net, l); return { cat: i.cat, name: i.short || i.route }; });
}

async function scheduleRepeat(p) {
  if (!net) return 0;
  await P.cancelPlan(p.id);
  const [hh, mm] = p.time.split(':').map(Number), t0 = hh * 3600 + mm * 60;
  const now = new Date(); let total = 0; p.next = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    if (!p.days.includes((day.getDay() + 6) % 7)) continue;
    let js;
    try { js = p.mode === 'arr' ? findArriveBy(p.from, p.to, day, t0, 1) : findJourneys(p.from, p.to, day, t0, 1); } catch (e) { continue; }
    const j = js[0]; if (!j) continue;
    if (day.getTime() + j.leave * 1000 < Date.now()) continue;
    total += await P.schedule(journeyNotifications(net, j, day, p.id * 10000 + d * 1000, settings));
    p.next.push({ date: day.getTime(), leave: j.leave, arrive: j.arrive, summary: summary(j), rides: ridesOf(j), deadline: p.mode === 'arr' ? t0 : null, dayIdx: d });
  }
  p.scheduledAt = Date.now(); savePlans();
  return total;
}
async function refreshRepeatPlans(force = false) {
  // одноразовые прошедшие — убрать через сутки
  const now = Date.now();
  plans = plans.filter(p => p.kind !== 'once' || p.date + p.arrive * 1000 + 86400000 > now);
  savePlans();
  for (const p of plans) if (p.kind === 'repeat' && (force || !p.scheduledAt || now - p.scheduledAt > 6 * 3600000)) await scheduleRepeat(p);
}

async function renderPlans() {
  const el = $('#plansList');
  if (!plans.length) { el.innerHTML = '<div class="card empty">Пока нет поездок.<br>Найдите маршрут и нажмите «⏰ Напоминать».</div>'; return; }
  const rows = [];
  for (const p of plans) {
    const cnt = await P.pendingCount(p.id).catch(() => '?');
    const chips = s => (s || []).map(x => `<span class="badge ${x.cat}">${esc(x.name)}</span>`).join('');
    let sub;
    if (p.kind === 'once') sub = `${new Date(p.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })} · выход ${fmtTime(p.leave)} → ${fmtTime(p.arrive)}<br>${chips(p.summary)}`;
    else sub = `Каждые ${p.days.map(d => DAYN[d]).join(', ')} после ${p.time}` + ((p.next || []).length ? `<br>Ближайшая: ${new Date(p.next[0].date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })} выход ${fmtTime(p.next[0].leave)} ${chips(p.next[0].summary)}` : '<br>На ближайшую неделю рейсов не найдено');
    rows.push(`<div class="card plan"><span class="kind">${p.kind === 'once' ? 'разовая' : 'регулярная'}</span><div class="title">${esc(planTitle(p))}</div><div class="sub">${sub}</div>
      <div class="sub">Запланировано уведомлений: ${cnt}</div>
      <div class="actions">${p.kind === 'repeat' ? `<button class="btn small" data-re="${p.id}">Пересчитать</button>` : ''}
      <button class="btn small" data-show="${p.id}">Открыть маршрут</button>
      <button class="btn small danger" data-del="${p.id}">Удалить</button></div></div>`);
  }
  el.innerHTML = rows.join('');
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const id = +b.dataset.del; await P.cancelPlan(id); plans = plans.filter(p => p.id !== id); savePlans(); renderPlans(); toast('Удалено');
  });
  el.querySelectorAll('[data-re]').forEach(b => b.onclick = async () => {
    const p = plans.find(p => p.id === +b.dataset.re); const n = await scheduleRepeat(p); renderPlans(); toast(`Пересчитано: ${n} уведомлений`);
  });
  el.querySelectorAll('[data-show]').forEach(b => b.onclick = () => {
    const p = plans.find(p => p.id === +b.dataset.show);
    setEp('from', p.from); setEp('to', p.to);
    const d = new Date(p.kind === 'once' ? p.date : Date.now());
    $('#dateInput').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (p.kind === 'once') $('#timeInput').value = fmtTime(Math.max(0, p.leave - 60)); else $('#timeInput').value = p.time;
    showTab('route'); $('#searchBtn').click();
  });
}

// ---------------- карта
function routePopup(r, ll) {
  const cat = net.routeCat[r];
  L.popup().setLatLng(ll).setContent(`<span class="badge ${cat}">${esc(net.routeShort[r] || '')}</span> ${esc(net.routeName[r])}<br><small>${M.CAT[cat].name}</small>`).openOn(M_map());
}
function stopPopup(s) {
  const routes = net.stopRoutes[s];
  L.popup().setLatLng([net.lat[s], net.lon[s]]).setContent(`<b>${esc(net.name[s])}</b>${net.name[s] !== net.ltName[s] ? `<br><small>${esc(net.ltName[s])}</small>` : ''}<br>${routeChips(routes, 12)}
    <div style="margin-top:6px"><button class="btn small" id="pFrom">Отсюда</button> <button class="btn small" id="pTo">Сюда</button></div>`).openOn(M_map());
  setTimeout(() => {
    const g = net.groups.find(g => g.stops.includes(s));
    const e = g ? groupEp(g) : { type: 'point', label: net.name[s], lat: net.lat[s], lon: net.lon[s] };
    const a = document.getElementById('pFrom'), b = document.getElementById('pTo');
    if (a) a.onclick = () => { setEp('from', e); M_map().closePopup(); toast('Начало: ' + e.label); };
    if (b) b.onclick = () => { setEp('to', e); M_map().closePopup(); showTab('route'); };
  }, 50);
}
let _map = null; const M_map = () => _map;
function initMapUI() {
  _map = M.initMap($('#map'));
  const chips = $('#catChips');
  const vis = LS.get('catVis', {});
  chips.innerHTML = Object.entries(M.CAT).map(([k, c]) => `<button class="chip ${vis[k] === false ? 'off' : ''}" data-cat="${k}"><i style="background:${c.color}"></i>${c.name}</button>`).join('');
  chips.querySelectorAll('.chip').forEach(b => {
    if (vis[b.dataset.cat] === false) M.setCatVisible(b.dataset.cat, false);
    b.onclick = () => { const on = b.classList.toggle('off') === false; vis[b.dataset.cat] = on; LS.set('catVis', vis); M.setCatVisible(b.dataset.cat, on); };
  });
  const addMark = ll => {
    const b = sheet(`<h3>Контролёры здесь?</h3><p class="hint">Отметка хранится только на этом телефоне и исчезнет через ${settings.markHours} ч.</p>
      <input id="mNote" placeholder="Заметка (необязательно): напр. «в 3G к центру»">
      <div class="actions"><button class="btn primary" id="mOk">Отметить</button><button class="btn" id="mNo">Отмена</button></div>`);
    b.querySelector('#mNo').onclick = closeSheet;
    b.querySelector('#mOk').onclick = () => { marks.push({ lat: ll.lat, lon: ll.lng, ts: Date.now(), note: b.querySelector('#mNote').value.trim() }); saveMarks(); drawMarks(); closeSheet(); toast('Отмечено'); };
  };
  M.onLongPress(addMark);
  $('#ctrlFab').onclick = () => { toast('Нажмите на карту, где стоят контролёры'); M.pickPoint(addMark); };
  $('#locFab').onclick = async () => { try { const p = await P.getPosition(); M.flyTo(p.lat, p.lon); } catch (e) { toast('GPS недоступен'); } };
  drawMarks();
}
function drawMarks() {
  marks = marks.filter(m => Date.now() - m.ts < 24 * 3600000); saveMarks();
  M.drawMarks(marks, settings.markHours, ts => { marks = marks.filter(m => m.ts !== ts); saveMarks(); drawMarks(); });
}

// ---------------- данные
function fmtDate(n) { if (!n) return '—'; const s = String(n); return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`; }
function renderFeeds() {
  if (EMBED) {
    const m = feedMeta[EMBED.id] || { counts: {} }, v = feedMeta.vrap || { counts: {} };
    $('#updateRow').style.display = 'none';
    $('#feedsList').innerHTML = `<div class="card"><div class="data-hero"><span class="logo" style="transform:scale(1.4);margin:0 6px"><i></i><i></i><i></i></span><div><b>Вильнюс — городской транспорт</b><div class="hint" style="margin:2px 0 0">Расписание ${esc(EMBED.source)} от ${EMBED.date.split('-').reverse().join('.')} встроено в страницу</div></div></div>
      <div class="stats"><div><b>${m.counts.routes || '—'}</b><span>линий</span></div><div><b>${(m.counts.stops || 0).toLocaleString('ru-RU')}</b><span>остановок</span></div><div><b>${(m.counts.trips || 0).toLocaleString('ru-RU')}</b><span>рейсов</span></div></div></div>
      <div class="card"><div class="data-hero"><span class="badge intercity">171</span><div><b>VRAP — направление Неменчине</b><div class="hint" style="margin:2px 0 0">Линии 171 (через Sakiškės тоже), 148, 154, 157, 158, 160 · ${v.counts.trips || 0} рейсов · ${v.counts.stops || 0} остановок</div></div></div>
      <p class="hint" style="margin:10px 0 0">Собрано вручную из таблиц vrap.lt: время отправления — с таблиц конечных (Nemenčinės pl. от 01.03.2026, Nemenčinė от 01.02.2026), время в пути — по таблицам остановок (2022–2024), поэтому на промежуточных остановках возможна разница ±5 мин (как и пишет сам VRAP). Рейсы со * ходят только в учебное время школ — каникулы учтены приблизительно. Координаты деревень приблизительные.</p></div>
      <div class="card"><div class="data-hero"><span class="badge intercity">Švenčionys</span><div><b>Švenčionys / Visaginas / Molėtai – Pabradė – Vilnius</b><div class="hint" style="margin:2px 0 0">Transporto centras, Meteorit turas, Seknija · ${(feedMeta.svtxt || { counts: {} }).counts.trips || 0} рейсов</div></div></div>
      <p class="hint" style="margin:10px 0 0">По тексту страницы svencionys.lt. Официальны только отправления из Švenčionys, Pabradė и Vilniaus AS; местные рейсы Transporto centras проведены через Nemenčinės pl., Неменчине и деревни линии 160 (Girininkija, Pakrauglė, Raudondvaris, Miškiniai, Pailgė) — время на этих остановках рассчитано (± до 10 мин). Рейсы на Visaginas (Meteorit/Seknija) в Неменчине не заезжают: Vilnius, Pailgė, Pabradė и дальше до Ignalina и Visaginas (участок за Švenčionys и время выезда из Visaginas — расчётные). Добавлены короткие рейсы Švenčionys–Pabradė, Pabradė–Zalavas и Molėtai–Pabradė (время в пути ~60 мин — расчётное). Рейс TOKS (Vilnius–Visaginas) не включён — по тексту его движение остановлено с 01.09.2026.</p></div>
      <div class="card"><div class="data-hero"><span class="badge train">Поезда</span><div><b>LTG Link — 5 линий через край</b><div class="hint" style="margin:2px 0 0">Turmantas (Pabradė, Švenčionėliai), Trakai, Marcinkonys (Lentvaris, Rūdiškės), аэропорт – Jašiūnai, Kena · ${(feedMeta.railtxt || { counts: {} }).counts.trips || 0} поездов</div></div></div>
      <p class="hint" style="margin:10px 0 0">По годовым PDF LTG Link (с 14.12.2025) и отправлениям из Naujoji Vilnia (Kena). Весной 2026 часть линий обновлялась — сверяйте с ltglink.lt. Дни курсирования некоторых поездов в PDF не читаются — считаются ежедневными. Линии Vilnius–Kaunas (Lentvaris, Vievis) здесь нет, в APK она придёт из полного файла LTG Link.</p></div>
      <div class="card"><b>Чего нет в этой версии</b><p class="hint" style="margin:6px 0 0">Линий 163 (Eitminiškės), 146 (Skirgiškės), 172/174 и рейсов в Вильнюс через Ąžulaukė/Pranciškonys/Pašiliai — для них нет таблиц с остановками. Нет остальных междугородних (кроме Швянчёниса) и поезда Vilnius–Kaunas. Уведомления и GPS работают только в APK.</p></div>`;
    return;
  }
  $('#feedsList').innerHTML = FEEDS.map(f => {
    const m = feedMeta[f.id];
    const st = m ? `обновлено ${new Date(m.importedAt).toLocaleDateString('ru-RU')} · ${m.counts.routes} линий, ${m.counts.trips} рейсов · действует до ${fmtDate(m.dateRange[1])}` : 'не скачано';
    return `<div class="card feed"><input type="checkbox" data-feed="${f.id}" ${settings.feeds[f.id] ? 'checked' : ''}>
      <div class="info"><b>${esc(f.title)}</b>${f.exp ? `<span class="exp">${esc(f.exp)}</span>` : ''}<div class="st">${st}</div>
      <div class="actions"><button class="btn small" data-dl="${f.id}">Скачать</button><label class="btn small" style="margin:0;color:var(--ink)">ZIP с телефона<input type="file" accept=".zip,application/zip" data-up="${f.id}" hidden></label></div></div></div>`;
  }).join('');
  document.querySelectorAll('[data-feed]').forEach(c => c.onchange = async () => { settings.feeds[c.dataset.feed] = c.checked; saveSettings(); await loadNetwork(); });
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => updateFeeds([b.dataset.dl]));
  document.querySelectorAll('[data-up]').forEach(inp => inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    const f = FEEDS.find(x => x.id === inp.dataset.up);
    try { log(`[${f.title}] читаю файл ${file.name}…`); await importAndStore(f, await file.arrayBuffer()); settings.feeds[f.id] = true; saveSettings(); await loadNetwork(); renderFeeds(); }
    catch (e) { log('Ошибка: ' + e.message); }
  });
}
async function importAndStore(f, buf) {
  log(`[${f.title}] ${(buf.byteLength / 1e6).toFixed(1)} МБ, разбираю…`);
  let last = '';
  const data = await importGtfs(buf, { id: f.id, kind: f.kind, filter: f.filter, radiusKm: 40 }, m => { if (m !== last) { last = m; $('#netStatus').textContent = m; } });
  await feedStore.put('feeds', f.id, data);
  feedMeta[f.id] = { importedAt: data.importedAt, counts: data.counts, dateRange: data.dateRange };
  LS.set('feedMeta', feedMeta);
  log(`[${f.title}] готово: ${data.counts.routes} линий, ${data.counts.trips} рейсов, ${data.counts.stops} остановок`);
}
async function updateFeeds(ids) {
  const btn = $('#updateBtn'); btn.disabled = true;
  for (const id of ids) {
    const f = FEEDS.find(x => x.id === id);
    try {
      log(`[${f.title}] скачиваю ${f.url}`);
      const buf = await P.download(f.url, (frac, bytes) => { $('#netStatus').textContent = `Скачивание ${frac ? Math.round(frac * 100) + '%' : (bytes / 1e6).toFixed(1) + ' МБ'}`; });
      await importAndStore(f, buf);
    } catch (e) {
      log(`[${f.title}] ошибка: ${e.message || e}` + (P.isNative ? '' : '\n  (в браузере сайты часто блокируют скачивание — CORS. В APK работает. Или загрузите ZIP вручную.)'));
    }
  }
  btn.disabled = false;
  await loadNetwork(); renderFeeds();
}
$('#updateBtn').onclick = () => updateFeeds(FEEDS.filter(f => settings.feeds[f.id]).map(f => f.id));

// настройки
$('#setPerStop').checked = settings.perStop; $('#setBuffer').value = settings.buffer; $('#setWalk').value = settings.maxWalk;
$('#setMarkH').value = settings.markHours; $('#setScope').value = settings.scope;
$('#setPerStop').onchange = e => { settings.perStop = e.target.checked; saveSettings(); refreshRepeatPlans(true); };
$('#setBuffer').onchange = e => { settings.buffer = Math.max(0, +e.target.value || 0); saveSettings(); };
$('#setWalk').onchange = e => { settings.maxWalk = Math.max(200, +e.target.value || 1200); saveSettings(); };
$('#setMarkH').onchange = e => { settings.markHours = Math.max(1, +e.target.value || 3); saveSettings(); drawMarks(); };
$('#setScope').onchange = async e => { settings.scope = e.target.value; saveSettings(); await loadNetwork(); };
$('#testNotif').onclick = async () => {
  await P.notifInit();
  await P.schedule([{ id: 999999990 % 2147483647, at: new Date(Date.now() + 10000), title: 'Trasa: тест', body: 'Уведомления работают 👍' }]);
  toast('Уведомление придёт через 10 секунд — можно свернуть приложение');
};
$('#exactBtn').onclick = async () => { await P.openExactAlarmSettings(); showExact(); };
async function showExact() {
  const s = await P.exactAlarmStatus();
  $('#exactStatus').textContent = s === null ? '' : (s === 'granted' ? 'Точные будильники разрешены — уведомления придут минута в минуту.' : 'Точные будильники НЕ разрешены: Android может задерживать уведомления. Нажмите «Точные будильники…» и разрешите.');
}

// редактор названий
$('#nameSearch').addEventListener('input', e => {
  if (!net) return;
  const q = norm(e.target.value); if (q.length < 2) { $('#nameList').innerHTML = ''; return; }
  const seen = new Set(), rows = [];
  for (let s = 0; s < net.nStops && rows.length < 30; s++) {
    const lt = net.ltName[s]; if (seen.has(lt)) continue;
    if (norm(lt).includes(q) || norm(net.name[s]).includes(q)) { seen.add(lt); rows.push(s); }
  }
  $('#nameList').innerHTML = rows.map(s => `<div class="namerow"><div>${esc(net.name[s])}<small>${esc(net.ltName[s])}${settings.overrides[net.ltName[s]] ? ' · своё название' : ''}</small></div><button class="btn small" data-s="${s}">Изменить</button></div>`).join('');
  $('#nameList').querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
    const s = +b.dataset.s, lt = net.ltName[s];
    const auto = stopDisplayName(lt, net.lat[s], net.lon[s], settings.scope, {});
    const sh = sheet(`<h3>Название остановки</h3><p class="hint">Литовское: ${esc(lt)}<br>Автоматически: ${esc(auto)}</p>
      <input id="nmIn" value="${esc(net.name[s])}"><div class="actions"><button class="btn primary" id="nmOk">Сохранить</button><button class="btn" id="nmReset">Сбросить</button><button class="btn ghost" id="nmNo">Отмена</button></div>`);
    sh.querySelector('#nmNo').onclick = closeSheet;
    sh.querySelector('#nmOk').onclick = async () => { const v = sh.querySelector('#nmIn').value.trim(); if (v) settings.overrides[lt] = v; saveSettings(); closeSheet(); await loadNetwork(); $('#nameSearch').dispatchEvent(new Event('input')); };
    sh.querySelector('#nmReset').onclick = async () => { delete settings.overrides[lt]; saveSettings(); closeSheet(); await loadNetwork(); $('#nameSearch').dispatchEvent(new Event('input')); };
  });
});

// ---------------- старт
async function loadDemo() {
  settings.feeds = EMBED ? Object.fromEntries(DEMO.map(d => [d.id, true])) : { vilnius: true, ltsar: true, trains: true };
  const b64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  for (const d of DEMO) {
    const f = FEEDS.find(x => x.id === d.id);
    const data = await importGtfs(b64(d.b64), { id: d.id, kind: d.kind, filter: d.filter, radiusKm: 40 }, m => { const b = document.getElementById('bootMsg'); if (b) b.textContent = m; });
    memFeeds.set(d.id, data);
    feedMeta[d.id] = { importedAt: data.importedAt, counts: data.counts, dateRange: data.dateRange };
  }
  if (!EMBED) { if (!marks.length) marks.push({ lat: 54.6990, lon: 25.2915, ts: Date.now() - 40 * 60000, note: 'двое у выхода с рынка (демо)' }); document.body.classList.add('demo'); }
}
(async function start() {
  document.querySelectorAll('[data-ico]').forEach(el => { el.innerHTML = ICON[el.dataset.ico] + el.innerHTML; });
  const bootMsg = m => { const b = $('#bootMsg'); if (b) b.textContent = m; };
  if (EMBED) {
    document.body.classList.add('embedded');
    $('#embeddedFlag').innerHTML = `${ICON.shield}<span>Вильнюс — <b>stops.lt от ${EMBED.date.split('-').reverse().join('.')}</b>; пригородные <b>VRAP</b>, <b>Švenčionys–Vilnius</b> и <b>поезда LTG Link</b> — из таблиц перевозчиков.</span>`;
    $('#credits').textContent = 'Расписание: stops.lt (Vilniaus viešasis transportas), версия ' + EMBED.date + '; VRAP — по таблицам vrap.lt. Подложка карты © OpenStreetMap contributors (ODbL).';
  }
  if (DEMO) { bootMsg('Разбираю расписание…'); await new Promise(r => setTimeout(r, 30)); try { await loadDemo(); } catch (e) { console.error(e); bootMsg('Ошибка: ' + e.message); } }
  initMapUI();
  try { await loadNetwork(); } catch (e) { console.error(e); $('#netStatus').textContent = 'Ошибка данных'; toast(e.message); }
  showExact();
  const boot = $('#boot'); if (boot) { boot.classList.add('gone'); setTimeout(() => boot.remove(), 500); }
  if (DEMO && net) {
    const a = searchGroups(net, EMBED ? 'stotis' : 'pasilaic')[0], b = searchGroups(net, 'niemenczyn')[0];
    if (a && b) { setEp('from', groupEp(a)); setEp('to', groupEp(b)); if (!EMBED) $('#timeInput').value = '07:40'; $('#searchBtn').click(); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && net) refreshRepeatPlans(); });
  window.__trasa = { get net() { return net; }, settings, plans: () => plans };
})();
