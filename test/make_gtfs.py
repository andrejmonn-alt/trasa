import zipfile, sys
def z(path, files):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as zf:
        for n,c in files.items(): zf.writestr(n,c)
cal="service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWD,1,1,1,1,1,1,1,20260101,20271231\n"
stops="""stop_id,stop_name,stop_lat,stop_lon
A,Stotis,54.6710,25.2840
B,"Kalvarijų turgus",54.6950,25.2900
C,Žirmūnų g.,54.7050,25.3000
D,Antakalnio žiedas,54.7020,25.3200
E,Saulėtekio al.,54.7230,25.3380
F,Nemenčinės pl.,54.7300,25.3500
G,Ozo g.,54.7120,25.2800
"""
routes="""route_id,route_short_name,route_long_name,route_type
r10,10,"Stotis - Antakalnis",3
trol3,3,"Antakalnis - Saulėtekis",800
r1G,1G,"Stotis - Saulėtekis",3
"""
trips="trip_id,route_id,service_id,trip_headsign,direction_id,shape_id\n"
st="trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
def hm(m): return "%02d:%02d:00"%(m//60,m%60)
for k in range(0,24*60,15):
    t="b10_%d"%k; trips+=f"{t},r10,WD,Antakalnis,0,\n"
    for i,(s,d) in enumerate([("A",0),("B",6),("C",11),("D",15)]): st+=f"{t},{hm(k+d)},{hm(k+d)},{s},{i+1}\n"
    t="t3_%d"%k; trips+=f"{t},trol3,WD,Saulėtekis,0,\n"
    for i,(s,d) in enumerate([("D",3),("E",9),("F",13)]): st+=f"{t},{hm(k+d+15)},{hm(k+d+15)},{s},{i+1}\n"
for k in range(0,24*60,30):
    t="g1_%d"%k; trips+=f"{t},r1G,WD,Saulėtekis,0,\n"
    for i,(s,d) in enumerate([("A",5),("G",12),("F",30)]): st+=f"{t},{hm(k+d)},{hm(k+d)},{s},{i+1}\n"
# ночной рейс через полночь
trips+="night,r10,WD,Antakalnis,0,\n"; st+="night,23:58:00,23:58:00,A,1\nnight,24:20:00,24:20:00,D,2\n"
z("city.zip",{"stops.txt":stops,"routes.txt":routes,"trips.txt":trips,"stop_times.txt":st,"calendar.txt":cal})
# междугородний: Vilnius - Švenčionys через Nemenčinė; и рейс вне региона
stops2="""stop_id,stop_name,stop_lat,stop_lon
V,Vilniaus autobusų stotis,54.6700,25.2850
N,Nemenčinė,54.8490,25.4750
P,Pabradė,54.9800,25.7600
S,Švenčionys,55.1330,26.1600
K,Kaunas,54.8990,23.9040
X,Kėdainiai,55.2880,23.9740
"""
routes2="route_id,route_short_name,route_long_name,route_type\nsv,,Vilnius - Švenčionys,3\nkk,,Kaunas - Kėdainiai,3\n"
trips2="trip_id,route_id,service_id,trip_headsign\nsv1,sv,WD,Švenčionys\nsv2,sv,WD,Švenčionys\nkk1,kk,WD,Kėdainiai\n"
st2="trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
for t,base in (("sv1",8*60+30),("sv2",17*60)):
    for i,(s,d) in enumerate([("V",0),("N",35),("P",60),("S",95)]): st2+=f"{t},{hm(base+d)},{hm(base+d)},{s},{i+1}\n"
st2+="kk1,09:00:00,09:00:00,K,1\nkk1,10:00:00,10:00:00,X,2\n"
z("intercity.zip",{"stops.txt":stops2,"routes.txt":routes2,"trips.txt":trips2,"stop_times.txt":st2,"calendar.txt":cal})
print("ok")
