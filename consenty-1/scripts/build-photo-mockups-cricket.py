"""Фото-mockup Cricket: принт на весь корпус (56 × 66 мм по кругу).
Фото используется как есть (логотипы и водяной знак не удаляются)."""
from PIL import Image, ImageFilter
import numpy as np, json
OUT = '/home/claude/printlab/public/mockups/photo/'
im = Image.open('cricket.jpg').convert('RGB')
a = np.asarray(im).astype(float)
W, H = im.size
x0, x1 = 385, 641
cx, half = (x0 + x1) / 2, (x1 - x0) / 2
body_top, body_bot = 186, 988
PRINT_W, PRINT_H = 56.0, 66.0                     # размеры принта от владельца
pxmm = (body_bot - body_top) / PRINT_H
A_MM = half / pxmm
# полутолщина подбирается так, чтобы обхват корпуса = ширине принта
def perim(a_, b_):
    return np.pi * (3 * (a_ + b_) - np.sqrt((3 * a_ + b_) * (a_ + 3 * b_)))
lo, hi = 1.0, A_MM
for _ in range(60):
    mid = (lo + hi) / 2
    lo, hi = (mid, hi) if perim(A_MM, mid) < PRINT_W else (lo, mid)
B_MM = (lo + hi) / 2

im.save(OUT + 'cricket-front.jpg', quality=92)
xs = np.arange(W)
u = np.clip((xs - cx) / half, -1, 1)
light = np.clip(0.6 + 0.36 * np.cos(np.arcsin(u)) ** 0.8 - 0.04 * u, 0, 1)
light = np.where((xs >= x0) & (xs <= x1), light, 1)
shade = np.ones((H, W)); shade[body_top:body_bot] = light
sh = Image.fromarray((shade * 255).astype('uint8'))
alpha = np.zeros((H, W)); alpha[body_top:body_bot, x0:x1 + 1] = 255
Image.merge('RGBA', (sh, sh, sh, Image.fromarray(alpha.astype('uint8')))).save(OUT + 'cricket-shade.png', optimize=True)
prof = np.median(a[600:950, :, :], axis=0); L = prof.mean(axis=1)
base = np.median(L[x0 + 40:x1 - 40])
hl = np.clip((L - base - 6) / 45, 0, 1) ** 1.2 * 0.6
hl = np.where((xs >= x0) & (xs <= x1), hl, 0)
gl = np.zeros((H, W)); gl[body_top:body_bot] = hl * 255
g8 = Image.fromarray(gl.astype('uint8')).filter(ImageFilter.GaussianBlur(1.5))
white = Image.new('L', (W, H), 255)
Image.merge('RGBA', (white, white, white, g8)).save(OUT + 'cricket-gloss.png', optimize=True)

# развёртка корпуса для редактора
t = np.linspace(-np.pi / 2, np.pi / 2, 2001)
sp = np.sqrt((A_MM * np.cos(t)) ** 2 + (B_MM * np.sin(t)) ** 2)
ss = np.concatenate([[0], np.cumsum((sp[1:] + sp[:-1]) / 2 * np.diff(t))]); ss -= ss[1000]; Q = ss[-1]
crop_top, crop_bot = 20, 1010
def unwrap(s_from, s_to):
    cols = max(2, round((s_to - s_from) * pxmm))
    xs_ = cx + A_MM * np.sin(np.interp(np.linspace(s_from, s_to, cols), ss, t)) * pxmm
    i0 = np.clip(np.floor(xs_).astype(int), 0, W - 2); f = (xs_ - i0)[None, :, None]
    part = a[crop_top:crop_bot]
    return part[:, i0] * (1 - f) + part[:, i0 + 1] * f
half_img = unwrap(-Q, Q)
Image.fromarray(np.clip(half_img, 0, 255).astype('uint8')).save(OUT + 'cricket-editor-front.jpg', quality=92)
full = np.concatenate([unwrap(0, Q), half_img, unwrap(-Q, 0)], axis=1)
Image.fromarray(np.clip(full, 0, 255).astype('uint8')).save(OUT + 'cricket-editor-wrap.jpg', quality=92)

geo = {"width": W, "height": H, "cx": cx, "pxPerMm": round(pxmm, 3), "stickerTop": body_top, "aMm": round(A_MM, 3), "bMm": round(B_MM, 3),
       "perimeterMm": round(4 * Q, 2), "printHMm": PRINT_H,
       "editor": {"heightMm": round((crop_bot - crop_top) / pxmm, 2), "trimTopMm": round((body_top - crop_top) / pxmm, 2)}}
json.dump(geo, open('cricket_geo.json', 'w')); print(geo)
