// Превращает найденный маршрут в список уведомлений по расписанию.
import { rideStops, fmtTime } from './core/router.js';

const LEADS = [60, 30, 10, 1];

export function legInfo(net, leg) {
  const r = net.tripRoute[leg.trip];
  const stops = rideStops(net, leg);
  const lastOfTrip = leg.i1 === net.tripOff[leg.trip + 1] - 1;
  return {
    route: net.routeName[r], short: net.routeShort[r], cat: net.routeCat[r],
    head: net.tripHead[leg.trip], stops, lastOfTrip,
    from: net.name[stops[0].stop], to: net.name[stops[stops.length - 1].stop]
  };
}

function label(i) {
  const kind = { bus: 'Автобус', trolley: 'Троллейбус', express: 'Экспресс', intercity: 'Рейс', train: 'Поезд' }[i.cat] || 'Транспорт';
  return `${kind} ${i.route}${i.head && i.cat !== 'intercity' ? ' → ' + i.head : ''}`;
}

// midnight: Date полуночи дня поездки; settings.perStop
export function journeyNotifications(net, j, midnight, idBase, settings = {}) {
  const at = sec => new Date(midnight.getTime() + sec * 1000);
  const rides = j.legs.filter(l => l.type === 'ride');
  const out = []; let n = 0;
  const push = (sec, title, body, channel = 'trasa-main') => { if (n < 999) out.push({ id: idBase + n++, at: at(sec), title, body, channel }); };
  if (!rides.length) return out;

  const first = legInfo(net, rides[0]);
  const walkMin = Math.round((rides[0].dep - j.leave) / 60);
  for (const L of LEADS) {
    const t = j.leave - L * 60;
    const head = L === 1 ? 'Выходи сейчас!' : `Через ${L} мин выходить`;
    push(t, head, `${label(first)} в ${fmtTime(rides[0].dep)} с остановки «${first.from}»` + (walkMin > 0 ? ` · идти ~${walkMin} мин` : ''));
  }

  rides.forEach((leg, k) => {
    const i = legInfo(net, leg);
    const nextLeg = rides[k + 1];
    const ni = nextLeg ? legInfo(net, nextLeg) : null;
    const nStops = i.stops.length - 1;
    push(leg.dep, `Посадка: ${label(i)}`,
      `«${i.from}», ${fmtTime(leg.dep)}. Выходить: «${i.to}» в ${fmtTime(leg.arr)} (${nStops} ост.)`);

    if (settings.perStop !== false) {
      for (let s = 1; s < i.stops.length - 1; s++) {
        const cur = i.stops[s], nxt = i.stops[s + 1];
        const isNextMine = s + 1 === i.stops.length - 1;
        push(cur.dep, `${i.short || i.route}: «${net.name[cur.stop]}»`,
          `Следующая: «${net.name[nxt.stop]}» в ${fmtTime(nxt.arr)}` + (isNextMine ? ' — ВАША, выходите!' : ` · осталось ${i.stops.length - 1 - s} ост.`),
          'trasa-stops');
      }
    }

    const terminus = i.lastOfTrip ? ' (конечная маршрута)' : '';
    const warnAt = Math.max(leg.dep + 30, leg.arr - 90);
    if (ni) {
      const wait = Math.round((nextLeg.dep - leg.arr) / 60);
      push(warnAt, `Скоро выходить: «${i.to}»${terminus}`,
        `Пересадка: ${label(ni)} в ${fmtTime(nextLeg.dep)} с «${ni.from}»` + (ni.from !== i.to ? ' (перейти пешком)' : '') + ` · запас ${wait} мин`);
      push(leg.arr, `Пересадка на «${i.to}»`,
        `Далее ${label(ni)} в ${fmtTime(nextLeg.dep)}, остановка «${ni.from}». Выходить на «${ni.to}».`);
    } else {
      const eg = Math.round(j.egressWalk / 60);
      push(warnAt, `Скоро ваша конечная: «${i.to}»${terminus}`,
        `Прибытие ${fmtTime(leg.arr)}` + (eg > 0 ? ` · дальше пешком ~${eg} мин` : '') + '. Готовьтесь к выходу.');
      push(leg.arr, `Приехали: «${i.to}»`, eg > 0 ? `До цели пешком ~${eg} мин, будете в ${fmtTime(j.arrive)}` : 'Конец поездки. Хорошей дороги!');
    }
  });
  return out;
}
