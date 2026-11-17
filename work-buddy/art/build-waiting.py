# Builds hooks/waiting-art.ts: the waiting character from art/claude-waiting.svg,
# cut into layers (body, hair, two hands, eyes, speech bubble, three dots) so each
# part animates on its own: the eyes blink and glance around, the dots in the
# bubble pulse like someone typing, the bubble floats, the hair sways and the
# fingers drum now and then. The "Waiting" pill under the art is dropped.
# Run: python -I art/build-waiting.py   (needs pillow, numpy, scipy)
import io, base64, os, re
from PIL import Image
import numpy as np
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
svg_text = open(os.path.join(HERE, 'claude-waiting.svg'), encoding='utf8').read()
png = base64.b64decode(re.sub(r'\s', '', re.search(r'base64,([A-Za-z0-9+/=\s]+)', svg_text).group(1)))
a0 = np.array(Image.open(io.BytesIO(png)).convert('RGBA'))
a = a0.astype(int); R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
lum = 0.3 * R + 0.59 * G + 0.11 * B
present = A > 24
skin = present & (R > 225) & (G > 195) & (B > 170)
orange = present & (R > 190) & (G > 80) & (G < 185) & (B < 130) & (R - B > 90)
black = present & (lum < 80)
H, W = present.shape
yy, xx = np.mgrid[0:H, 0:W]

def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
def grow(m, r): return nd.binary_dilation(m, structure=disk(r))
def fill(dst, mask, sources=None):
    ok = ~mask if sources is None else (sources & ~mask)
    _, (iy, ix) = nd.distance_transform_edt(~ok, return_indices=True)
    dst[mask] = dst[iy[mask], ix[mask]]
def outlined(core, r=12):
    return ((grow(core, r + 3) & present & ~black) & grow(core, 6)) | (grow(core, r) & black) \
        | (grow(core, r + 4) & present & ~black & ~skin & ~(lum < 120)) | (grow(core, r + 3) & present & (A < 200))
def centroid(m):
    ys, xs = m.nonzero(); return xs.mean(), ys.mean()

slab, _ = nd.label(skin)
head_skin = slab == slab[460, 244]
hand_r_skin = slab == slab[525, 315]
hand_l_skin = slab == slab[540, 196]
bubble_skin = slab == slab[262, 421]  # above the dots, which sit on the bubble's middle row
assert all(m.sum() < 30000 for m in (head_skin, hand_r_skin, hand_l_skin, bubble_skin)), "a seed missed its region"

olab, no = nd.label(orange)
hair_o = np.zeros_like(present); aster_o = None
for i in range(1, no + 1):
    m = olab == i
    if m.sum() < 500: continue
    cx, cy = centroid(m)
    if cy < 530: hair_o |= m
    elif cy < 680: aster_o = m

# the laptop: grey lid and base plus their outline; no other layer takes its pixels
grey = (A > 200) & (lum >= 45) & (lum < 110) & (abs(R - G) < 25) & (abs(G - B) < 25)
glab, _ = nd.label(grey)
laptop = grow(glab == glab[570, 420], 11) & present & (lum < 180)  # light pixels near it are the hands' edges

head = nd.binary_fill_holes(grow(head_skin, 2) | (grow(head_skin, 13) & black & (yy > 455)))
eye_box = (xx > 185) & (xx < 325) & (yy > 425) & (yy < 505)
elab, ne = nd.label(black & eye_box & ~skin)
eye_list = [grow(elab == i, 5) & eye_box for i in range(1, ne + 1) if (elab == i).sum() > 150]
eye_list.sort(key=lambda m: centroid(m)[0])

bubble_all = nd.binary_fill_holes(outlined(bubble_skin, 12))
dlab, nd_ = nd.label(black & nd.binary_erosion(nd.binary_fill_holes(bubble_skin), structure=disk(3)) & ~bubble_skin)
dot_list = [grow(dlab == i, 4) & ~grow(~nd.binary_fill_holes(bubble_skin), 2) for i in range(1, nd_ + 1) if (dlab == i).sum() > 60]
dot_list.sort(key=lambda m: centroid(m)[0])

hand_r = outlined(hand_r_skin, 12) & ~laptop & ~eye_box
hand_l = outlined(hand_l_skin, 12) & ~laptop & ~eye_box
hair = outlined(hair_o, 12) & ~head & ~hand_r & ~hand_l
print('eyes', len(eye_list), 'dots', len(dot_list), 'hair', int(hair.sum()), 'hands', int(hand_l.sum()), int(hand_r.sum()))

# body: everything else, with the moving parts' places filled in
body = a0.copy()
# a lifted hand shows the bottom of its place: fill it from the dark robe only,
# never from the face's skin
hands = hand_r | hand_l
specks = grow(hands, 4) & ~hands & ~head & ~laptop & present & (lum > 90) & (yy > 525)  # light rim bits left beside the hands
fill(body, hands | specks, present & (lum < 110) & (A > 200))
skin_rgb = np.median(a0[head_skin], axis=0).astype(np.uint8)
for e in eye_list: body[e] = skin_rgb
body[hair] = 0
body[grow(hair_o, 24) & ~head & (yy < 465) & ~grow(bubble_all, 2)] = 0
body[grow(bubble_all, 14) & ~hair & (yy < 380)] = 0
robe_zone = hair & (yy > 470)
dist = nd.distance_transform_edt(robe_zone)
fill(body, robe_zone)
body[robe_zone & (dist > 5)] = 0
body[laptop] = a0[laptop]

bubble = a0.copy(); bubble[~(grow(bubble_all, 3) & present & (yy < 380))] = 0
bubble_rgb = np.median(a0[bubble_skin], axis=0).astype(np.uint8)
for d in dot_list: bubble[d] = bubble_rgb

def layer(mask):
    out = np.zeros_like(a0); out[mask] = a0[mask]; return out
L = {'body': body, 'hair': layer(hair), 'handL': layer(hand_l), 'handR': layer(hand_r), 'bubble': bubble}
for i, e in enumerate(eye_list): L[f'eye{i}'] = layer(e)
for i, d in enumerate(dot_list): L[f'dot{i}'] = layer(d)

# crop: the character and bubble only (the pill below is dropped)
ys, xs = np.nonzero(present & (yy < 712)); pad = 8
X0, Y0, X1, Y1 = xs.min() - pad, ys.min() - pad, xs.max() + pad, ys.max() + pad
K = 0.5
def enc(arr):
    im = Image.fromarray(arr, 'RGBA').crop((X0, Y0, X1, Y1))
    bb = im.getbbox()
    bb = (bb[0] // 2 * 2, bb[1] // 2 * 2, (bb[2] + 1) // 2 * 2, (bb[3] + 1) // 2 * 2)
    part = im.crop(bb)
    small = part.convert('RGBa').resize((part.width // 2, part.height // 2), Image.LANCZOS).convert('RGBA')
    q = small.quantize(colors=96, method=Image.FASTOCTREE)
    buf = io.BytesIO(); q.save(buf, 'PNG', optimize=True)
    return dict(x=bb[0] * K, y=bb[1] * K, w=small.width, h=small.height, png=base64.b64encode(buf.getvalue()).decode())
res = {k: enc(v) for k, v in L.items()}
def pt(x, y): return (round(float((x - X0) * K), 1), round(float((y - Y0) * K), 1))
Wd, Hd = round((X1 - X0) * K), round((Y1 - Y0) * K)
hx, hy = pt(244, 520)
bx, by = pt(*centroid(bubble_skin))
eyes_c = [pt(*centroid(e)) for e in eye_list]
dots_c = [pt(*centroid(d)) for d in dot_list]
hands_c = {'handL': pt(*centroid(hand_l_skin)), 'handR': pt(*centroid(hand_r_skin))}

def img(name, cls='', style=''):
    l = res[name]
    c = f' class="{cls}"' if cls else ''
    st = f' style="{style}"' if style else ''
    return f'<image{c}{st} x="{l["x"]}" y="{l["y"]}" width="{l["w"]}" height="{l["h"]}" href="data:image/png;base64,{l["png"]}"/>'

# The app restarts this picture about once a second (it redraws it each time
# another mod's pane ticks, with the source this module gave last). So:
# - steady motion repeats exactly every second, so a restart lands on the same
#   frame and cannot be seen. It runs from --t, the clock time the module stamps
#   into the source when it draws (vector.ts), so its own redraws carry on too.
# - an occasional moment cannot fit in a second: its first seconds are still and
#   it runs from the picture's own start, so while restarts come every second it
#   never begins and nothing jumps; without them it happens now and then.
steady = f"""
.hair{{animation:hair .5s ease-in-out infinite alternate;transform-origin:{hx}px {hy}px}}
@keyframes hair{{0%{{transform:rotate(-.8deg)}}100%{{transform:rotate(.8deg)}}}}
.bubble{{animation:float .5s ease-in-out infinite alternate;transform-origin:{bx}px {by}px}}
@keyframes float{{0%{{transform:translateY(0)}}100%{{transform:translateY(-1.5px)}}}}
.dot{{animation:dot 1s ease-in-out infinite}}
@keyframes dot{{0%,55%,100%{{transform:translateY(0);opacity:.35}}25%{{transform:translateY(-2.5px);opacity:1}}}}
.drumR{{animation:drumR 1s ease-in-out infinite}}
@keyframes drumR{{0%,20%,42%,100%{{transform:translateY(0)}}10%,32%{{transform:translateY(-2.5px)}}}}
.drumL{{animation:drumL 1s ease-in-out infinite}}
@keyframes drumL{{0%,56%,74%,100%{{transform:translateY(0)}}65%{{transform:translateY(-2.5px)}}}}
@media (prefers-reduced-motion:reduce){{.hair,.bubble,.drumL,.drumR{{animation:none}}.dot{{animation:none;opacity:1}}}}
"""
now_and_then = f"""
.look{{animation:look 9s ease-in-out infinite}}
@keyframes look{{0%,14%,52%,64%,100%{{transform:translate(0,0)}}18%,34%{{transform:translate(3px,-2px)}}38%,48%{{transform:translate(0,0)}}68%,80%{{transform:translate(-3px,0)}}84%,96%{{transform:translate(0,0)}}}}
.eye{{animation:blink 5.8s ease-in-out infinite}}
@keyframes blink{{0%,44%,48%,90%,93%,96%,100%{{transform:scaleY(1)}}46%,91.5%,94.5%{{transform:scaleY(.1)}}}}
@media (prefers-reduced-motion:reduce){{.look,.eye{{animation:none}}}}
"""
squash = lambda c: re.sub(r'\s*\n\s*', '', c)
css = ('svg{--t:0ms}' + re.sub(r'(animation:[^;}]+)', r'\1;animation-delay:calc(var(--d,0s) - var(--t,0ms))', squash(steady))
       + squash(now_and_then))
eyes = ''.join(img(f'eye{i}', 'eye', f'transform-origin:{x}px {y}px') for i, (x, y) in enumerate(eyes_c))
dots = ''.join(img(f'dot{i}', 'dot', f'--d:{i * 0.2:.2f}s') for i in range(len(dots_c)))
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wd} {Hd}" width="{Wd}" height="{Hd}"><style>{css}</style>'
       f'<g class="hair">{img("hair")}</g>{img("body")}<g class="look">{eyes}</g>'
       f'<g class="drumL">{img("handL")}</g><g class="drumR">{img("handR")}</g>'
       f'<g class="bubble">{img("bubble")}{dots}</g></svg>')
out = os.path.join(HERE, '..', 'hooks', 'waiting-art.ts')
open(out, 'w', encoding='utf8', newline='\n').write(
    '// Generated by art/build-waiting.py from art/claude-waiting.svg: do not edit by hand.\n\n'
    f'export const WAITING_SVG = `{svg}`\n\nexport const WAITING_WIDTH = {Wd}\nexport const WAITING_HEIGHT = {Hd}\n')
# a flat preview of the body layer, for checking the cut
prev = Image.new('RGBA', (X1 - X0, Y1 - Y0), (200, 230, 255, 255))
prev.alpha_composite(Image.fromarray(body, 'RGBA').crop((X0, Y0, X1, Y1)))
prev.save(os.environ.get('PREVIEW', os.devnull) if os.environ.get('PREVIEW') else io.BytesIO(), 'PNG')
print('wrote', out, len(svg), 'chars', {k: len(v['png']) for k, v in res.items()})
