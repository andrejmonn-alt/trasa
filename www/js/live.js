// Реальное время в приложении: опрос GPS stops.lt, опоздания и заторы на нашем пути → уведомления.
import * as P from './platform.js';
import { GPS_URL, parseGps, matchVehicles, JamTracker } from './core/realtime.js';
import { fmtTime } from './core/router.js';

export const LIVE = { matched: null, at: 0, err: null, jams: [], enabled: true };
const RT_PLAN = 200002;
let net = null, hooks = {}, timer = null, busy = false, jt = new JamTracker(), nid = 0;
const sent = new Map();

export function startLive(n, h) {
  net = n; hooks = h; jt = new JamTracker(); sent.clear();
  LIVE.matched = null; LIVE.jams = [];
  clearInterval(timer); timer = setInterval(poll, 15000);
  if (!startLive._vis) { startLive._vis = true; document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); }); }
  poll();
}
export function pollNow() { poll(); }

function secNow() { const d = new Date(); return (d - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 1000; }

async function poll() {
  if (busy || !net || !LIVE.enabled) return;
  const tr = hooks.getTracked ? hooks.getTracked() : null;
  const mapOn = !!document.querySelector('#page-map.active');
  if (!tr && (!mapOn || document.hidden)) return;
  busy = true;
  try {
    const txt = await P.fetchText(GPS_URL);
    const now = secNow();
    const matched = matchVehicles(net, parseGps(txt), now);
    jt.update(net, matched, now);
    LIVE.matched = matched; LIVE.at = Date.now(); LIVE.err = null; LIVE.jams = jt.jams(net);
    if (tr) checkAlerts(tr, now);
  } catch (e) { LIVE.err = (e && e.message) || String(e); }
  finally { busy = false; if (hooks.update) hooks.update(LIVE); }
}

function say(key, title, body, minGapMs, value, valueStep) {
  const s = sent.get(key), now = Date.now();
  if (s) {
    if (valueStep !== undefined && Math.abs(value - s.value) < valueStep) return;
    if (valueStep === undefined && now - s.at < minGapMs) return;
  }
  sent.set(key, { at: now, value });
  P.schedule([{ id: RT_PLAN * 10000 + (nid++ % 9000), at: new Date(now + 6000), title, body, channel: 'trasa-main' }]).catch(() => {});
  if (hooks.alert) hooks.alert(title, body);
}

const mins = s => Math.round(s / 60);
function routeLabel(t) { const r = net.tripRoute[t]; return net.routeShort[r] || net.routeName[r]; }

function checkAlerts(tr, now) {
  const legs = tr.legs, M = LIVE.matched;
  const tt = (Date.now() - tr.midnight.getTime()) / 1000;
  const k0 = legs.findIndex(l => tt <= l.arr + 120);
  if (k0 < 0) return;
  const pathKeys = new Set();
  legs.forEach((leg, k) => {
    if (k < k0) return;
    const i1 = leg.i0 + (leg.i1off || 0);
    const m = M.get(leg.trip);
    let from = leg.i0;
    if (m && m.seg >= leg.i0) from = m.seg;
    for (let i = from; i < i1; i++) pathKeys.add(net.name[net.stStop[i]] + '>' + net.name[net.stStop[i + 1]]);
    if (k > k0 + 1 || !m) return;
    // опоздание нашего автобуса (текущий участок или тот, на который садимся)
    const d = m.delay, nm = routeLabel(leg.trip);
    const boarding = m.seg < leg.i0;
    if (d >= 120) {
      let body = boarding
        ? `Будет на «${net.name[net.stStop[leg.i0]]}» примерно в ${fmtTime(leg.dep + d)} (по расписанию ${fmtTime(leg.dep)}).`
        : `Выход на «${net.name[net.stStop[i1]]}» примерно в ${fmtTime(leg.arr + d)} вместо ${fmtTime(leg.arr)}.`;
      const nx = legs[k + 1];
      if (nx) {
        const nd = (M.get(nx.trip) || {}).delay || 0;
        if (leg.arr + d > nx.dep + nd - 60) body += ` Можете не успеть на пересадку: ${routeLabel(nx.trip)} в ${fmtTime(nx.dep + nd)}.`;
      }
      say('delay:' + leg.trip, `${nm} опаздывает на ${mins(d)} мин`, body, 0, d, 120);
    } else if (sent.has('delay:' + leg.trip) && sent.get('delay:' + leg.trip).value >= 180 && d < 60) {
      say('delay:' + leg.trip, `${nm} снова по графику`, boarding ? `Будет на «${net.name[net.stStop[leg.i0]]}» в ${fmtTime(leg.dep + Math.max(0, d))}.` : 'Опоздание наверстал.', 0, d, 120);
    }
  });
  // заторы на оставшемся пути
  for (const j of LIVE.jams) {
    if (!pathKeys.has(j.key)) continue;
    say('jam:' + j.key, 'Затор на вашем пути',
      `«${j.from}» → «${j.to}»: машины теряют ~${mins(j.loss)} мин (линии ${[...j.routes].join(', ')}). Ваш автобус может задержаться.`, 20 * 60000);
  }
}

// для плашки: опоздание конкретного рейса
export function liveDelay(trip) { const m = LIVE.matched && Date.now() - LIVE.at < 90000 ? LIVE.matched.get(trip) : null; return m ? m.delay : null; }
