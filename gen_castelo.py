#!/usr/bin/env python3
"""Castelo v2 (96x96, 1 px = 3 px do frame 1440x900): base em talude, fundacao, degraus e grama por cima da pedra."""
import math, random, sys
from PIL import Image
N=96
NF=8
def hx(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,)
OL=hx('#0e1624'); 
ST=[hx(c) for c in ('#4c5870','#6c7a92','#8c9ab2','#b4c2d8')]   # sombra, base, luz, luar
MORT=hx('#586478'); FUND=[hx('#3a4458'),hx('#4c586c')]
SL=[hx(c) for c in ('#22386e','#34549a','#5a7acb','#88a4e8')]
WD=[hx('#4a2c18'),hx('#6e4426'),hx('#96663a')]
GOLD=hx('#f4d060'); GOLD_D=hx('#b88a28'); RED=[hx('#7a1e1c'),hx('#b8402c'),hx('#e07058')]
GLOW=[hx('#a06a20'),hx('#f4c860'),hx('#fff0b0')]
MOSS=[hx('#2e5a38'),hx('#4a8a4c'),hx('#78b060')]
def sprite(FRM):
    P={}
    def put(x,y,c):
        if 0<=x<N and 0<=y<N: P[(x,y)]=c
    def rect(x0,y0,x1,y1,c):
        for y in range(y0,y1+1):
            for x in range(x0,x1+1): put(x,y,c)
    def stone(x0,y0,x1,y1,dirn=1,rows=4,wj=7):
        """parede de tijolos com sombreamento cilindrico (luz a direita)"""
        w=x1-x0+1
        for y in range(y0,y1+1):
            for x in range(x0,x1+1):
                fr=(x-x0)/max(1,w-1)
                c=ST[1]
                if fr<0.22: c=ST[0]
                elif fr>0.78: c=ST[2]
                if fr>0.93: c=ST[3]
                put(x,y,c)
        for r,y in enumerate(range(y0+rows,y1+1,rows)):
            for x in range(x0,x1+1): put(x,y,MORT)
            off=0 if r%2==0 else wj//2
            for x in range(x0+off,x1+1,wj):
                for yy in range(y-rows+1,y): put(x,yy,MORT)
    def outline_all():
        occ=set(P)
        for (x,y) in list(occ):
            for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
                q=(x+dx,y+dy)
                if q not in occ and 0<=q[0]<N and 0<=q[1]<N: P[q]=OL
    def arch(cx,y_base,hw,h,col):
        for y in range(y_base-h,y_base+1):
            for x in range(cx-hw,cx+hw+1):
                top=y_base-h
                inside=True
                if y<top+hw:
                    d=math.hypot(x-cx+0.0,y-(top+hw)); inside=d<=hw+0.2
                if inside: put(x,y,col)
    def window(cx,cy,bright):
        arch(cx,cy+6,2,6,GLOW[0]);
        for y in range(cy,cy+7): put(cx,y,GLOW[1] if bright else GLOW[0]); put(cx-1,y,GLOW[2] if bright and y<cy+3 else GLOW[1]);put(cx+1,y,GLOW[0])
        put(cx-2,cy+7,ST[2]);put(cx-1,cy+7,ST[2]);put(cx,cy+7,ST[2]);put(cx+1,cy+7,ST[2]);put(cx+2,cy+7,ST[2])
    def flag(x0,y0,L,Hh,f):
        ph=2*math.pi*f/NF
        for k in range(L):
            amp=0.3+1.9*k/L
            sn=math.sin(ph-k*0.8)
            dy=round(amp*sn)
            tail=k-(L-4)
            for j in range(Hh):
                if tail>0 and abs(j-(Hh-1)/2)<=tail*0.55-0.2: continue
                if j==0: c=RED[2] if math.cos(ph-k*0.8)>-0.3 else RED[1]
                elif j==Hh-1: c=RED[0]
                else: c=RED[0] if math.cos(ph-k*0.8)<-0.55 else RED[1]
                put(x0+k,y0+j+dy,c)
        put(x0+2,y0+Hh//2+round(0.3*math.sin(ph-1.6)),GOLD)
    GY=88   # linha do chao (ultima linha de pedra)
    # ---------- fundacao em talude: mais larga que as paredes
    for y in range(GY-5,GY+1):
        e=(y-(GY-5))*0.7
        for x in range(int(3-e),int(93+e)+1):
            c=FUND[0] if ((x//5+y//3)%2==0) else FUND[1]
            put(x,y,c)
    # ---------- muralha de tras
    stone(8,50,87,GY-6,rows=4,wj=8)
    for x in range(8,88,8):      # ameias
        rect(x,46,x+4,50,ST[1]); rect(x+4,46,x+4,50,ST[2]); 
        for yy in range(46,51): put(x,yy,ST[0])
    rect(8,50,87,51,ST[2])
    # ---------- torres de canto
    for tx in (4,72):
        stone(tx,26,tx+19,GY-6,rows=4,wj=6)
        rect(tx-1,26,tx+20,28,ST[2]); rect(tx-1,29,tx+20,29,ST[0])   # cinta
        # telhado conico
        for y in range(6,26):
            f=(y-6)/20; hw=int(2+f*12); cx=tx+10
            for x in range(cx-hw,cx+hw+1):
                fr=(x-(cx-hw))/max(1,2*hw)
                c=SL[1]
                if fr<0.3: c=SL[0]
                elif fr>0.7: c=SL[2]
                if fr>0.9: c=SL[3]
                if (y%4==0) or ((x+(y//4)*3)%6==0 and y%4!=0): c=SL[0] if fr<0.7 else SL[1]
                put(x,y,c)
        for x in range(tx-2,tx+22): put(x,25,SL[0]); put(x,24,SL[1])
        # mastro e bandeira
        for y in range(2,8): put(tx+10,y,WD[1])
        flag(tx+11,3,13,5,FRM)
        window(tx+10,36,(FRM in (0,1,3,6))); window(tx+10,56,(FRM in (2,4,5,7)))
        # hera na base
        for (mx,my) in ((tx+2,GY-9),(tx+3,GY-10),(tx+2,GY-11),(tx+5,GY-8),(tx+4,GY-9),(tx+3,GY-13),(tx+6,GY-7)): put(mx,my,MOSS[1]); put(mx+1,my,MOSS[0])
    # ---------- torre de menagem (central, alta)
    stone(31,18,64,GY-6,rows=4,wj=8)
    for x in range(31,65,6):
        rect(x,12,x+3,18,ST[1]); rect(x+3,12,x+3,18,ST[2]); rect(x,12,x,18,ST[0])
    rect(31,18,64,19,ST[2])
    # telhado pequeno central com pavilhao
    for y in range(2,12):
        f=(y-2)/10; hw=int(1+f*5); cx=47
        for x in range(cx-hw,cx+hw+1): put(x,y,SL[2] if x>cx else SL[1])
    for y in range(0,3): put(47,y,WD[1])
    flag(48,0,9,3,FRM+3)
    window(40,24,(FRM in (2,4,5,7)));window(55,24,(FRM in (0,1,3,6)));window(47,40,True)
    # ---------- guarita da porta (mais proxima: mais clara, projetada)
    stone(35,56,60,GY-6,rows=4,wj=7)
    for y in range(56,GY-5):
        put(35,y,ST[2]);put(36,y,ST[2])
    rect(33,54,62,57,ST[2]); rect(33,58,62,58,ST[0])
    for x in range(33,63,6): rect(x,50,x+3,54,ST[2]); put(x,50,ST[3]);put(x+3,50,ST[1])
    # arco e porta
    arch(47,GY-6,8,24,hx('#1a0f0a'))
    arch(47,GY-6,6,22,WD[1])
    for x in range(41,54):
        for y in range(GY-6-18,GY-5):
            if (x-41)%4==0: put(x,y,WD[0])
    for y in (GY-6-13,GY-6-6):
        for x in range(41,54): put(x,y,hx('#5a6070')); put(x,y+1,hx('#3a4050'))
    for (x,y) in ((44,GY-6-9),(50,GY-6-9)): put(x,y,GOLD); put(x+1,y,GOLD_D)
    # grade levadica (herse) acima
    for x in range(41,54,3):
        for y in range(GY-6-24,GY-6-17): put(x,y,hx('#6a7080'))
    # brasao sobre a porta
    for (x,y) in ((46,58),(47,58),(48,58)): put(x,y,GOLD)
    for (x,y) in ((47,59),(47,60)): put(x,y,GOLD_D)
    # tochas
    for tx in (36,58):
        for y in range(70,75): put(tx,y,WD[1])
        k=[(0,0),(0,-1),(1,-1),(0,-2),(-1,-1),(0,0),(1,-2),(0,-1)][FRM]
        put(tx,69,hx('#e87a28')); put(tx+k[0],68+k[1],hx('#ffd060')); put(tx,68,hx('#ff9a30'))
    # degraus
    for i,(x0,x1) in enumerate(((36,58),(34,60),(32,62))):
        y=GY-5+i
        for x in range(x0,x1+1): put(x,y,ST[3] if i==0 else (ST[2] if i==1 else ST[1]))
    # luz de luar: contorno claro do lado direito das torres
    outline_all()
    # grama e arbustos por cima da fundacao (faz o castelo "tocar" o chao)
    rnd=random.Random(5)
    for x in range(-2,N+2):
        h=rnd.choice((2,2,3,4,3,2,5)) if not(34<=x<=62) else rnd.choice((1,1,2))
        base=GY+3+(1 if rnd.random()<0.4 else 0)
        for k in range(h+1):
            c=MOSS[0] if k==0 else (MOSS[1] if k<h else MOSS[2])
            put(x,base-k,c)
        if rnd.random()<0.3: put(x,base-h-1,MOSS[2])
    for (bx,w) in ((2,9),(82,10),(22,6),(68,6)):
        for y in range(GY-1,GY+5):
            for x in range(bx,bx+w):
                d=((x-bx-w/2)/(w/2))**2+((y-(GY+2))/3.2)**2
                if d<1: put(x,y,MOSS[1] if (y<GY+1) else MOSS[0])
        put(bx+2,GY-1,MOSS[2]); put(bx+w-3,GY,MOSS[2])
    # ambient occlusion na linha do chao
    for x in range(0,N):
        for y in range(GY+2,GY+7):
            if (x,y) in P and P[(x,y)] in FUND: P[(x,y)]=hx('#262e3e')
    im=Image.new('RGBA',(N,N),(0,0,0,0))
    for (x,y),c in P.items(): im.putpixel((x,y),c)
    return im
if __name__=='__main__':
    out=sys.argv[1] if len(sys.argv)>1 else '/home/claude/cena/out'
    import os; os.makedirs(out,exist_ok=True)
    for f in range(NF): sprite(f).save(f'{out}/castelo_{f+1}.png')
    print('ok')
