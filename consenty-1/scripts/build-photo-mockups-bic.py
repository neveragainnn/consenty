"""Фото-mockup BIC: подложки (спереди/сзади), тень цилиндра и блики с фото."""
from PIL import Image, ImageFilter
import numpy as np, json, os
OUT = '/home/claude/printlab/public/mockups/photo/'
im = Image.open('bic.png').convert('RGB')
a = np.asarray(im).astype(float)
W, H = im.size
x0, x1 = 455, 798                 # корпус по горизонтали
cx, half = (x0 + x1) / 2, (x1 - x0) / 2
A_MM, B_MM = 12.75, 7.25
pxmm = half / A_MM
# Область печати — весь корпус: от колпачка до низа (до скругления дна), по всему обхвату
body_top, body_bot = 208, 1204
STICK_H = round((body_bot - body_top) / pxmm, 1)
sticker_top = body_top
sticker_bot = body_bot

# 1) Убираем логотип: заполняем зону профилем корпуса по столбцам
prof = np.median(a[400:1100, :, :], axis=0)            # (W, 3)
clean = a.copy()
ly0, ly1, lx0, lx1 = 245, 340, 540, 760
noise = np.random.default_rng(1).normal(0, 1.2, (ly1 - ly0, lx1 - lx0, 1))
clean[ly0:ly1, lx0:lx1] = prof[None, lx0:lx1] + noise
# мягкий переход по краям заплатки
m = np.zeros((H, W)); m[ly0:ly1, lx0:lx1] = 1
mb = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(4))).astype(float)[..., None] / 255
out = a * (1 - mb) + clean * mb
front = Image.fromarray(np.clip(out, 0, 255).astype('uint8'))
front.save(OUT + 'bic-front.jpg', quality=92)
front.transpose(Image.FLIP_LEFT_RIGHT).save(OUT + 'bic-back.jpg', quality=92)

# 2) Тень цилиндра (multiply): освещённость по нормали поверхности
xs = np.arange(W)
u = np.clip((xs - cx) / half, -1, 1)
t = np.arcsin(u)
light = np.clip(0.6 + 0.36 * np.cos(t) ** 0.8 - 0.04 * u, 0, 1)  # свет чуть слева
light = np.where((xs >= x0) & (xs <= x1), light, 1)
shade = np.ones((H, W)); shade[sticker_top:sticker_bot] = light
sh = Image.fromarray((shade * 255).astype('uint8'))
alpha = np.zeros((H, W)); alpha[sticker_top:sticker_bot, x0:x1 + 1] = 255
al = Image.fromarray(alpha.astype('uint8'))
Image.merge('RGBA', (sh, sh, sh, al)).save(OUT + 'bic-shade.png', optimize=True)

# 3) Блики: яркие полосы на чёрном пластике из фото (по столбцам)
L = prof.mean(axis=1)
base = np.median(L[x0 + 40:x1 - 40])
hl = np.clip((L - base - 6) / 45, 0, 1) ** 1.2 * 0.6
hl = np.where((xs >= x0) & (xs <= x1), hl, 0)
gl = np.zeros((H, W)); gl[sticker_top:sticker_bot] = hl * 255
g8 = Image.fromarray(gl.astype('uint8')).filter(ImageFilter.GaussianBlur(1.5))
white = Image.new('L', (W, H), 255)
Image.merge('RGBA', (white, white, white, g8)).save(OUT + 'bic-gloss.png', optimize=True)
# блики сзади зеркальны
Image.open(OUT + 'bic-gloss.png').transpose(Image.FLIP_LEFT_RIGHT).save(OUT + 'bic-gloss-back.png', optimize=True)
Image.open(OUT + 'bic-shade.png').transpose(Image.FLIP_LEFT_RIGHT).save(OUT + 'bic-shade-back.png', optimize=True)

# 4) Фон редактора: «развёртка» корпуса с фото — каждый столбик фото на своё место дуги
def ellipse_arc(a, b, n=2000):
    t = np.linspace(-np.pi / 2, np.pi / 2, n + 1)
    sp = np.sqrt((a * np.cos(t)) ** 2 + (b * np.sin(t)) ** 2)
    s_ = np.concatenate([[0], np.cumsum((sp[1:] + sp[:-1]) / 2 * np.diff(t))])
    return t, s_ - s_[n // 2], s_[-1] - s_[n // 2]
T, SS, Q = ellipse_arc(A_MM, B_MM)
PERIM = 4 * Q
crop_top, crop_bot = 20, 1240
def unwrap(img, s_from, s_to):
    arr = np.asarray(img).astype(float)
    cols = max(2, round((s_to - s_from) * pxmm))
    s_vals = np.linspace(s_from, s_to, cols)
    xs_ = cx + A_MM * np.sin(np.interp(s_vals, SS, T)) * pxmm
    x0i = np.clip(np.floor(xs_).astype(int), 0, W - 2); f = (xs_ - x0i)[None, :, None]
    part = arr[crop_top:crop_bot]
    out_ = part[:, x0i] * (1 - f) + part[:, x0i + 1] * f
    return out_
back_img = front.transpose(Image.FLIP_LEFT_RIGHT)
half = unwrap(front, -Q, Q)
Image.fromarray(np.clip(half, 0, 255).astype('uint8')).save(OUT + 'bic-editor-front.jpg', quality=92)
Image.fromarray(np.clip(unwrap(back_img, -Q, Q), 0, 255).astype('uint8')).save(OUT + 'bic-editor-back.jpg', quality=92)
full = np.concatenate([unwrap(back_img, 0, Q), half, unwrap(back_img, -Q, 0)], axis=1)
Image.fromarray(np.clip(full, 0, 255).astype('uint8')).save(OUT + 'bic-editor-wrap.jpg', quality=92)

geo = {"width": W, "height": H, "cx": round(cx, 1), "pxPerMm": round(pxmm, 3), "stickerTop": sticker_top, "aMm": A_MM, "bMm": B_MM,
       "perimeterMm": round(PERIM, 2), "printHMm": STICK_H,
       "editor": {"heightMm": round((crop_bot - crop_top) / pxmm, 2), "trimTopMm": round((body_top - crop_top) / pxmm, 2)}}
json.dump(geo, open('bic_geo.json', 'w'))
print(geo, sticker_bot)
