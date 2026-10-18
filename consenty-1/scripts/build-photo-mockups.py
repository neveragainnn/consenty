"""Готовит фото-mockup картхолдера из фотографии товара:
подложку, карту затенения (multiply) и бликов (screen) по области печати, фон редактора."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, json
import sys
src = Image.open(sys.argv[1] if len(sys.argv) > 1 else 'cardholder-source.png').convert('RGB')
OUT = '/home/claude/printlab/public/mockups/photo/'
import os; os.makedirs(OUT, exist_ok=True)
S = 900

def place(crop_box, rotate, scale, offset):
    im = src.crop(crop_box)
    if rotate: im = im.rotate(90, expand=True)  # против часовой: защёлка оказывается сверху
    im = im.resize((round(im.width*scale), round(im.height*scale)), Image.LANCZOS)
    canvas = Image.new('RGB', (S, S), (255, 255, 255))
    canvas.paste(im, offset)
    return canvas

def maps(base, quad, name):
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).polygon([tuple(p) for p in quad], fill=255)
    m = np.asarray(mask) > 0
    L = np.asarray(base.convert('L')).astype(float) / 255
    vals = L[m]
    q = np.percentile(vals, 92); med = np.median(vals)
    shade = np.clip(L / q, 0, 1)
    shade = 1 - (1 - shade) * 0.85                       # сохраняем градиент и шлифовку металла
    gloss = np.clip((L - med) / max(1e-3, 1 - med), 0, 1) ** 1.6 * 0.55
    sh = Image.fromarray((shade * 255).astype('uint8'))
    alpha = mask.filter(ImageFilter.GaussianBlur(1))
    shade_img = Image.merge('RGBA', (sh, sh, sh, alpha))
    gl = Image.fromarray((gloss * 255 * (m)).astype('uint8'))
    white = Image.new('L', (S, S), 255)
    gloss_img = Image.merge('RGBA', (white, white, white, gl))
    shade_img.save(OUT + f'{name}-shade.png', optimize=True)
    gloss_img.save(OUT + f'{name}-gloss.png', optimize=True)
    base.save(OUT + f'{name}.jpg', quality=92)

# --- закрытый: кроп, поворот, масштаб 1.2 ---
cb = (57, 250, 557, 965); sc = 1.2; off = (21, 150)
closed = place(cb, True, sc, off)
Wc = cb[2] - cb[0]
def rot_pt(x, y):  # точка исходника -> точка на итоговой подложке
    cx, cy = x - cb[0], y - cb[1]
    rx, ry = cy, Wc - cx
    return [round(off[0] + rx * sc, 1), round(off[1] + ry * sc, 1)]
# область печати на крышке (исходник): x 124..484, y 333..884; после поворота «верх» = правый край
plate_closed = [rot_pt(484, 333), rot_pt(484, 884), rot_pt(124, 884), rot_pt(124, 333)]
# ^ ВЛ=(правый-верх исходника), ВП=(правый-низ), НП=(левый-низ), НЛ=(левый-верх)
maps(closed, plate_closed, 'cardholder-closed')

# --- открытый: кроп, масштаб 1.4 ---
ob = (615, 380, 1214, 860); so = 1.4; oo = (30, 114)
opened = place(ob, False, so, oo)
tp = lambda x, y: [oo[0] + (x - ob[0]) * so, oo[1] + (y - ob[1]) * so]
# углы лицевой панели на итоговой подложке (выверены по увеличенному снимку)
# область печати — по рамке, которую отметил владелец (перенесена на подложку)
face = [[389.5, 474.7], [806.0, 334.0], [687.4, 572.6], [268.3, 727.5]]
def bil(q, u, v):
    top = [q[0][i] + (q[1][i] - q[0][i]) * u for i in (0, 1)]
    bot = [q[3][i] + (q[2][i] - q[3][i]) * u for i in (0, 1)]
    return [round(top[i] + (bot[i] - top[i]) * v, 1) for i in (0, 1)]
u0, u1, v0, v1 = 0.0, 1.0, 0.0, 1.0
plate_open = [bil(face, u0, v0), bil(face, u1, v0), bil(face, u1, v1), bil(face, u0, v1)]
maps(opened, plate_open, 'cardholder-open')

# --- фон редактора: корпус спереди, без поворота перспективы ---
rot = src.crop(cb).rotate(90, expand=True)
body = rot.crop((67, 65, 647, 450)).resize((580 * 2, 385 * 2), Image.LANCZOS)
body.save(OUT + 'cardholder-editor.jpg', quality=92)
pxmm = 551 / 90
geo = {"closed": plate_closed, "open": plate_open, "size": S,
       "editor": {"imageMm": [round(580 / pxmm, 2), round(385 / (360 / 59), 2)], "trimOffsetMm": [round(16 / pxmm, 2), round(8 / (360 / 59), 2)]}}
json.dump(geo, open('cardholder-photo-geo.json', 'w'), indent=1)
print(json.dumps(geo))
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(OUT + f) // 1024, 'KB')
