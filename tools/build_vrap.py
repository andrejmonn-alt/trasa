# Сборка GTFS для автобусов VRAP (направление Неменчине) из таблиц vrap.lt,
# присланных пользователем. Времена отправления — со свежих таблиц конечных
# (Nemenčinės pl. — с 2026-03-01, Nemenčinė — с 2026-02-01); время в пути между
# остановками — по таблицам промежуточных остановок (2022–2024).
import zipfile, io, csv, datetime

# ---------- остановки: (lat, lon, точность)
S = {
 # совпадают с городскими остановками Вильнюса (координаты из GTFS stops.lt)
 'Nemenčinės plentas': (54.72278, 25.32004, 'exact'),
 'Kiškių st.': (54.73457, 25.33814, 'exact'),
 'Smėlynė': (54.75471, 25.36580, 'exact'),
 'Veržuvos st.': (54.76149, 25.37262, 'exact'),
 'Karačiūnai': (54.77234, 25.38218, 'exact'),
 'Šilas': (54.78466, 25.38346, 'exact'),
 'Antaviliai': (54.79863, 25.39775, 'exact'),
 # приблизительно
 'Sakiškės': (54.8050, 25.4400, 'approx'), 'Miškonys': (54.8120, 25.4180, 'approx'),
 'Kreivalaužiai': (54.8240, 25.4360, 'approx'), 'Vėtrungė': (54.8360, 25.4560, 'approx'),
 'Nemenčinė': (54.8490, 25.4750, 'approx'), 'Mokykla (Nemenčinė)': (54.8515, 25.4790, 'approx'),
 'Miško urėdija': (54.8445, 25.4900, 'approx'), 'Nemenčinė II': (54.8400, 25.5000, 'approx'),
 'Pučkalaukis': (54.8650, 25.4900, 'approx'), 'Kabiškės 1': (54.8780, 25.5000, 'approx'),
 'Kabiškės 2': (54.8830, 25.5080, 'approx'), 'Kabiškės 3': (54.8880, 25.5160, 'approx'),
 'Krikščioniškės': (54.8950, 25.5300, 'approx'), 'Ragūnai': (54.9000, 25.5450, 'approx'),
 'Vėriškės': (54.9060, 25.5600, 'approx'), 'Pakryžė': (54.9150, 25.5730, 'approx'),
 'Aleksandriškės': (54.9250, 25.5830, 'approx'), 'Raistelis': (54.9330, 25.5900, 'approx'),
 'Stakinė': (54.9400, 25.5980, 'approx'), 'Minkeliai': (54.9480, 25.6040, 'approx'),
 'Ponasai': (54.9560, 25.6100, 'approx'), 'Pauliukonys': (54.9650, 25.6180, 'approx'),
 'Sužionys': (54.9760, 25.6260, 'approx'), 'Danilava': (54.9900, 25.6550, 'approx'),
 'Daukšiai': (55.0000, 25.6750, 'approx'), 'Skirlėnai': (55.0100, 25.6950, 'approx'),
 'Sapiegiškės': (55.0250, 25.6300, 'approx'), 'Jusinė': (55.0050, 25.5850, 'approx'),
 'Družiliai': (54.9900, 25.5550, 'approx'), 'Rūžiškės': (54.9750, 25.5250, 'approx'),
 'Rudausiai': (54.9600, 25.5050, 'approx'), 'Pailgė': (54.9300, 25.4700, 'approx'),
 'Miškiniai': (54.9150, 25.4580, 'approx'), 'Raudondvaris': (54.9000, 25.4420, 'approx'),
 'Raudondvario ežeras': (54.9050, 25.4250, 'approx'), 'Pakrauglė': (54.8820, 25.4500, 'approx'),
 'Girininkija': (54.8660, 25.4640, 'approx'), 'Bezdonys': (54.7830, 25.5450, 'approx'),
 'Arvydai': (54.7750, 25.6250, 'approx'), 'Buivydžiai': (54.8350, 25.7200, 'approx'),
 'Gėla': (54.8650, 25.5150, 'approx'),
}

# ---------- маршруты-шаблоны: список (остановка, минут от начала)
CORR_OUT = ['Nemenčinės plentas', 'Kiškių st.', 'Smėlynė', 'Veržuvos st.', 'Karačiūnai', 'Šilas', 'Antaviliai']
P = {
 '171_out': list(zip(CORR_OUT + ['Kreivalaužiai', 'Vėtrungė', 'Nemenčinė'], [0, 3, 6, 8, 9, 10, 12, 17, 19, 21])),
 '171s_out': list(zip(CORR_OUT + ['Sakiškės', 'Miškonys', 'Kreivalaužiai', 'Vėtrungė', 'Nemenčinė'], [0, 3, 6, 8, 9, 10, 12, 17, 19, 24, 25, 27])),
 '171_in': list(zip(['Nemenčinė', 'Vėtrungė', 'Kreivalaužiai'] + CORR_OUT[::-1], [0, 2, 3, 8, 10, 11, 12, 14, 17, 20])),
 '171s_in': list(zip(['Nemenčinė', 'Vėtrungė', 'Kreivalaužiai', 'Miškonys', 'Sakiškės'] + CORR_OUT[::-1], [0, 2, 3, 6, 8, 13, 15, 16, 17, 19, 22, 25])),
}
V158 = ['Nemenčinė', 'Pučkalaukis', 'Kabiškės 1', 'Kabiškės 2', 'Kabiškės 3', 'Krikščioniškės', 'Ragūnai', 'Vėriškės',
        'Pakryžė', 'Aleksandriškės', 'Raistelis', 'Stakinė', 'Minkeliai', 'Ponasai', 'Pauliukonys', 'Sužionys']
P['158_nas'] = list(zip(V158, [0, 3, 5, 8, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33]))
P['158_suz'] = list(zip(V158, [0, 1, 2, 4, 5, 8, 11, 15, 16, 17, 18, 19, 20, 22, 24, 26]))
P['158_ver'] = list(zip(V158[:8], [0, 1, 3, 5, 7, 8, 9, 11]))
P['148_out'] = list(zip(V158 + ['Danilava', 'Daukšiai', 'Skirlėnai', 'Sapiegiškės'],
                        [0, 1, 2, 4, 6, 8, 10, 14, 15, 16, 17, 18, 19, 21, 23, 25, 30, 32, 35, 40]))
IN158 = V158[::-1]
OFF158_IN = [0, 3, 5, 7, 9, 11, 14, 16, 18, 20, 21, 22, 25, 26, 28, 31]
P['158_in'] = list(zip(IN158, OFF158_IN))
P['148_in'] = list(zip(['Sapiegiškės', 'Skirlėnai', 'Daukšiai', 'Danilava'] + IN158, [0, 5, 10, 13] + [15 + o for o in OFF158_IN]))
P['158_ver_in'] = list(zip(['Vėriškės', 'Ragūnai', 'Krikščioniškės', 'Kabiškės 3', 'Kabiškės 2', 'Kabiškės 1', 'Pučkalaukis', 'Nemenčinė'], [0, 1, 3, 4, 5, 6, 7, 10]))
P['154_buiv'] = list(zip(['Nemenčinė', 'Miško urėdija', 'Nemenčinė II', 'Bezdonys', 'Arvydai', 'Buivydžiai'], [0, 2, 4, 12, 18, 25]))
P['154_bezd'] = list(zip(['Nemenčinė', 'Miško urėdija', 'Nemenčinė II', 'Bezdonys'], [0, 1, 2, 12]))
P['154_buiv_in'] = list(zip(['Buivydžiai', 'Arvydai', 'Bezdonys', 'Nemenčinė II', 'Miško urėdija', 'Nemenčinė'], [0, 25, 32, 40, 41, 44]))
P['154_bezd_in'] = list(zip(['Bezdonys', 'Nemenčinė II', 'Miško urėdija', 'Nemenčinė'], [0, 8, 9, 12]))
P['157_out'] = list(zip(['Nemenčinė', 'Mokykla (Nemenčinė)', 'Gėla'], [0, 2, 7]))
P['157_in'] = list(zip(['Gėla', 'Mokykla (Nemenčinė)', 'Nemenčinė'], [0, 5, 8]))
P['160_pail'] = list(zip(['Nemenčinė', 'Girininkija', 'Pakrauglė', 'Raudondvaris', 'Miškiniai', 'Pailgė'], [0, 2, 5, 8, 10, 13]))
P['160_raud'] = list(zip(['Nemenčinė', 'Girininkija', 'Pakrauglė', 'Raudondvario ežeras', 'Raudondvaris'], [0, 2, 5, 12, 15]))
P['160_sap'] = list(zip(['Nemenčinė', 'Girininkija', 'Pakrauglė', 'Raudondvaris', 'Miškiniai', 'Pailgė', 'Rudausiai', 'Rūžiškės', 'Družiliai', 'Jusinė', 'Sapiegiškės'],
                        [0, 6, 8, 10, 12, 15, 22, 24, 26, 28, 30]))
P['160_pail_in'] = list(zip(['Pailgė', 'Miškiniai', 'Raudondvaris', 'Pakrauglė', 'Girininkija', 'Nemenčinė'], [0, 2, 4, 8, 10, 14]))
P['160_raud_in'] = list(zip(['Raudondvaris', 'Pakrauglė', 'Girininkija', 'Nemenčinė'], [0, 3, 6, 10]))

# ---------- линии
R = {  # route_id: (short, long)
 '171': ('171', 'Vilnius – Nemenčinė'), '171S': ('171', 'Vilnius – Sakiškės – Nemenčinė'),
 '158': ('158', 'Nemenčinė – Sužionys'), '148': ('148', 'Nemenčinė – Sužionys – Sapiegiškės'),
 '154': ('154', 'Nemenčinė – Bezdonys – Buivydžiai'), '157': ('157', 'Nemenčinė – Gėla'),
 '160': ('160', 'Nemenčinė – Pailgė – Raudondvaris'), '160S': ('160', 'Nemenčinė – Pailgė – Sapiegiškės'),
}

def parse(s, default=None):
    """'6.25 D 7.05 ŠS' -> [(min, flags, school)]; если флагов нет — default."""
    toks = s.replace(',', ' ').split()
    out = []; i = 0
    while i < len(toks):
        t = toks[i].replace(':', '.'); h, m = t.split('.'); tm = int(h) * 60 + int(m)
        fl = default; i += 1
        if i < len(toks) and not toks[i][0].isdigit():
            fl = toks[i]; i += 1
        school = fl.endswith('*'); fl = fl.rstrip('*')
        out.append((tm, fl, school))
    return out

trips = []  # (route, pattern, start_min, flags, school, headsign)
def add(route, pat, lst, head):
    for tm, fl, sch in lst: trips.append((route, pat, tm, fl, sch, head))

# 171 Вильнюс -> Неменчине (Nemenčinės pl., с 2026-03-01)
D_OUT = '6.25 6.55 7.20 7.40 8.10 8.35 8.55 9.20 9.45 10.00 11.15 11.40 12.05 13.00 13.30 13.50 14.35 15.05 15.40 16.00 16.20 17.05 17.30 17.50 18.30 18.45 19.00 19.25 20.00 20.30 21.00 21.35'
SA_OUT = '7.05 8.05 9.07 9.25 9.45 10.00 10.15 10.35 11.00 12.00 13.00 13.40 14.35 15.30 15.55 16.30 16.55 17.40 18.20 19.00 19.45 20.30 21.00 21.35'
SU_OUT = '7.05 8.10 9.15 10.00 10.15 11.15 13.00 14.35 15.05 15.30 16.15 16.35 17.25 18.45 19.30 20.00 21.00 21.35'
SAK_OUT = {'D': '6.55 8.35 16.00 17.05 17.50 19.00 20.30', 'Š': '8.05 13.40', 'S': '8.10 16.15'}
for fl, lst in (('D', D_OUT), ('Š', SA_OUT), ('S', SU_OUT)):
    sak = set(tm for tm, _, _ in parse(SAK_OUT[fl], fl))
    for tm, _, _ in parse(lst, fl):
        if tm in sak: trips.append(('171S', '171s_out', tm, fl, False, 'Nemenčinė'))
        else: trips.append(('171', '171_out', tm, fl, False, 'Nemenčinė'))
# 171 Неменчине -> Вильнюс (с 2026-02-01)
D_IN = '05:00 05:35 06:10 06:25 06:30 06:45 07:10 07:40 08:05 08:35 08:55 09:25 09:45 10:15 10:40 11:30 12:10 12:30 13:00 13:20 13:40 14:05 14:30 15:05 15:30 16:10 16:40 17:00 17:20 17:55 19:00 19:35 21:00'
SA_IN = '05:10 05:40 06:30 07:40 08:30 08:50 09:20 10:10 11:00 11:30 12:00 12:25 13:00 13:25 14:05 14:30 15:30 16:20 17:15 18:05 18:30 19:35 21:00'
SU_IN = '05:10 05:40 06:30 07:40 08:30 08:50 09:40 11:30 12:00 12:30 14:05 14:30 16:00 17:15 18:10 19:35 21:00'
SAK_IN = {'D': '06:30 07:10 08:05 13:20 15:05 16:10 17:55', 'Š': '13:00 15:30 18:30', 'S': '14:05 18:10'}
for fl, lst in (('D', D_IN), ('Š', SA_IN), ('S', SU_IN)):
    sak = set(tm for tm, _, _ in parse(SAK_IN[fl], fl))
    for tm, _, _ in parse(lst, fl):
        if tm in sak: trips.append(('171S', '171s_in', tm, fl, False, 'Vilnius'))
        else: trips.append(('171', '171_in', tm, fl, False, 'Vilnius'))

# ветки из Неменчине (таблица Nemenčinė с 2026-02-01)
add('158', '158_nas', parse('07:00 D 07:25 ŠS 18:20 DŠS'), 'Našiūnai')
add('158', '158_suz', parse('10:30 DŠS 13:30 DŠS 15:55 D*'), 'Sužionys')
add('158', '158_ver', parse('12:30 D 15:05 D* 16:30 D'), 'Vėriškės')
add('148', '148_out', parse('15:05 DŠS'), 'Sapiegiškės')
add('154', '154_buiv', parse('06:05 D 06:50 ŠS 07:00 D* 13:00 D 15:00 D* 15:20 ŠS 16:50 D'), 'Buivydžiai')
add('154', '154_bezd', parse('05:45 D 07:20 Š 08:45 D 14:15 D'), 'Bezdonys')
add('157', '157_out', parse('13:00 D 15:40 D 17:30 D'), 'Gėla')
add('160', '160_pail', parse('06:15 D 06:55 D* 09:50 S 10:15 D 12:05 S 15:05 D* 16:00 D'), 'Pailgė')
add('160', '160_raud', parse('07:25 D* 14:45 D*'), 'Raudondvaris')
add('160S', '160_sap', parse('05:10 D 06:10 ŠS 12:00 D'), 'Sapiegiškės')
# обратно к Неменчине
add('158', '158_in', parse('7.55 D 8.15 ŠS 11.00 DŠS 14.00 DŠS 19.08 DŠS 7.05 D* 16.23 D*'), 'Nemenčinė')
add('148', '148_in', parse('5.40 D 6.35 ŠS 16.15 DŠS'), 'Nemenčinė')
add('158', '158_ver_in', parse('12.40 D 15.15 D* 16.40 D'), 'Nemenčinė')
add('154', '154_buiv_in', parse('6.45 D 7.40 ŠS 7.55 D* 13.49 D 15.40 D* 16.15 ŠS 18.00 D'), 'Nemenčinė')
add('154', '154_bezd_in', parse('7.42 D* 9.57 D 15.59 D 18.12 Š 20.47 D'), 'Nemenčinė')
add('157', '157_in', parse('13.07 D 15.47 D 17.37 D'), 'Nemenčinė')
add('160', '160_pail_in', parse('6.30 D 7.15 D* 10.00 S 10.25 D 12.10 D 12.15 S 15.20 D 16.15 D'), 'Nemenčinė')
add('160', '160_raud_in', parse('6.50 D* 7.20 D* 7.35 D* 15.00 D* 15.25 D*'), 'Nemenčinė')

# ---------- календарь
START, END = datetime.date(2026, 2, 1), datetime.date(2027, 12, 31)
HOL = ['2026-11-01', '2026-11-02', '2026-12-24', '2026-12-25', '2026-12-26', '2027-01-01', '2027-02-16', '2027-03-11',
       '2027-03-28', '2027-03-29', '2027-05-01', '2027-06-24', '2027-07-06', '2027-08-15', '2027-11-01', '2027-11-02',
       '2027-12-24', '2027-12-25', '2027-12-26', '2026-02-16', '2026-03-11', '2026-04-05', '2026-04-06', '2026-05-01',
       '2026-06-24', '2026-07-06', '2026-08-15']
HOL = set(datetime.date.fromisoformat(d) for d in HOL)
def school_day(d):  # учебное время школ (приблизительно): 1 сен – 20 июн, без зимних каникул 22.12–2.01
    if datetime.date(d.year, 6, 21) <= d <= datetime.date(d.year, 8, 31): return False
    if (d.month == 12 and d.day >= 22) or (d.month == 1 and d.day <= 2): return False
    return True
def runs(flags, school, d):
    wd = d.weekday()
    typ = 'S' if (wd == 6 or d in HOL) else ('Š' if wd == 5 else 'D')
    ok = (typ == 'D' and 'D' in flags) or (typ == 'Š' and 'Š' in flags) or (typ == 'S' and 'S' in flags.replace('Š', ''))
    if ok and school: ok = school_day(d)
    return ok

services = {}
def service_for(flags, school):
    key = flags + ('*' if school else '')
    if key not in services: services[key] = 'vrap_' + key.replace('Š', 'Sa').replace('*', 'M')
    return services[key]

out = {}
w = lambda rows: '\n'.join(','.join('"' + str(c).replace('"', '""') + '"' if isinstance(c, str) and (',' in c or '"' in c) else str(c) for c in r) for r in rows) + '\n'
out['agency.txt'] = w([['agency_id', 'agency_name', 'agency_url', 'agency_timezone'], ['vrap', 'Vilniaus rajono autobusų parkas', 'https://www.vrap.lt', 'Europe/Vilnius']])
stop_ids = {n: 'vr%02d' % i for i, n in enumerate(S)}
out['stops.txt'] = w([['stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'stop_desc']] + [[stop_ids[n], n, S[n][0], S[n][1], 'koordinatės apytikslės' if S[n][2] == 'approx' else ''] for n in S])
out['routes.txt'] = w([['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type']] + [[k, 'vrap', v[0], v[1], 3] for k, v in R.items()])
trows = [['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id']]
strows = [['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence']]
hm = lambda m: '%02d:%02d:00' % (m // 60, m % 60)
for k, (route, pat, tm, fl, sch, head) in enumerate(trips):
    tid = 'vrap_%d' % k
    trows.append([route, service_for(fl, sch), tid, head + (' (tik mokslo metu)' if sch else ''), 0 if pat.endswith('in') is False else 1])
    for seq, (stop, off) in enumerate(P[pat]):
        strows.append([tid, hm(tm + off), hm(tm + off), stop_ids[stop], seq + 1])
out['trips.txt'] = w(trows); out['stop_times.txt'] = w(strows)
cal = [['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date']]
cd = [['service_id', 'date', 'exception_type']]
for key, sid in services.items():
    fl, sch = key.rstrip('*'), key.endswith('*')
    cal.append([sid, 0, 0, 0, 0, 0, 0, 0, START.strftime('%Y%m%d'), END.strftime('%Y%m%d')])
    d = START
    while d <= END:
        if runs(fl, sch, d): cd.append([sid, d.strftime('%Y%m%d'), 1])
        d += datetime.timedelta(days=1)
out['calendar.txt'] = w(cal); out['calendar_dates.txt'] = w(cd)
with zipfile.ZipFile('vrap.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for n, c in out.items(): z.writestr(n, c)
print('trips', len(trips), 'stops', len(S), 'services', services)
