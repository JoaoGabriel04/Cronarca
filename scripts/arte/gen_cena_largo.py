#!/usr/bin/env python3
"""Fundo LARGO: 420x210 (1 px = 6 px). Janela central 240x150 = o palco de 1440x900; 90 px de sangria de cada lado e 30 em cima e embaixo."""
import numpy as np, random, math, sys
from PIL import Image, ImageDraw, ImageFont
W,H=420,210
OX,OY=90,30  # janela da cena (240x150) em x 90..329, y 30..179; o resto e sangria
REPO='/home/claude/joaogabriel04/cronarca/apps/frontend/public/sprites/cena/'
def hexc(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
BAYER=np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]])/16.0
img=np.zeros((H,W,3),dtype=np.uint8)
rng=np.random.RandomState(11); rnd=random.Random(11)
def put(x,y,c):
    if 0<=x<W and 0<=y<H: img[y,x]=c
def grad(y0,y1,stops,x0=0,x1=W):
    for y in range(y0,y1):
        for i in range(len(stops)-1):
            ya,ca=stops[i]; yb,cb=stops[i+1]
            if ya<=y<=yb:
                t=(y-ya)/max(1,yb-ya); t=min(1,max(0,(t-0.3)*2.2)); a,b=hexc(ca),hexc(cb)
                for x in range(x0,x1): img[y,x]=b if BAYER[y%4,x%4]<t else a
                break
def vnoise(sx,sy,seed):
    r=np.random.RandomState(seed); gw,gh=W//sx+3,H//sy+3; g=r.rand(gh,gw)
    out=np.zeros((H,W))
    for y in range(H):
        for x in range(W):
            fx,fy=x/sx,y/sy; ix,iy=int(fx),int(fy); tx,ty=fx-ix,fy-iy
            tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty)
            out[y,x]=(g[iy,ix]*(1-tx)+g[iy,ix+1]*tx)*(1-ty)+(g[iy+1,ix]*(1-tx)+g[iy+1,ix+1]*tx)*ty
    return out
# ---------------- ceu
grad(0,96+OY,[(0,'#05071a'),(10+OY,'#080c24'),(20+OY,'#0c1230'),(30+OY,'#101840'),(40+OY,'#16204c'),(50+OY,'#1c2a5c'),(60+OY,'#26366e'),(70+OY,'#34468a'),(78+OY,'#464c90'),(84+OY,'#5a5694'),(89+OY,'#8a6890'),(93+OY,'#c0806c'),(96+OY,'#d08a68')])
# estrelas
for _ in range(454):
    x,y=rnd.randint(0,W-1),int(rnd.random()**1.7*(80+OY))
    c=rnd.choice(['#8a9ad0','#cfd8ff','#cfd8ff','#fff3b0','#6a7ab0']); put(x,y,hexc(c))
for _ in range(16):
    x,y=rnd.randint(4,W-5),rnd.randint(3,52+OY)
    for dx,dy in((0,0),(1,0),(-1,0),(0,1),(0,-1)): put(x+dx,y+dy,hexc('#e8eeff') if (dx,dy)==(0,0) else hexc('#7a8ac8'))
# via lactea discreta
vl=vnoise(9,5,5)
for y in range(0,60+OY+20):
    for x in range(W):
        d=abs(((y-OY)-(60-(x-OX)*0.22)))
        if d<9 and vl[y,x]>0.55 and BAYER[y%4,x%4]<0.45*(1-d/9): img[y,x]=hexc('#2a3a7a')
# lua e halo
mx,my,mr=190+OX,24+OY,8
for y in range(H):
    for x in range(W):
        d=math.hypot(x+.5-mx,y+.5-my)
        if mr<d<24 and y<96+OY:
            a=(24-d)/(24-mr); 
            if BAYER[y%4,x%4]<a*0.3 and (x+y)%2==0: img[y,x]=hexc('#2a3a7a') if d>14 else hexc('#3a4a8c')
for y in range(H):
    for x in range(W):
        d=math.hypot(x+.5-mx,y+.5-my)
        if d<=mr:
            c='#f6efc8' if d<mr-1.5 else '#d8cfa0'
            if x<mx-2 and y>my: c='#d8d0a4'
            img[y,x]=hexc(c)
for cx,cy in((186+OX,21+OY),(192+OX,25+OY),(189+OX,28+OY),(194+OX,20+OY)): put(cx,cy,hexc('#c8bd90')); put(cx+1,cy,hexc('#c8bd90'))
# nuvens finas iluminadas pela lua
cn=vnoise(22,4,9); cn2=vnoise(9,3,21)
for y in range(40+OY,86+OY):
    for x in range(W):
        v=cn[y,x]*0.7+cn2[y,x]*0.3
        if v>0.66:
            near=max(0,1-math.hypot(x-mx,y-my)/90)
            base=img[y,x].astype(int)
            lift=np.array(hexc('#5a6aa8'))*(0.5+near*0.6)
            img[y,x]=np.clip(base*0.55+lift*0.55,0,255)
            if v>0.74 and BAYER[y%4,x%4]<0.5: img[y,x]=np.clip(img[y,x]+np.array([14,14,18]),0,255)
# ---------------- montanhas e bruma
def ridge(base,amp,seed,f):
    r=np.random.RandomState(seed); ph=r.rand(4)*6.28; out=[]
    for x in range(W):
        v=sum(math.sin(x*f*k/40+ph[k])/k for k in range(1,4)); v+=r.rand()*0.25
        out.append(int(base-amp*(v*0.5+0.5)))
    return out
def fillridge(hs,col,rim=None,bottom=104+OY):
    for x in range(W):
        for y in range(hs[x],bottom): img[y,x]=hexc(col)
        if rim: put(x,hs[x],hexc(rim))
def mist(y0,y1,col,peak):
    for y in range(y0,y1):
        t=1-abs((y-(y0+y1)/2))/((y1-y0)/2)
        for x in range(W):
            if BAYER[y%4,x%4]<t*peak: img[y,x]=hexc(col)
far=ridge(80+OY,14,3,2.2);fillridge(far,'#2c3874','#4a5a98')
mist(78+OY,92+OY,'#5a5a98',0.45)
mid=ridge(88+OY,10,8,3.0);fillridge(mid,'#1f2c60','#34468a')
mist(86+OY,98+OY,'#44508a',0.4)
near=ridge(93+OY,6,15,3.6);fillridge(near,'#16234a','#26366e')
# linha de arvores distantes sobre as colinas
for x in range(0,W,2):
    if rnd.random()<0.72:
        h=rnd.randint(2,5); y0=near[x]
        for k in range(h): put(x,y0-k,hexc('#101c3c'));
        put(x+1,y0-h//2,hexc('#101c3c'))
# ---------------- chao
HZ=93+OY
grad(HZ,H,[(HZ,'#1d4a38'),(100+OY,'#1a4030'),(118+OY,'#163828'),(138+OY,'#102a1e'),(150+OY,'#0b1e15'),(H,'#0a1a12')])
gn=vnoise(5,3,31); gn2=vnoise(3,2,32)
for y in range(HZ,H):
    for x in range(W):
        v=gn[y,x]*0.6+gn2[y,x]*0.4
        c=img[y,x].astype(int)
        if v>0.68 and BAYER[y%4,x%4]<0.6: img[y,x]=np.clip(c+np.array([8,22,10]),0,255)
        elif v<0.28 and BAYER[(y+1)%4,x%4]<0.5: img[y,x]=np.clip(c-np.array([5,10,6]),0,255)
# luz da lua no horizonte do chao (borda clara)
for x in range(W): put(x,HZ,hexc('#2c6a4c')); 
# touceiras
for _ in range(650):
    y=rnd.randint(HZ+3,H-2); x=rnd.randint(1,W-2); d=(y-HZ)/(H-HZ)
    hh=1+int(d*3); lit=hexc('#3a8a56') if rnd.random()<0.6 else hexc('#2a6a44'); dk=hexc('#0e2418') if d>0.6 else hexc('#143626')
    put(x,y,dk)
    for k in range(1,hh+1): put(x-(1 if k>1 else 0),y-k,lit if x%2 else dk); put(x+(1 if k>1 else 0),y-k,lit)
# colina do castelo
CX,CB=120+OX,93+OY
for y in range(CB-2,CB+8):
    for x in range(W):
        d=((x-CX)/66)**2+((y-(CB+3))/7.5)**2
        if d<1:
            c='#2f6a4a' if y<CB+1 else '#24583c'
            img[y,x]=hexc(c) if BAYER[y%4,x%4]<0.85 else hexc('#1d4a38')
# sombra do castelo (lua a direita: sombra para a esquerda)
for y in range(CB-1,CB+5):
    for x in range(W):
        d=((x-(110+OX))/34)**2+((y-(CB+1.5))/3.4)**2
        if d<1: img[y,x]=np.clip(img[y,x].astype(int)*0.45,0,255)
# caminho de terra
pts=[(120+OX,CB),(110+OX,CB+5),(92+OX,CB+10),(76+OX,CB+18),(68+OX,CB+32),(66+OX,H)]
def bez(ps,t):
    ps=list(ps)
    while len(ps)>1: ps=[((1-t)*a[0]+t*b[0],(1-t)*a[1]+t*b[1]) for a,b in zip(ps,ps[1:])]
    return ps[0]
rows={}
for i in range(400):
    t=i/399; x,y=bez(pts,t); w=2.2+(t**1.7)*17
    rows.setdefault(int(y),[]).append((x-w,x+w))
for y,sp in rows.items():
    xa=min(a for a,b in sp); xb=max(b for a,b in sp)
    for x in range(int(xa),int(xb)+1):
        e=(x-xa)/(xb-xa+1e-6); 
        c='#6a4a30'
        if e<0.12 or e>0.88: c='#4a3220'
        elif 0.35<e<0.65 and BAYER[y%4,x%4]<0.5: c='#86603c'
        elif BAYER[(y+x)%4,x%4]<0.2: c='#5a3e28'
        put(x,y,hexc(c))
    put(int(xa),y,hexc('#2a1c12')); put(int(xb),y,hexc('#2a1c12'))
for _ in range(60):
    y=rnd.randint(CB+3,H-2)
    if y in rows:
        xa=min(a for a,b in rows[y]); xb=max(b for a,b in rows[y]); x=int(rnd.uniform(xa+2,xb-2)); c=hexc(rnd.choice(['#8a8a8a','#6e6e72','#a0a0a0']))
        put(x,y,c); put(x+1,y,c)
# luz das tochas no portao
for y in range(CB-12,CB+3):
    for x in range(100+OX,141+OX):
        d=math.hypot((x-(120+OX))/20,(y-(CB-4))/8)
        if d<1 and BAYER[y%4,x%4]<(1-d)*0.5:
            img[y,x]=np.clip(img[y,x].astype(int)+np.array([40,26,0]),0,255)
# ---------------- primeiro plano escuro
def moita(cx,cy,r,col,lit):
    for y in range(cy-r,cy+r):
        for x in range(cx-int(r*1.6),cx+int(r*1.6)):
            d=((x-cx)/(r*1.6))**2+((y-cy)/r)**2
            if d<1 and y<H and 0<=x<W and y>=0: img[y,x]=hexc(lit) if (y<cy-r*0.45 and BAYER[y%4,x%4]<0.7 and x>cx-2) else hexc(col)
moita(8,H+2,13,'#071510','#12301e'); moita(W-8,H+2,14,'#071510','#12301e'); moita(W//2,H+6,9,'#081811','#0f2a1a')
for x in range(0,W):
    if rnd.random()<0.55:
        h=rnd.randint(2,7) if (x<30 or x>W-34) else rnd.randint(1,3)
        for k in range(h): put(x,H-1-k,hexc('#08150f') if k<h-1 else hexc('#16361f'))
# vaga-lumes
FF0=[(30,98),(52,122),(18,132),(98,111),(142,110),(176,100),(200,124),(214,108),(160,132),(74,104),(36,140),(228,136),(190,140),(128,101)]
FF=[(x+OX,y+OY) for x,y in FF0]+[(rnd.randint(4,OX-4),rnd.randint(HZ+4,H-8)) for _ in range(5)]+[(rnd.randint(W-OX+4,W-4),rnd.randint(HZ+4,H-8)) for _ in range(5)]
for x,y in FF:
    for dx,dy in((1,0),(-1,0),(0,1),(0,-1)): put(x+dx,y+dy,hexc('#4a6a30'))
    put(x,y,hexc('#e8f58a'))
# ---------------- saida
Image.fromarray(img,'RGB').save('/home/claude/cena/fundo_inicio_largo.png')
print(W,H)
