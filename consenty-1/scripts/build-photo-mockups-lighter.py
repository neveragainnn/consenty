"""Фото-mockup металлической зажигалки (закрыта / открыта) по фото товара.
Фото узкой модели растягивается по ширине до пропорций принта 32 × 51 мм."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, json
OUT = '/home/claude/printlab/public/mockups/photo/'
S = 1000
PRINT_W, PRINT_H = 32, 51
closed = Image.open('zc.jpg').convert('RGB')
opened = Image.open('zo.jpg').convert('RGB')

# --- закрытая: лицевая плоскость в исходнике ---
fx0, fx1, fy0, fy1 = 48, 506, 36, 918
seam_end, body_start = 296, 318                      # линия разъёма крышки
f = (PRINT_W / PRINT_H) / ((fx1 - fx0) / (fy1 - fy0))  # растяжение по ширине
cl = closed.resize((round(closed.width * f), closed.height), Image.LANCZOS)
sc = 900 / cl.height
cl = cl.resize((round(cl.width * sc), round(cl.height * sc)), Image.LANCZOS)
ox, oy = (S - cl.width) // 2, 50
base_c = Image.new('RGB', (S, S), (255, 255, 255)); base_c.paste(cl, (ox, oy))
P = lambda x, y: [round(ox + x * f * sc, 1), round(oy + y * sc, 1)]
quad_c = [P(fx0, fy0), P(fx1, fy0), P(fx1, fy1), P(fx0, fy1)]
lid_v = (seam_end - fy0) / (fy1 - fy0); body_v = (body_start - fy0) / (fy1 - fy0)

# --- открытая: крышка не растягивается (она повёрнута), корпус — растягивается ---
split = 238
lid = opened.crop((0, 0, split, opened.height))
rest = opened.crop((split, 0, opened.width, opened.height))
rest = rest.resize((round(rest.width * f), rest.height), Image.LANCZOS)
op = Image.new('RGB', (lid.width + rest.width, opened.height), (255, 255, 255)); op.paste(lid, (0, 0)); op.paste(rest, (lid.width, 0))
so = 900 / op.height
op = op.resize((round(op.width * so), round(op.height * so)), Image.LANCZOS)
oox, ooy = (S - op.width) // 2, 50
base_o = Image.new('RGB', (S, S), (255, 255, 255)); base_o.paste(op, (oox, ooy))
def PO(x, y):
    xs = x if x < split else split + (x - split) * f
    return [round(oox + xs * so, 1), round(ooy + y * so, 1)]
# крышка (открыта, повернута на 90°): внутренняя плоскость; корпус — его лицевая сторона
lx0, lx1, ly0, ly1 = 30, 225, 30, 385
bx0, bx1, by0, by1 = 262, 620, 422, 897
lidQ = [PO(lx0, ly1), PO(lx0, ly0), PO(lx1, ly0), PO(lx1, ly1)]   # ВЛ полосы → НЛ крышки и т. д.
bodyQ = [PO(bx0, by0), PO(bx1, by0), PO(bx1, by1), PO(bx0, by1)]
parts = [{"quad": lidQ, "src": [0, 0, 1, round(lid_v, 4)]}, {"quad": bodyQ, "src": [0, round(body_v, 4), 1, 1]}]

def maps(base, polys, name, sheen=0.14):
    mask = Image.new('L', (S, S), 0); d = ImageDraw.Draw(mask)
    for q in polys: d.polygon([tuple(p) for p in q], fill=255)
    m = np.asarray(mask) > 0
    L = np.asarray(base.convert('L')).astype(float) / 255
    vals = L[m]; q = np.percentile(vals, 80); med = np.median(vals)
    shade = np.clip(L / q, 0, 1); shade = 1 - (1 - shade) * 0.9
    sh = Image.fromarray((shade * 255).astype('uint8'))
    Image.merge('RGBA', (sh, sh, sh, mask)).save(OUT + f'{name}-shade.png', optimize=True)
    # блики: яркие кромки с фото + мягкий диагональный отблеск полировки
    hl = np.clip((L - med - 0.08) / (1 - med), 0, 1) ** 1.2 * 0.8
    yy, xx = np.mgrid[0:S, 0:S] / S
    band = np.exp(-((xx * 0.8 + yy - 0.55) / 0.12) ** 2) * sheen
    g = np.clip(hl + band, 0, 1) * m
    gl = Image.fromarray((g * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
    w = Image.new('L', (S, S), 255)
    Image.merge('RGBA', (w, w, w, gl)).save(OUT + f'{name}-gloss.png', optimize=True)
    base.save(OUT + f'{name}.jpg', quality=92)

# --- граница принта, отмеченная владельцем (перенесена на подложку) ---
face_c = quad_c
quad_c = [[255.5, 104.0], [765.0, 104.0], [765.0, 911.2], [255.5, 911.2]]
fx_l, fx_r = face_c[0][0], face_c[1][0]; fy_t, fy_b = face_c[0][1], face_c[2][1]
seam_y = oy + seam_end * sc; body_y = oy + body_start * sc
mu0 = (quad_c[0][0] - fx_l) / (fx_r - fx_l); mu1 = (quad_c[1][0] - fx_l) / (fx_r - fx_l)
lid_v = (seam_y - quad_c[0][1]) / (quad_c[2][1] - quad_c[0][1])
body_v = (body_y - quad_c[0][1]) / (quad_c[2][1] - quad_c[0][1])
lid_top = (quad_c[0][1] - fy_t) / (seam_y - fy_t)          # отступ сверху — доля высоты крышки
body_bot = (quad_c[2][1] - body_y) / (fy_b - body_y)       # низ — доля высоты корпуса
def bil(q, u, v):
    top = [q[0][i] + (q[1][i] - q[0][i]) * u for i in (0, 1)]
    bot = [q[3][i] + (q[2][i] - q[3][i]) * u for i in (0, 1)]
    return [round(top[i] + (bot[i] - top[i]) * v, 1) for i in (0, 1)]
sub = lambda q, u0, u1, v0, v1: [bil(q, u0, v0), bil(q, u1, v0), bil(q, u1, v1), bil(q, u0, v1)]
lidQ = sub(lidQ, mu0, mu1, lid_top, 1)
bodyQ = sub(bodyQ, mu0, mu1, 0, body_bot)
parts = [{"quad": lidQ, "src": [0, 0, 1, round(lid_v, 4)]}, {"quad": bodyQ, "src": [0, round(body_v, 4), 1, 1]}]
maps(base_c, [quad_c], 'lighter-closed')
maps(base_o, [lidQ, bodyQ], 'lighter-open')

# --- фон редактора: закрытая зажигалка спереди (растянутая), весь корпус ---
ex0, ex1, ey0, ey1 = 25, 528, 4, 942
ed = closed.crop((ex0, ey0, ex1, ey1)); ed = ed.resize((round(ed.width * f), ed.height), Image.LANCZOS)
ed = ed.resize((ed.width * 2, ed.height * 2), Image.LANCZOS)
ed.save(OUT + 'lighter-editor.jpg', quality=92)
pxmm = (quad_c[1][0] - quad_c[0][0]) / PRINT_W               # px подложки на мм
eL, eT = ox + ex0 * f * sc, oy + ey0 * sc
geo = {"size": S, "closed": quad_c, "open": {"parts": parts, "quad": bodyQ},
       "editor": {"imageMm": [round((ex1 - ex0) * f * sc / pxmm, 2), round((ey1 - ey0) * sc / pxmm, 2)],
                  "trimOffsetMm": [round((quad_c[0][0] - eL) / pxmm, 2), round((quad_c[0][1] - eT) / pxmm, 2)]},
       "stretch": round(f, 4)}
json.dump(geo, open('lighter_geo.json', 'w'), indent=1); print(json.dumps(geo))
