# Paket 7: parça / yüz rengi (kalıcı), STL içe aktarma (küp → katı, hacim)
import cmdpatch, time, struct, base64
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
def cube_stl(s=10):
    V=[(0,0,0),(s,0,0),(s,s,0),(0,s,0),(0,0,s),(s,0,s),(s,s,s),(0,s,s)]
    F=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
    b=bytearray(80)+struct.pack("<I",len(F))
    for f in F: b+=struct.pack("<3f",0,0,0)+b"".join(struct.pack("<3f",*V[i]) for i in f)+b"\0\0"
    return base64.b64encode(bytes(b)).decode()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    run(pg,"kutu",[sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,30)), ext("e1","s1",20)])
    pg.evaluate("(()=>{const a=window.__app; const d=JSON.parse(JSON.stringify(a.doc)); d.look={part:'#ff0000', faces:[{ref:{c:[20,15,20],n:[0,0,1]},color:'#00ff00'}]}; a.setDoc(d);})()"); time.sleep(0.5); wait_ready(pg)
    st = pg.evaluate("(()=>{const v=window.__app.viewer; return [v.partColor, [...v.faceColors.values()], !!v.modelMesh.geometry.getAttribute('color')]})()")
    chk("parça kırmızı, ön yüz yeşil (köşe rengi)", st[0]==0xff0000 and st[1]==[0x00ff00] and st[2], st)
    # derinlik değişince ön yüz rengi kalır
    pg.evaluate("(()=>{const a=window.__app; const d=JSON.parse(JSON.stringify(a.doc)); d.features[1].d1=25; a.setDoc(d);})()"); time.sleep(0.5); wait_ready(pg)
    chk("ölçü değişince yüz rengi korunur", pg.evaluate("[...window.__app.viewer.faceColors.values()]")==[0x00ff00])
    # STL içe aktar
    f = {"id":"im1","type":"import","name":"kup","file":"kup.stl","data":cube_stl(),"fmt":"stl"}
    m = run(pg,"stl",[f])
    chk("STL küp: tek gövde, 10 mm", m and m["bodies"]==1 and m["bb"]==[[0,0,0],[10,10,10]], m)
    vol = pg.evaluate("window.__app.kernel.props().then(r=>r && r.volume)")
    chk("STL küp katı (hacim 1000)", vol and abs(vol-1000)<1, vol)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")
