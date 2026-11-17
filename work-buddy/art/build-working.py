# Builds hooks/working-art.ts: the working character from art/claude-working.svg,
# cut into layers (body, hair, hand, eyes, three stripes, laptop glow) so each
# part animates on its own: the hand types, the eyes blink, the hair sways and
# the stripes flash from the laptop. The "Working" pill under the art is dropped.
# Run: python -I art/build-working.py   (needs pillow, numpy, scipy)
import sys, io, base64, os, re
from PIL import Image
import numpy as np
from scipy import ndimage as nd
HERE=os.path.dirname(os.path.abspath(__file__))
svg_text=open(os.path.join(HERE,'claude-working.svg'),encoding='utf8').read()
png=base64.b64decode(re.sub(r'\s','',re.search(r'base64,([A-Za-z0-9+/=\s]+)',svg_text).group(1)))
img=Image.open(io.BytesIO(png)).convert('RGBA'); a0=np.array(img)
a=a0.astype(int); R,G,B,A=a[...,0],a[...,1],a[...,2],a[...,3]
present=A>24
skin=present&(R>225)&(G>195)&(B>170)
orange=present&(R>190)&(G>80)&(G<185)&(B<130)&(R-B>90)
black=present&((0.3*R+0.59*G+0.11*B)<80)
H,W=present.shape
yy,xx=np.mgrid[0:H,0:W]
def disk(r):
  y,x=np.ogrid[-r:r+1,-r:r+1]; return x*x+y*y<=r*r
def grow(m,r): return nd.binary_dilation(m,structure=disk(r))
lab,_=nd.label(skin)
head_skin=lab==lab[460,258]; hand_skin=lab==lab[610,225]
olab,_=nd.label(orange)
def comp(y,x): return olab==olab[y,x]
hair_o=comp(300,240)|comp(455,365)
# stripes: yellow-orange blobs to the right of the head
stripes_o=[comp(460,425),comp(488,455),comp(527,463)]
aster_o=comp(611,370)
# head: skin + its outline and the antialiased rim
head=nd.binary_fill_holes(grow(head_skin,2)|(grow(head_skin,13)&black&(yy>455)))
box=(xx>185)&(xx<345)&(yy>450)&(yy<510)
elab,ne=nd.label(black&box&~skin)
sizes=[(elab==i).sum() for i in range(1,ne+1)]
eye_list=[grow(elab==i,5)&box for i in range(1,ne+1) if sizes[i-1]>150]
def outlined(core,r=12):
  return (grow(core,r+3)&present&~black)&grow(core,6) | (grow(core,r)&black) | (grow(core,r+4)&present&~grow(black|core,0)&~skin&~((0.3*R+0.59*G+0.11*B)<120)) | (grow(core,r+3)&present&(A<200))
# the laptop: its grey lid and base plus their outline. No other layer may take
# its pixels: the lowest stripe's outline touches the lid's top-right corner, and
# taking them cut that corner off whenever the stripes were hidden.
lum=0.3*R+0.59*G+0.11*B
grey=(A>200)&(lum>=45)&(lum<110)&(abs(R-G)<25)&(abs(G-B)<25)
glab,_=nd.label(grey)
laptop=grow(glab==glab[560,380],11)&present
hand=outlined(hand_skin,12)&~laptop
hair=outlined(hair_o,12)&~head
stripes=[outlined(s,11)&~laptop for s in stripes_o]
print('eyes',len(eye_list),'hand',hand.sum(),'hair',hair.sum())
# body: everything else; hand and eyes inpainted from their nearest neighbours,
# hair inpainted only where it covered the robe (below the head's middle)
body=a0.copy()
def fill(dst,mask):
  _,(iy,ix)=nd.distance_transform_edt(mask,return_indices=True)
  dst[mask]=dst[iy[mask],ix[mask]]
fill(body,hand)
skin_rgb=np.median(a0[head_skin],axis=0).astype(np.uint8)
for e in eye_list: body[e]=skin_rgb
body[hair]=0
body[grow(hair_o,24)&~head&(yy<465)]=0
for s_ in stripes_o: body[grow(s_,16)]=0
# the robe under the lower-left petal: fill hair pixels that sit inside the robe's silhouette
robe_zone=hair&(yy>470)
dist=nd.distance_transform_edt(robe_zone)
fill(body,robe_zone)
body[robe_zone&(dist>5)]=0
body[laptop]=a0[laptop]
def layer(mask,src=a0):
  out=np.zeros_like(a0); out[mask]=src[mask]; return out
L={'body':body,'hair':layer(hair),'hand':layer(hand)}
for i,e in enumerate(eye_list): L[f'eye{i}']=layer(e)
for i,s in enumerate(stripes): L[f'stripe{i}']=layer(s)
glow=layer(grow(aster_o,2)).astype(float)
gm=glow[...,3]>0; glow[gm,:3]=glow[gm,:3]*0.25+np.array([255,226,150])*0.75
L['glow']=glow.astype(np.uint8)
# crop box: the character only (the pill below is dropped)
ys,xs=np.nonzero(present&(yy<700)); pad=8
X0,Y0,X1,Y1=xs.min()-pad,ys.min()-pad,xs.max()+pad,ys.max()+pad
K=0.5
def enc(arr):
  im=Image.fromarray(arr,'RGBA').crop((X0,Y0,X1,Y1))
  bb=im.getbbox()
  if bb is None: return None
  # snap to even so half-scale lands on whole pixels
  bb=(bb[0]//2*2,bb[1]//2*2,(bb[2]+1)//2*2,(bb[3]+1)//2*2)
  part=im.crop(bb)
  small=part.convert('RGBa').resize((part.width//2,part.height//2),Image.LANCZOS).convert('RGBA')
  q=small.quantize(colors=96,method=Image.FASTOCTREE)
  buf=io.BytesIO(); q.save(buf,'PNG',optimize=True)
  return dict(x=bb[0]*K,y=bb[1]*K,w=small.width,h=small.height,png=base64.b64encode(buf.getvalue()).decode())
res={k:enc(v) for k,v in L.items()}
def pt(x,y): return [round((x-X0)*K,1),round((y-Y0)*K,1)]
meta=dict(W=round((X1-X0)*K),H=round((Y1-Y0)*K),
  hairPivot=pt(258,520),
  eyes=[pt(*(lambda m:(m.nonzero()[1].mean(),m.nonzero()[0].mean()))(e)) for e in eye_list],
  stripePivot=pt(400,560))

def r1(v): return round(float(v),1)
W,H=meta['W'],meta['H']
hx,hy=meta['hairPivot']; sx,sy=meta['stripePivot']
def img(name,cls='',style=''):
  l=res[name]
  c=f' class="{cls}"' if cls else ''
  st=f' style="{style}"' if style else ''
  return f'<image{c}{st} x="{r1(l["x"])}" y="{r1(l["y"])}" width="{l["w"]}" height="{l["h"]}" href="data:image/png;base64,{l["png"]}"/>'
# The app restarts this picture about once a second (it redraws it each time
# another mod's pane ticks, with the source this module gave last). So:
# - steady motion repeats exactly every second, so a restart lands on the same
#   frame and cannot be seen. It runs from --t, the clock time the module stamps
#   into the source when it draws (vector.ts), so its own redraws carry on too.
# - an occasional moment cannot fit in a second: its first seconds are still and
#   it runs from the picture's own start, so while restarts come every second it
#   never begins and nothing jumps; without them it happens now and then.
steady = f"""
.hair{{animation:hair .5s ease-in-out infinite alternate;transform-origin:{r1(hx)}px {r1(hy)}px}}
@keyframes hair{{0%{{transform:rotate(-1deg)}}100%{{transform:rotate(1deg)}}}}
.hand{{animation:type 1s linear infinite}}
@keyframes type{{0%,100%{{transform:translateY(0)}}10%{{transform:translateY(-5px)}}20%{{transform:translateY(0)}}34%{{transform:translateY(-3px)}}44%{{transform:translateY(0)}}60%{{transform:translateY(-6px)}}70%{{transform:translateY(0)}}82%{{transform:translateY(-2.5px)}}90%{{transform:translateY(0)}}}}
.spark{{animation:spark 1s ease-out infinite;transform-origin:{r1(sx)}px {r1(sy)}px}}
@keyframes spark{{0%,100%{{opacity:.2;transform:scale(.8)}}12%{{opacity:1;transform:scale(1.08)}}24%{{transform:scale(1)}}50%{{opacity:1;transform:scale(1)}}70%{{opacity:.2;transform:scale(.85)}}}}
.glow{{animation:glow 1s ease-out infinite}}
@keyframes glow{{0%,70%,100%{{opacity:0}}15%,50%{{opacity:.85}}}}
@media (prefers-reduced-motion:reduce){{.hair,.hand,.spark,.glow{{animation:none}}.glow{{opacity:0}}}}
"""
now_and_then = f"""
.eye{{animation:blink 6.5s ease-in-out infinite}}
@keyframes blink{{0%,38%,42%,86%,89%,92%,100%{{transform:scaleY(1)}}40%,87.5%,90.5%{{transform:scaleY(.12)}}}}
@media (prefers-reduced-motion:reduce){{.eye{{animation:none}}}}
"""
squash = lambda c: re.sub(r'\s*\n\s*', '', c)
css = ('svg{--t:0ms}' + re.sub(r'(animation:[^;}]+)', r'\1;animation-delay:calc(var(--d,0s) - var(--t,0ms))', squash(steady))
       + squash(now_and_then))
eyes=''.join(img(f'eye{i}','eye',f'transform-origin:{r1(x)}px {r1(y)}px') for i,(x,y) in enumerate(meta['eyes']))
sparks=''.join(img(f'stripe{i}','spark',f'--d:{i*0.09:.2f}s') for i in range(3))
svg=(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><style>{css}</style>'
     f'<g class="hair">{img("hair")}</g>{img("body")}{img("glow","glow")}{eyes}<g class="hand">{img("hand")}</g>{sparks}</svg>')
out=os.path.join(HERE,'..','hooks','working-art.ts')
open(out,'w',encoding='utf8',newline='\n').write(
  '// Generated by art/build-working.py from art/claude-working.svg: do not edit by hand.\n\n'
  f'export const WORKING_SVG = {svg!r}\n\nexport const WORKING_WIDTH = {W}\nexport const WORKING_HEIGHT = {H}\n'.replace("= '", '= `',1).replace("'\n\nexport const WORKING_WIDTH", '`\n\nexport const WORKING_WIDTH',1))
print('wrote',out,len(svg),'chars')
