// Билет JUDU (30/60 мин): Trasa не читает JUDU — вы отмечаете активацию, а мы напоминаем.
import * as P from './platform.js';
import { fmtTime } from './core/router.js';
const KEY = 'trasa.ticket', TPLAN = 200001;

export function getTicket() {
  try { const t = JSON.parse(localStorage.getItem(KEY)); if (t && Date.now() < t.end + 5 * 60000) return t; } catch (e) {}
  return null;
}
export async function activateTicket(min, startMs = Date.now()) {
  const t = { min, start: startMs, end: startMs + min * 60000 };
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
  await P.cancelPlan(TPLAN).catch(() => {});
  await P.notifInit().catch(() => {});
  const hm = d => new Date(d).toTimeString().slice(0, 5);
  const items = [];
  if (min > 5) items.push({ id: TPLAN * 10000 + 1, at: new Date(t.end - 5 * 60000), title: `Билет кончается через 5 мин`, body: `${min}-минутный билет действует до ${hm(t.end)}.`, channel: 'trasa-main' });
  items.push({ id: TPLAN * 10000 + 2, at: new Date(t.end - 60000), title: `Билет кончается через 1 мин`, body: `До ${hm(t.end)}. Если ещё едете — активируйте новый в JUDU.`, channel: 'trasa-main' });
  items.push({ id: TPLAN * 10000 + 3, at: new Date(t.end), title: `Билет закончился`, body: `${min}-минутный билет, активирован в ${hm(t.start)}.`, channel: 'trasa-main' });
  await P.schedule(items);
  return t;
}
export async function clearTicket() { try { localStorage.removeItem(KEY); } catch (e) {} await P.cancelPlan(TPLAN).catch(() => {}); }

// Городские участки поездки (на них действует билет JUDU)
function cityLegs(net, legs) { return legs.filter(l => net.feeds[net.routeFeed[net.tripRoute[l.trip]]] === 'vilnius'); }

// Подсказка для карточки маршрута
export function ticketHint(net, legs, midnight, ticket) {
  const c = cityLegs(net, legs); if (!c.length) return null;
  const a = c[0].dep, b = c[c.length - 1].arr, span = Math.round((b - a) / 60);
  if (ticket) {
    const endSec = (ticket.end - midnight.getTime()) / 1000;
    if (endSec >= b) return { ok: true, text: `Ваш билет до ${fmtTime(endSec)} — хватит на всю поездку` };
    const bad = c.find(l => l.dep > endSec);
    if (endSec < a) return { ok: false, text: `Ваш билет кончится в ${fmtTime(endSec)}, раньше посадки — нужен новый` };
    return { ok: false, text: `Ваш билет кончится в ${fmtTime(endSec)}, а в городском транспорте вы до ${fmtTime(b)}` + (bad ? ` — на пересадке нужен новый` : '') };
  }
  return { ok: true, text: `В городском транспорте ~${span} мин: ` + (span <= 28 ? 'хватит 30-минутного билета' : span <= 58 ? 'нужен 60-минутный билет' : 'больше часа — одного короткого билета не хватит') };
}

// Уведомления к поездке: «на пересадке нужен новый билет», «билет кончится в пути»
export async function ticketJourneyNotes(net, tracked) {
  const t = getTicket(); if (!t || !tracked) return 0;
  const mid = tracked.midnight.getTime(), endSec = (t.end - mid) / 1000;
  const c = cityLegs(net, tracked.legs); if (!c.length) return 0;
  const items = [];
  const after = c.find(l => l.dep > endSec);
  const inRide = c.find(l => l.dep <= endSec && l.arr > endSec);
  if (inRide) items.push({ id: TPLAN * 10000 + 10, at: new Date(t.end - 3 * 60000), title: 'Билет кончится до выхода', body: `Билет до ${fmtTime(endSec)}, а выходить в ${fmtTime(inRide.arr)}. Активируйте новый в JUDU.`, channel: 'trasa-main' });
  if (after) { const r = net.tripRoute[after.trip]; items.push({ id: TPLAN * 10000 + 11, at: new Date(mid + (after.dep - 120) * 1000), title: 'На пересадке нужен новый билет', body: `${net.routeShort[r] || net.routeName[r]} в ${fmtTime(after.dep)} — ваш билет к этому времени уже закончится (${fmtTime(endSec)}).`, channel: 'trasa-main' }); }
  return P.schedule(items);
}
