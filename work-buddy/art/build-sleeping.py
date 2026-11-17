# Builds hooks/sleeping-art.ts: the resting character from art/claude-sleeping.svg,
# cut into layers (body, hair, hand, three Z's, laptop glow) so each part animates
# on its own: the Z's drift up and fade one after another, the hair sways and
# breathes slowly, the laptop's asterisk glows like a standby light and the
# fingers twitch now and then. The "Sleeping" pill under the art is dropped.
# Run: python -I art/build-sleeping.py   (needs pillow, numpy, scipy)
import io, base64, os, re
from PIL import Image
import numpy as np
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
svg_text = open(os.path.join(HERE, 'claude-sleeping.svg'), encoding='utf8').read()
png = base64.b64decode(re.sub(r'\s', '', re.search(r'base64,([A-Za-z0-9+/=\s]+)', svg_text).group(1)))
a0 = np.array(Image.open(io.BytesIO(png)).convert('RGBA'))
a = a0.astype(int); R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
lum = 0.3 * R + 0.59 * G + 0.11 * B
present = A > 24
skin = present & (R > 225) & (G > 195) & (B > 170)
orange = present & (R > 190) & (G > 80) & (G < 185) & (B < 130) & (R - B > 90)
blue = (A > 100) & (B > 150) & (B - R > 40)
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
head_skin = slab == slab[510, 250]
hand_skin = slab == slab[610, 248]
assert all(0 < m.sum() < 30000 for m in (head_skin, hand_skin)), 'a seed missed its region'

olab, no = nd.label(orange)
hair_o = np.zeros_like(present); aster_o = None
for i in range(1, no + 1):
    m = olab == i
    if m.sum() < 500: continue
    cx, cy = centroid(m)
    if cy < 560: hair_o |= m
    elif cy < 690: aster_o = m

# the Z's: blue letters above the pill, smallest (nearest the head) first
blab, nb = nd.label(blue & (yy < 712))
z_cores = [blab == i for i in range(1, nb + 1) if (blab == i).sum() > 300]
z_cores.sort(key=lambda m: m.sum())

# the laptop: grey lid and base plus their outline; no other layer takes its pixels
grey = (A > 200) & (lum >= 45) & (lum < 110) & (abs(R - G) < 25) & (abs(G - B) < 25)
glab, _ = nd.label(grey)
lid = glab == glab[640, 410]
assert 5000 < lid.sum() < 40000, 'the laptop seed missed the lid'
laptop = grow(lid, 11) & present & (lum < 180)

head = nd.binary_fill_holes(grow(head_skin, 2) | (grow(head_skin, 13) & black & (yy > 505)))
hand = outlined(hand_skin, 12) & ~laptop & ~head
hair = outlined(hair_o, 12) & ~head
zs = [outlined(z, 11) for z in z_cores]
print('zs', len(zs), 'hair', int(hair.sum()), 'hand', int(hand.sum()), 'lid', int(lid.sum()))

# body: everything else, with the moving parts' places filled in
body = a0.copy()
specks = grow(hand, 4) & ~hand & ~head & ~laptop & present & (lum > 90) & (yy > 585)
fill(body, hand | specks, present & (lum < 110) & (A > 200))
body[hair] = 0
body[grow(hair_o, 24) & ~head & (yy < 515)] = 0
for z in z_cores: body[grow(z, 16)] = 0
robe_zone = hair & (yy > 520)
dist = nd.distance_transform_edt(robe_zone)
fill(body, robe_zone)
body[robe_zone & (dist > 5)] = 0
body[laptop] = a0[laptop]

def layer(mask):
    out = np.zeros_like(a0); out[mask] = a0[mask]; return out
L = {'body': body, 'hair': layer(hair), 'hand': layer(hand)}
for i, z in enumerate(zs): L[f'z{i}'] = layer(z)
glow = layer(grow(aster_o, 2)).astype(float)
gm = glow[..., 3] > 0; glow[gm, :3] = glow[gm, :3] * 0.25 + np.array([255, 226, 150]) * 0.75
L['glow'] = glow.astype(np.uint8)

# crop: the character and Z's only (the pill below is dropped)
ys, xs = np.nonzero(present & (yy < 712)); pad = 8
X0, Y0, X1, Y1 = xs.min() - pad, ys.min() - pad - 40, xs.max() + pad, ys.max() + pad  # room above for the Z's to rise into
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
hx, hy = pt(248, 570)
zc = [pt(*centroid(z)) for z in z_cores]

def img(name, cls='', style=''):
    l = res[name]
    c = f' class="{cls}"' if cls else ''
    st = f' style="{style}"' if style else ''
    return f'<image{c}{st} x="{l["x"]}" y="{l["y"]}" width="{l["w"]}" height="{l["h"]}" href="data:image/png;base64,{l["png"]}"/>'

# The app restarts this picture about once a second (it redraws it each time
# another mod's pane ticks, with the source this module gave last), so whatever
# moves must look the same one second later, or each restart shows as a jump.
#
# The Z's do: the big Z, four times over, one starting every second. Each starts
# small where the smallest z is drawn and glides up in one straight line past the
# big Z's place, growing as it goes, then fades out; it sways on a 4s period of
# its own. One second on, every Z stands where the next one stood, so a restart
# cannot be seen and the stream never visibly loops. Everything else stays still:
# a slower breath, glow or twitch would jump back at every restart.
(sx0, sy0), (bx, by) = zc[0], zc[-1]
STEP = 1.0           # seconds between Z's: the restart interval it must match
Z_COUNT = 4          # Z's alive at once
Z_CYCLE = STEP * Z_COUNT
dx0, dy0 = sx0 - bx - 2, sy0 - by + 4
css = f"""
.z{{opacity:0;transform-origin:{bx}px {by}px;animation:rise {Z_CYCLE}s linear infinite}}
@keyframes rise{{0%{{opacity:0;transform:translate({dx0:.1f}px,{dy0:.1f}px) scale(.35)}}14%{{opacity:1}}72%{{opacity:1}}100%{{opacity:0;transform:translate(6px,-18px) scale(1.1)}}}}
.zs{{transform-origin:{bx}px {by}px;animation:zsway {Z_CYCLE / 2}s ease-in-out infinite alternate}}
@keyframes zsway{{0%{{transform:translateX(-2.5px) rotate(-6deg)}}100%{{transform:translateX(2.5px) rotate(6deg)}}}}
.zstill{{display:none}}
@media (prefers-reduced-motion:reduce){{.z,.zs{{animation:none}}.z{{opacity:0}}.zstill{{display:inline}}}}
"""
css = re.sub(r'\s*\n\s*', '', css)
# Every animation runs from --t, the clock time the module stamps into the source
# when it draws (vector.ts), so the module's own redraws carry on where they were.
css = 'svg{--t:0ms}' + re.sub(r'(animation:[^;}]+)', r'\1;animation-delay:calc(var(--d,0s) - var(--t,0ms))', css)
zz = ''.join(f'<g class="z" style="--d:{i * STEP:.2f}s">' + img(f'z{len(zc) - 1}', 'zs') + '</g>' for i in range(Z_COUNT))
zz += ''.join(img(f'z{i}', 'zstill') for i in range(len(zc)))  # shown still under reduced motion
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wd} {Hd}" width="{Wd}" height="{Hd}"><style>{css}</style>'
       f'{img("hair")}{img("body")}{img("hand")}{zz}</svg>')
out = os.path.join(HERE, '..', 'hooks', 'sleeping-art.ts')
open(out, 'w', encoding='utf8', newline='\n').write(
    '// Generated by art/build-sleeping.py from art/claude-sleeping.svg: do not edit by hand.\n\n'
    f'export const SLEEPING_SVG = `{svg}`\n\nexport const SLEEPING_WIDTH = {Wd}\nexport const SLEEPING_HEIGHT = {Hd}\n')
if os.environ.get('PREVIEW'):
    prev = Image.new('RGBA', (X1 - X0, Y1 - Y0), (200, 230, 255, 255))
    prev.alpha_composite(Image.fromarray(body, 'RGBA').crop((X0, Y0, X1, Y1)))
    prev.save(os.environ['PREVIEW'])
print('wrote', out, len(svg), 'chars', {k: len(v['png']) for k, v in res.items()})
