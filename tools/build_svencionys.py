# GTFS для рейсов Švenčionys – Pabradė – Vilnius по тексту страницы
# svencionys.lt «Eismo tvarkaraščiai» (прислан пользователем 2026-11-15).
# Официальны только времена отправления из Švenčionys AS, Pabradė и Vilniaus AS;
# местные рейсы Transporto centras идут через Неменчине, рейсы на Visaginas (Meteorit, Seknija) — НЕ заезжают (уточнено пользователем); остальные остановки (Nemenčinė, Pailgė, Pavoverė, Zalavas, Sariai) и время
# прибытия рассчитаны по типичному времени в пути — помечены как примерные.
import zipfile, datetime

S = {  # координаты: городские остановки — точные (stops.lt), деревни — как в данных VRAP (приблизительно)
 'Vilniaus autobusų stotis': (54.6706, 25.2817), 'Nemenčinės plentas': (54.72278, 25.32004),
 'Kiškių st.': (54.73457, 25.33814), 'Smėlynė': (54.75471, 25.36580), 'Veržuvos st.': (54.76149, 25.37262),
 'Karačiūnai': (54.77234, 25.38218), 'Šilas': (54.78466, 25.38346), 'Antaviliai': (54.79863, 25.39775),
 'Kreivalaužiai': (54.8240, 25.4360), 'Vėtrungė': (54.8360, 25.4560),
 'Nemenčinė': (54.8490, 25.4750), 'Girininkija': (54.8660, 25.4640), 'Pakrauglė': (54.8820, 25.4500),
 'Raudondvaris': (54.9000, 25.4420), 'Miškiniai': (54.9150, 25.4580), 'Pailgė': (54.9300, 25.4700),
 'Pabradė': (54.9800, 25.7600), 'Pavoverė': (54.9950, 25.8150), 'Zalavas': (55.0500, 25.9500),
 'Sariai': (55.0950, 26.0500), 'Švenčionys': (55.1340, 26.1590),
 'Ignalina': (55.3405, 26.1650), 'Visaginas': (55.5960, 26.4370), 'Molėtai': (55.2300, 25.4200),
}
# шаблоны: (остановка, минут от начала); 'P' — опорная Pabradė
EXP_OUT = [('Vilniaus autobusų stotis', 0), ('Pailgė', 38), ('Pabradė', 55), ('Pavoverė', 60), ('Zalavas', 70), ('Sariai', 80), ('Švenčionys', 92)]
EXP_IN = [('Švenčionys', 0), ('Sariai', 12), ('Zalavas', 22), ('Pavoverė', 31), ('Pabradė', 35), ('Pailgė', 52), ('Vilniaus autobusų stotis', 93)]
# местный рейс «по деревням»: Вильнюс — Nemenčinės pl. — коридор 171 — Неменчине — дорога 160 — Pabradė
VIA = [('Nemenčinės plentas', 20), ('Kiškių st.', 23), ('Smėlynė', 26), ('Veržuvos st.', 28), ('Karačiūnai', 29), ('Šilas', 30),
       ('Antaviliai', 32), ('Kreivalaužiai', 37), ('Vėtrungė', 39), ('Nemenčinė', 41), ('Girininkija', 44), ('Pakrauglė', 47),
       ('Raudondvaris', 50), ('Miškiniai', 52), ('Pailgė', 55)]
LOC_OUT = [('Vilniaus autobusų stotis', 0)] + VIA + [('Pabradė', 80), ('Pavoverė', 85), ('Zalavas', 97), ('Sariai', 107), ('Švenčionys', 118)]

def loc_in(sv_to_pab):  # местный рейс из Švenčionys: до Pabradė — по таблице, дальше ~80 мин до Вильнюса
    k = sv_to_pab / 41
    return [('Švenčionys', 0), ('Sariai', round(12 * k)), ('Zalavas', round(22 * k)), ('Pavoverė', round(33 * k))] + \
           [(n, sv_to_pab + o) for n, o in PAB_IN]
# Pabradė -> Вильнюс по деревням (обратный порядок VIA, всего ~80 мин)
PAB_IN = [('Pabradė', 0)] + [(n, 80 - o) for n, o in VIA[::-1]] + [('Vilniaus autobusų stotis', 80)]
PAB_OUT_SV = [('Pabradė', 0), ('Pavoverė', 5), ('Zalavas', 17), ('Sariai', 27), ('Švenčionys', 38)]
VIL_PAB = [('Vilniaus autobusų stotis', 0)] + VIA + [('Pabradė', 80)]

R = {'TC': ('', 'Vilnius – Pabradė – Švenčionys', 'UAB „Transporto centras“'),
     'MT': ('', 'Vilnius – Švenčionys – Visaginas', 'UAB „Meteorit turas“'),
     'SK': ('', 'Vilnius – Švenčionys – Visaginas ', 'UAB „Seknija“'),
     'MO': ('', 'Molėtai – Pabradė', 'UAB „Molėtų autobusų parkas“'),
     'TCL': ('', 'Švenčionys – Pabradė – Zalavas', 'UAB „Transporto centras“')}
ALL = {0, 1, 2, 3, 4, 5, 6}; DD = {0, 1, 2, 3, 4}; SA = {5}; SU = {6}; SASU = {5, 6}; PAKP = {0, 1, 3, 4}
def hm(s): h, m = s.split('.'); return int(h) * 60 + int(m)
def m2t(m): return '%d.%02d' % (m // 60, m % 60)
FROM_VIS = [('Visaginas', 0), ('Ignalina', 38)] + [(n, 68 + o) for n, o in EXP_IN]  # время из Visaginas — расчётное

trips = []  # (route, pattern, start, days, school_only, head)
def T(route, pat, t, days, head, school=False): trips.append((route, pat, hm(t), days, school, head))

# --- Transporto centras (мокymo metu / atostogų metu совпадают, кроме двух рейсов)
T('TC', loc_in(41), '4.45', DD, 'Vilnius'); T('TC', EXP_IN, '5.45', DD, 'Vilnius (greitasis)')
T('TC', EXP_IN, '5.45', SA, 'Vilnius (greitasis)', school=True)
T('TC', loc_in(50), '6.00', ALL, 'Vilnius'); T('TC', loc_in(50), '12.15', ALL, 'Vilnius')
T('TC', loc_in(50), '15.15', ALL, 'Vilnius'); T('TC', loc_in(45), '17.10', SU, 'Vilnius')
T('TC', PAB_IN, '14.40', DD, 'Vilnius')
T('TC', EXP_OUT, '7.50', SA, 'Švenčionys (greitasis)')
for t, d in (('7.20', DD), ('8.20', SASU), ('8.50', DD), ('14.50', ALL), ('16.50', DD), ('17.40', ALL), ('19.00', SU)):
    T('TC', LOC_OUT, t, d, 'Švenčionys')
T('TC', VIL_PAB, '16.10', DD, 'Pabradė')
T('TC', PAB_OUT_SV, '7.05', DD, 'Švenčionys', school=True); T('TC', PAB_OUT_SV, '7.50', DD, 'Švenčionys')
# --- Meteorit turas (через Sariai, Zalavas, Pavoverė, Pabradė, Pailgė)
for t, d in (('8.07', ALL), ('8.37', DD), ('9.07', ALL), ('9.52', DD), ('11.37', ALL), ('12.52', DD), ('14.52', ALL), ('16.37', ALL)):
    T('MT', FROM_VIS, m2t(hm(t) - 68), d, 'Vilnius')
def to_visaginas(start, sv_dep):  # Вильнюс -> Švenčionys (прибытие ~+92) -> отправление по таблице -> Ignalina +30, Visaginas +68
    w = hm(sv_dep) - hm(start)
    return EXP_OUT[:-1] + [('Švenčionys', w), ('Ignalina', w + 30), ('Visaginas', w + 68)]
for t, sv, d in (('10.45', '12.24', ALL), ('11.25', '13.04', DD), ('12.00', '13.39', ALL), ('14.15', '15.50', DD), ('15.30', '17.09', ALL),
                 ('16.45', '18.24', DD), ('17.35', '19.14', ALL), ('19.00', '20.39', ALL)):
    T('MT', to_visaginas(t, sv), t, d, 'Visaginas')
# --- Seknija (Pabradė = Švenčionys +35 / Vilnius +55 — по таблице)
for t, d in (('7.47', PAKP), ('8.52', SA), ('13.52', DD)): T('SK', FROM_VIS, m2t(hm(t) - 68), d, 'Vilnius')
for t, sv, d in (('9.00', '10.35', DD), ('11.40', '13.15', SA), ('13.20', '14.55', PAKP)): T('SK', to_visaginas(t, sv), t, d, 'Visaginas')
# --- ранее пропущенные короткие рейсы
SV_PAB = [('Švenčionys', 0), ('Sariai', 11), ('Zalavas', 21), ('Pavoverė', 33), ('Pabradė', 38)]
T('TCL', SV_PAB, '7.00', DD, 'Pabradė'); T('TCL', SV_PAB, '13.15', DD, 'Pabradė', school=True)
T('TCL', [('Pabradė', 0), ('Pavoverė', 5), ('Zalavas', 17)], '15.00', DD, 'Zalavas')
# --- Molėtai – Pabradė (время в пути ~60 мин — расчётное)
MOL = [('Molėtai', 0), ('Pabradė', 60)]; MOL_R = [('Pabradė', 0), ('Molėtai', 60)]
DDS = {0, 1, 2, 3, 4, 6}; DDSA = {0, 1, 2, 3, 4, 5}
T('MO', MOL, '8.00', DD, 'Pabradė'); T('MO', MOL, '8.30', SA, 'Pabradė'); T('MO', MOL, '14.50', DDS, 'Pabradė')
T('MO', MOL_R, '10.05', DDSA, 'Molėtai'); T('MO', MOL_R, '16.15', DDS, 'Molėtai')

START, END = datetime.date(2026, 9, 1), datetime.date(2027, 12, 31)
HOL = set(datetime.date.fromisoformat(d) for d in ['2026-11-01', '2026-11-02', '2026-12-24', '2026-12-25', '2026-12-26', '2027-01-01',
      '2027-02-16', '2027-03-11', '2027-03-28', '2027-03-29', '2027-05-01', '2027-06-24', '2027-07-06', '2027-08-15', '2027-11-01',
      '2027-11-02', '2027-12-24', '2027-12-25', '2027-12-26'])
def school_day(d):
    if datetime.date(d.year, 6, 21) <= d <= datetime.date(d.year, 8, 31): return False
    if (d.month == 12 and d.day >= 22) or (d.month == 1 and d.day <= 2): return False
    return True
def runs(days, school, d):
    wd = 6 if d in HOL else d.weekday()
    return wd in days and (not school or school_day(d))

stops = list(S); sid = {n: 'sv%02d' % i for i, n in enumerate(stops)}
svc = {}; trows = []; strows = []
for k, (route, pat, t0, days, school, head) in enumerate(trips):
    key = ''.join(map(str, sorted(days))) + ('M' if school else '')
    svc.setdefault(key, (days, school))
    tid = 'sv_%d' % k
    trows.append(f'{route},sv_{key},{tid},"{head}"')
    for seq, (st, off) in enumerate(pat):
        m = t0 + off; tt = '%02d:%02d:00' % (m // 60, m % 60)
        strows.append(f'{tid},{tt},{tt},{sid[st]},{seq + 1}')
cd = []
for key, (days, school) in svc.items():
    d = START
    while d <= END:
        if runs(days, school, d): cd.append(f'sv_{key},{d:%Y%m%d},1')
        d += datetime.timedelta(days=1)
files = {
 'agency.txt': 'agency_id,agency_name,agency_url,agency_timezone\nsv,Švenčionių kryptis,https://svencionys.lt,Europe/Vilnius\n',
 'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\n' + ''.join(f'{sid[n]},{n},{S[n][0]},{S[n][1]}\n' for n in stops),
 'routes.txt': 'route_id,agency_id,route_short_name,route_long_name,route_desc,route_type\n' + ''.join(f'{k},sv,{v[0]},{v[1].strip()},"{v[2]}",3\n' for k, v in R.items()),
 'trips.txt': 'route_id,service_id,trip_id,trip_headsign\n' + '\n'.join(trows) + '\n',
 'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' + '\n'.join(strows) + '\n',
 'calendar_dates.txt': 'service_id,date,exception_type\n' + '\n'.join(cd) + '\n',
}
with zipfile.ZipFile('svencionys.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for n, c in files.items(): z.writestr(n, c)
print('trips', len(trips), 'services', list(svc))
