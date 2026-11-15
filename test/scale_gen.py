import zipfile, random, io
random.seed(1)
S=1500; stops=["stop_id,stop_name,stop_lat,stop_lon"]
for i in range(S): stops.append(f"s{i},Stotelė {i},{54.62+random.random()*0.15:.5f},{25.15+random.random()*0.25:.5f}")
routes=["route_id,route_short_name,route_long_name,route_type"]; trips=["trip_id,route_id,service_id,trip_headsign"]
st=io.StringIO(); st.write("trip_id,arrival_time,departure_time,stop_id,stop_sequence\n")
n=0
for r in range(110):
    routes.append(f"r{r},{r},Linija {r},{800 if r%7==0 else 3}")
    path=random.sample(range(S),30)
    for svc in ("WD","WE"):
        for k in range(5*60, 24*60, 8 if svc=="WD" else 15):
            for d,p in ((0,path),(1,path[::-1])):
                t=f"t{n}"; n+=1; trips.append(f"{t},r{r},{svc},Linija {r}")
                m=k
                for i,s in enumerate(p):
                    st.write(f"{t},{m//60:02d}:{m%60:02d}:00,{m//60:02d}:{m%60:02d}:00,s{s},{i+1}\n"); m+=2
cal="service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWD,1,1,1,1,1,0,0,20260101,20271231\nWE,0,0,0,0,0,1,1,20260101,20271231\n"
with zipfile.ZipFile("test/scale.zip","w",zipfile.ZIP_DEFLATED) as z:
    z.writestr("stops.txt","\n".join(stops)); z.writestr("routes.txt","\n".join(routes)); z.writestr("trips.txt","\n".join(trips)); z.writestr("stop_times.txt",st.getvalue()); z.writestr("calendar.txt",cal)
print("trips",n)
