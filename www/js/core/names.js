import { inCounty } from './region.js';
// Польские названия для Вильнюса и Вильнюсского края (= бывший Вильнюсский уезд).
// Правило: всё, что в Вильнюсе и Вильнюсском районе — по-польски, остальное — по-литовски.
// Словарь неполный: что не нашлось — остаётся по-литовски. Любое название можно
// поправить в приложении (Настройки → Названия), правки хранятся на телефоне.

// Населённые пункты. scope: 'strict' — Вильнюс + Вильнюсский район;
// 'wide' — ещё Тракайский, Шальчининкский, Швенчёнский районы (если включено в настройках).
export const PLACES = [
  // Вильнюс и его районы
  ['Vilnius', 'Wilno', 'strict'], ['Vilniaus', 'Wileński', 'strict'],
  ['Naujoji Vilnia', 'Nowa Wilejka', 'strict'], ['Antakalnis', 'Antokol', 'strict'],
  ['Žirmūnai', 'Żyrmuny', 'strict'], ['Šnipiškės', 'Śnipiszki', 'strict'],
  ['Naujamiestis', 'Nowe Miasto', 'strict'], ['Senamiestis', 'Stare Miasto', 'strict'],
  ['Žvėrynas', 'Zwierzyniec', 'strict'], ['Karoliniškės', 'Karolinki', 'strict'],
  ['Viršuliškės', 'Wierszuliszki', 'strict'], ['Fabijoniškės', 'Fabianiszki', 'strict'],
  ['Justiniškės', 'Justyniszki', 'strict'], ['Pašilaičiai', 'Poszyłajcie', 'strict'],
  ['Šeškinė', 'Szeszkinie', 'strict'], ['Baltupiai', 'Bołtupie', 'strict'],
  ['Verkiai', 'Werki', 'strict'], ['Santariškės', 'Santaryszki', 'strict'],
  ['Jeruzalė', 'Jerozolimka', 'strict'], ['Kalvarijos', 'Kalwaria', 'strict'],
  ['Užupis', 'Zarzecze', 'strict'], ['Rasos', 'Rossa', 'strict'],
  ['Markučiai', 'Markucie', 'strict'], ['Belmontas', 'Belmont', 'strict'],
  ['Lukiškės', 'Łukiszki', 'strict'], ['Vilkpėdė', 'Wilcza Łapa', 'strict'],
  ['Naujininkai', 'Nowy Świat', 'strict'], ['Kirtimai', 'Kirtimy', 'strict'],
  ['Valakampiai', 'Wołokumpie', 'strict'], ['Tuskulėnai', 'Tuskulany', 'strict'],
  ['Liepkalnis', 'Lipówka', 'strict'], ['Trinapolis', 'Trynopol', 'strict'],
  ['Pavilnys', 'Popławy', 'strict'], ['Paneriai', 'Ponary', 'strict'],
  ['Grigiškės', 'Grzegorzewo', 'strict'], ['Lazdynai', 'Leszczyniaki', 'strict'],
  // Вильнюсский район
  ['Nemenčinė', 'Niemenczyn', 'strict'], ['Maišiagala', 'Mejszagoła', 'strict'],
  ['Rudamina', 'Rudomino', 'strict'], ['Didžioji Riešė', 'Rzesza Wielka', 'strict'],
  ['Riešė', 'Rzesza', 'strict'], ['Avižieniai', 'Awiżenie', 'strict'],
  ['Bezdonys', 'Bezdany', 'strict'], ['Buivydžiai', 'Bujwidze', 'strict'],
  ['Dūkštos', 'Dukszty', 'strict'], ['Juodšiliai', 'Czarny Bór', 'strict'],
  ['Kalveliai', 'Kowalczuki', 'strict'], ['Lavoriškės', 'Ławaryszki', 'strict'],
  ['Medininkai', 'Miedniki', 'strict'], ['Mickūnai', 'Mickuny', 'strict'],
  ['Marijampolis', 'Mariampol', 'strict'], ['Paberžė', 'Podbrzezie', 'strict'],
  ['Sudervė', 'Suderwa', 'strict'], ['Šumskas', 'Szumsk', 'strict'],
  ['Zujūnai', 'Zujuny', 'strict'], ['Rukainiai', 'Rukojnie', 'strict'],
  ['Glitiškės', 'Glinciszki', 'strict'], ['Kyviškės', 'Kiwiszki', 'strict'],
  ['Skaidiškės', 'Skojdziszki', 'strict'], ['Pikeliškės', 'Pikieliszki', 'strict'],
  ['Bukiškis', 'Bukiszki', 'strict'], ['Kena', 'Kiena', 'strict'],
  ['Sužionys', 'Sużany', 'strict'],
  ['Musninkai', 'Muśniki', 'strict'], ['Dūkštai', 'Dukszty', 'strict'],
  ['Trakų Vokė', 'Waka Trocka', 'strict'], ['Vaidotai', 'Wojdaty', 'strict'],
  ['Kalvariškės', 'Kalwaryszki', 'strict'], ['Nemėžis', 'Niemież', 'strict'],
  ['Valčiūnai', 'Walczuny', 'strict'],
  // широкий край
  ['Trakai', 'Troki', 'wide'], ['Lentvaris', 'Landwarów', 'wide'],
  ['Šalčininkai', 'Soleczniki', 'wide'], ['Eišiškės', 'Ejszyszki', 'wide'],
  ['Jašiūnai', 'Jaszuny', 'wide'], ['Rūdninkai', 'Rudniki', 'wide'],
  ['Švenčionys', 'Święciany', 'wide'], ['Švenčionėliai', 'Nowe Święciany', 'wide'],
  ['Pabradė', 'Podbrodzie', 'wide'], ['Baltoji Vokė', 'Biała Waka', 'wide'],
  ['Ukmergė', 'Wiłkomierz', 'wide'], ['Širvintos', 'Szyrwinty', 'wide'], ['Elektrėnai', 'Elektreny', 'wide'],
  ['Vievis', 'Wiewis', 'wide'], ['Rūdiškės', 'Rudziszki', 'wide'], ['Aukštadvaris', 'Wysoki Dwór', 'wide'],
  ['Senieji Trakai', 'Stare Troki', 'wide'], ['Onuškis', 'Hanuszyszki', 'wide'], ['Paluknys', 'Połukne', 'wide'],
  ['Dieveniškės', 'Dziewieniszki', 'wide'], ['Turgeliai', 'Turgiele', 'wide'], ['Butrimonys', 'Butrymańce', 'wide'],
  ['Kalesninkai', 'Koleśniki', 'wide'], ['Adutiškis', 'Hoduciszki', 'wide'], ['Kaltanėnai', 'Kołtyniany', 'wide'],
  ['Labanoras', 'Łabonary', 'wide'], ['Kernavė', 'Kiernów', 'wide'], ['Gelvonai', 'Giełwany', 'wide'],
  ['Semeliškės', 'Siemieliszki', 'wide'], ['Taujėnai', 'Towiany', 'wide'], ['Vepriai', 'Wieprze', 'wide'],
];

// Целые известные названия остановок
export const WHOLE = {
  'Stotis': 'Dworzec', 'Geležinkelio stotis': 'Dworzec kolejowy',
  'Autobusų stotis': 'Dworzec autobusowy', 'Vilniaus autobusų stotis': 'Dworzec autobusowy w Wilnie',
  'Vilniaus geležinkelio stotis': 'Dworzec kolejowy w Wilnie',
  'Oro uostas': 'Lotnisko', 'Aušros Vartai': 'Ostra Brama', 'Aušros vartai': 'Ostra Brama',
  'Katedros aikštė': 'Plac Katedralny', 'Rotušė': 'Ratusz', 'Žaliasis tiltas': 'Zielony Most',
  'Kalvarijų turgus': 'Targ Kalwaryjski', 'Halės turgus': 'Hala Targowa',
  'Rasų kapinės': 'Cmentarz na Rossie', 'Lukiškių aikštė': 'Plac Łukiski',
  'Gedimino prospektas': 'Aleja Giedymina', 'Santariškių ligoninė': 'Szpital w Santaryszkach',
  'Vingio parkas': 'Park Zakręt', 'Vingis': 'Zakręt', 'Arkikatedra': 'Archikatedra',
  'Universitetas': 'Uniwersytet', 'Seimas': 'Sejm', 'Prekybos centras': 'Centrum handlowe',
};

// Отдельные слова (в т.ч. литовские родительные формы)
export const TOKENS = {
  'g.': 'ul.', 'pr.': 'al.', 'al.': 'al.', 'pl.': 'szosa', 'prospektas': 'aleja', 'plentas': 'szosa', 'gatvė': 'ulica', 'skv.': 'skwer',
  'aikštė': 'plac', 'tiltas': 'most', 'turgus': 'targ', 'turgavietė': 'targowisko',
  'mokykla': 'szkoła', 'gimnazija': 'gimnazjum', 'ligoninė': 'szpital', 'poliklinika': 'przychodnia',
  'kapinės': 'cmentarz', 'bažnyčia': 'kościół', 'stotis': 'dworzec', 'stotelė': 'przystanek',
  'žiedas': 'rondo', 'sankryža': 'skrzyżowanie', 'parkas': 'park', 'ežeras': 'jezioro',
  'kaimas': 'wieś', 'sodai': 'ogrody', 'sodų': 'ogrodów', 'gyvenvietė': 'osiedle',
  'kryžkelė': 'rozdroże', 'centras': 'centrum', 'seniūnija': 'starostwo', 'paštas': 'poczta',
  'parduotuvė': 'sklep', 'universitetas': 'uniwersytet', 'kolegija': 'kolegium',
  'Antakalnio': 'Antokolska', 'Žirmūnų': 'Żyrmuńska', 'Kalvarijų': 'Kalwaryjska',
  'Gedimino': 'Giedymina', 'Konstitucijos': 'Konstytucji', 'Ozo': 'Ozo',
  'Pylimo': 'Zawalna', 'Vokiečių': 'Niemiecka', 'Didžioji': 'Wielka', 'Didžiosios': 'Wielkiej',
  'Pilies': 'Zamkowa', 'Šv.': 'św.', 'Mindaugo': 'Mendoga', 'Naugarduko': 'Nowogródzka',
  'Savanorių': 'Ochotników', 'Ukmergės': 'Wiłkomierska', 'Kauno': 'Kowieńska',
  'Geležinio': 'Żelaznego', 'Vilko': 'Wilka',
  'Maironio': 'Maironisa', 'Sodų': 'Ogrodowa', 'Stoties': 'Dworcowa', 'Rinktinės': 'Brygady',
  'Žalgirio': 'Grunwaldzka', 'Lvovo': 'Lwowska', 'Olandų': 'Holenderska', 'Subačiaus': 'Subocz',
  'Vytenio': 'Witenesa', 'Kęstučio': 'Kiejstuta', 'Jogailos': 'Jagiełły', 'Vytauto': 'Witolda',
  'Algirdo': 'Olgierda', 'Liepkalnio': 'Lipowska', 'Minsko': 'Mińska', 'Lydos': 'Lidzka',
  'Šeškinės': 'Szeszkińska', 'Baltupio': 'Bołtupska', 'Verkių': 'Werkowska', 'Nemenčinės': 'Niemenczyńska',
  'Trakų': 'Trocka', 'Ašmenos': 'Oszmiańska', 'Rasų': 'Rossy', 'Užupio': 'Zarzeczna',
  'Naujosios Vilnios': 'Nowej Wilejki', 'Pavilnio': 'Popławska', 'Medininkų': 'Miednicka',
  'Fabijoniškių': 'Fabianiszek', 'Justiniškių': 'Justyniszek', 'Karoliniškių': 'Karolinek',
  'Pašilaičių': 'Poszyłajć', 'Santariškių': 'Santaryszek', 'Lazdynų': 'Leszczyniaków',
  'Grigiškių': 'Grzegorzewa', 'Riešės': 'Rzeszy', 'Maišiagalos': 'Mejszagolska',
  'Rudaminos': 'Rudomińska', 'Bezdonių': 'Bezdańska', 'Paberžės': 'Podbrzeska',
  'Lentvario': 'Landwarowska', 'Trakai': 'Troki',
};

const PL_STREET_PREFIX = new Set(['ul.', 'al.', 'szosa', 'aleja']);
// род польских существительных — чтобы согласовать прилагательное: «Rondo Antokolskie»
const NOUN_GENDER = { rondo: 'n', most: 'm', targ: 'm', plac: 'm', park: 'm', cmentarz: 'm', szpital: 'm',
  'kościół': 'm', dworzec: 'm', przystanek: 'm', 'skrzyżowanie': 'n', centrum: 'n', osiedle: 'n',
  jezioro: 'n', starostwo: 'n', 'szkoła': 'f', przychodnia: 'f', poczta: 'f', 'wieś': 'f', ogrody: 'p' };
function agree(adj, g) {
  if (g === 'f' || !/a$/.test(adj)) return adj;
  const stem = adj.slice(0, -1);
  if (/[kg]$/.test(stem)) return stem + (g === 'm' ? 'i' : 'ie');
  return stem + (g === 'm' ? 'y' : 'e');
}

// Вильнюс (город) — приблизительная рамка
const CITY_BOX = { s: 54.56, n: 54.84, w: 25.02, e: 25.48 };
// Вильнюсский район — грубое приближение: круг 36 км вокруг центра,
// минус окрестности городов соседних районов (Тракай, Лентварис, Яшюнай, Электренай).
const EXCLUDE_STRICT = [[54.637, 24.934, 6000], [54.643, 25.051, 2500], [54.440, 25.330, 5000], [54.786, 24.663, 6000],
  [55.045, 24.956, 8000], [54.980, 25.760, 6000], [54.310, 25.380, 8000], [54.770, 24.800, 5000]]; // + Širvintos, Pabradė, Šalčininkai, Vievis

function d2(lat1, lon1, lat2, lon2) {
  const x = (lon2 - lon1) * Math.cos((lat1 + lat2) * Math.PI / 360) * 111320, y = (lat2 - lat1) * 110540;
  return Math.sqrt(x * x + y * y);
}

export function inPolishZone(lat, lon, scope = 'county') {
  if (lat >= CITY_BOX.s && lat <= CITY_BOX.n && lon >= CITY_BOX.w && lon <= CITY_BOX.e) return true;
  if (scope === 'county' || scope === 'wide') return inCounty(lat, lon);
  const r = scope === 'wide' ? 52000 : 46000;
  if (d2(lat, lon, 54.687, 25.28) > r) return false;
  if (scope === 'wide') return true;
  return !EXCLUDE_STRICT.some(([a, b, m]) => d2(lat, lon, a, b) < m);
}

function placeList(scope) {
  return PLACES.filter(p => scope !== 'strict' || p[2] === 'strict')
    .sort((a, b) => b[0].length - a[0].length);
}
let _cache = {};
function places(scope) { return _cache[scope] || (_cache[scope] = placeList(scope)); }

// Замена названий населённых пунктов внутри любой строки (для названий рейсов, направлений)
const _re = {}, _memo = {};
function placeRegexes(scope) {
  return _re[scope] || (_re[scope] = places(scope).filter(p => p[0] !== 'Vilniaus').map(([lt, pl]) => [
    new RegExp('(^|[\\s\\-–—(,/])' + lt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[\\s\\-–—),/.])', 'g'), pl, lt]));
}
export function translatePlaces(text, scope = 'county') {
  if (!text) return text;
  const memo = _memo[scope] || (_memo[scope] = new Map());
  const hit = memo.get(text); if (hit !== undefined) return hit;
  let s = text;
  for (const [re, pl, lt] of placeRegexes(scope)) {
    if (!s.includes(lt)) continue;
    re.lastIndex = 0; s = s.replace(re, (m, p1) => p1 + pl);
  }
  memo.set(text, s);
  return s;
}

// Название остановки (Польская зона → польский, иначе как есть)
export function stopDisplayName(ltName, lat, lon, scope = 'county', overrides = {}) {
  if (overrides[ltName]) return overrides[ltName];
  if (!inPolishZone(lat, lon, scope)) return ltName;
  if (WHOLE[ltName]) return WHOLE[ltName];
  const r = fullTranslate(ltName, scope);
  return r || ltName; // если перевести целиком не получилось — оставляем литовское, без «гибридов»
}
// Перевод целиком: каждое слово должно быть известно. Иначе null.
function fullTranslate(ltName, scope) {
  let s = translatePlaces(ltName, scope);
  for (const k of Object.keys(TOKENS)) if (k.includes(' ') && s.includes(k)) s = s.split(k).join(TOKENS[k]);
  const plWords = polishWordSet(scope);
  const words = s.split(/(\s+|,)/);
  let ok = true;
  const res = words.map(w => {
    if (!w || /^\s+$/.test(w) || w === ',') return w;
    if (TOKENS[w]) return TOKENS[w];
    const lw = w.toLowerCase();
    if (TOKENS[lw]) return /^[A-ZĄČĘĖĮŠŲŪŽ]/.test(w) ? cap(TOKENS[lw]) : TOKENS[lw];
    if (plWords.has(w)) return w;          // уже польское (из словаря мест)
    ok = false; return w;
  });
  if (!ok) return null;
  const out = [];
  for (let i = 0; i < res.length; i++) {
    const w = res[i];
    if (PL_STREET_PREFIX.has(w)) {
      let j = out.length - 1; while (j >= 0 && /^\s+$/.test(out[j])) j--;
      if (j >= 0 && out[j] !== ',') { const prev = out[j]; out.splice(j, out.length - j, w, ' ', prev); continue; }
    }
    out.push(w);
  }
  const toks = out.join('').replace(/\s+/g, ' ').trim().split(' ');
  for (let i = 0; i + 1 < toks.length; i++) {
    const g = NOUN_GENDER[toks[i + 1].toLowerCase()];
    if (g && /^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(toks[i]) && /(ska|cka|na|wa|ka|ta)$/.test(toks[i]) && isPolishAdj(toks[i])) {
      const noun = cap(toks[i + 1]); toks[i + 1] = agree(toks[i], g); toks[i] = noun; i++;
    } else if (g && isPolishWord(toks[i])) {
      const noun = cap(toks[i + 1]); toks[i + 1] = toks[i]; toks[i] = noun; i++;
    }
  }
  if (toks[0] && !/^(ul|al)\.$/.test(toks[0])) toks[0] = cap(toks[0]);
  return toks.join(' ');
}
const _plw = {};
function polishWordSet(scope) {
  if (_plw[scope]) return _plw[scope];
  const set = new Set();
  for (const p of places(scope)) for (const w of p[1].split(' ')) set.add(w);
  for (const v of Object.values(TOKENS)) for (const w of v.split(' ')) set.add(w);
  return (_plw[scope] = set);
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// нормализация для поиска (без диакритики)
export function norm(s) {
  return (s || '').toLowerCase()
    .replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9а-яё ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

let PLW = null;
function isPolishWord(w) {
  if (!PLW) { PLW = new Set(); for (const v of Object.values(TOKENS)) if (/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(v)) PLW.add(v); for (const p of PLACES) PLW.add(p[1]); }
  return PLW.has(w);
}
const ADJ = new Set();
function isPolishAdj(w) {
  if (!ADJ.size) for (const v of Object.values(TOKENS)) if (/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(v) && !v.includes(' ')) ADJ.add(v);
  return ADJ.has(w);
}
