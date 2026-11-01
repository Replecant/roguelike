# Нарезка портретов из листов-миниатюр: python3 tools/portraits.py <папка с листами>
# Рамки кругов размечены в JOBS; на выходе portraits/<имя>.webp 320×320 с золотым кольцом.
# Единая обработка портретов: внутренняя часть без родного ободка, одинаковое
# золотое кольцо, выравнивание цвета между партиями.
from PIL import Image, ImageDraw, ImageEnhance
import sys, os
IMG = (sys.argv[1] if len(sys.argv) > 1 else 'portraits/src') + '/'   # папка с листами 18–22.webp
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'portraits') + '/'
S = 320
# (файл, словарь имя -> (x0, y0, x1, y1) рамки круга/овала; None — весь кадр), партия
JOBS = [   # серия XIII века: (лист, {имя: рамка круга (x0, y0, x1, y1)}, партия)
    ('18.webp', {'peasant_m1': (32, 22, 512, 502), 'peasant_m2': (526, 24, 1006, 504), 'pilgrim': (1024, 22, 1504, 502),
                 'elder_village': (256, 482, 750, 976), 'peasant_m3': (806, 482, 1300, 976)}, 4),
    ('19.webp', {'peasant_f1': (8, 0, 664, 656), 'peasant_f2': (680, 0, 1320, 640), 'peasant_f3': (1336, 0, 1992, 656)}, 4),
    ('20.webp', {'town_f1': (28, 18, 520, 492), 'town_m1': (522, 18, 1012, 492), 'town_f2': (1018, 18, 1510, 492),
                 'merchant': (28, 494, 508, 988), 'town_m2': (516, 494, 1006, 988), 'town_f3': (1014, 494, 1506, 988)}, 4),
    ('21.webp', {'consul': (238, 20, 592, 352), 'podesta': (594, 20, 942, 352), 'castellan': (946, 20, 1302, 352),
                 'priest': (6, 318, 382, 666), 'chaplain': (396, 318, 766, 666), 'monk': (770, 318, 1144, 666),
                 'abbot': (1150, 318, 1522, 666), 'smith': (192, 630, 570, 992), 'guard': (966, 630, 1346, 992)}, 4),
    ('22.webp', {'boatman': (16, 16, 1236, 1236)}, 4),
    ('24.webp', {'manfred': (12, 130, 360, 490), 'noble_m1': (370, 130, 716, 490), 'noble_m2': (728, 130, 1076, 490),
                 'noble_m3': (1086, 130, 1436, 490), 'noble_f1': (14, 576, 360, 948), 'noble_f2': (370, 576, 716, 948),
                 'noble_f3': (728, 576, 1076, 948), 'noble_f4': (1086, 576, 1434, 948)}, 4),
    ('25.webp', {'pagan_m1': (154, 6, 476, 324), 'pagan_f1': (570, 6, 898, 324), 'pagan_m2': (976, 6, 1296, 324),
                 'pagan_f2': (142, 334, 468, 656), 'pagan_m3': (562, 334, 890, 656), 'pagan_f3': (978, 334, 1306, 656),
                 'pagan_m4': (132, 664, 468, 1000), 'flamen': (548, 664, 902, 1000), 'pagan_f4': (978, 664, 1314, 1000)}, 4),
    ('23.webp', {'imam': (250, 18, 762, 502), 'innkeeper': (776, 18, 1288, 502), 'hermit': (22, 462, 522, 962),
                 'town_m3': (526, 462, 1012, 962), 'town_m4': (1016, 462, 1512, 962)}, 4),
    # Крестьяне: юноша со снопом, старик с мотыгой, в соломенной шляпе с хворостом; с яблоками, старуха с кувшином, со снопом.
    ('26.webp', {'peasant_m4': (16, 28, 480, 512), 'peasant_m5': (484, 28, 952, 508), 'peasant_m6': (956, 28, 1428, 512),
                 'peasant_f4': (12, 536, 472, 1040), 'peasant_f5': (476, 532, 948, 1040), 'peasant_f6': (952, 536, 1428, 1044)}, 4),
    # Горожане: с кошелём, со свитком, суконщик в фартуке, седой с книгой; с корзиной, хозяйка с ключами, с сукном, с книгой и кувшином.
    ('27.webp', {'town_m5': (8, 113, 356, 490), 'town_m6': (364, 113, 716, 490), 'town_m7': (722, 113, 1076, 490),
                 'town_m8': (1082, 113, 1440, 490), 'town_f4': (8, 580, 358, 1002), 'town_f5': (364, 580, 716, 1002),
                 'town_f6': (722, 580, 1076, 1002), 'town_f7': (1082, 580, 1440, 1002)}, 4),
]
# ONLY=26.webp,27.webp — нарезать лишь эти листы (остальные исходники могут лежать в другом месте).
ONLY = [x for x in os.environ.get('ONLY', '').split(',') if x]
if ONLY: JOBS = [j for j in JOBS if j[0] in ONLY]

def inner(src, box, batch):
    W, H = src.size
    if box is None: box = (0, 0, W, H)
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx = (x0 + x1) / 2
    if batch == 3:                      # вертикальный овал: круг по ширине, ближе к лицу
        d = w * 0.86; cy = y0 + h * 0.45
        return src.crop((int(cx - d / 2), int(cy - d / 2), int(cx + d / 2), int(cy + d / 2))).resize((S, S), Image.LANCZOS)
    if batch == 1:                      # поясные: взять крупнее, ближе к лицу, как у остальных
        d = w * 0.74; cx = x0 + w * 0.55; cy = y0 + h * 0.42
        return src.crop((int(cx - d / 2), int(cy - d / 2), int(cx + d / 2), int(cy + d / 2))).resize((S, S), Image.LANCZOS)
    k = 0.93 if batch == 4 else 0.90    # срезать родной ободок; овал (сплющенный лист) — в круг
    cy = (y0 + y1) / 2
    return src.crop((int(cx - w * k / 2), int(cy - h * k / 2), int(cx + w * k / 2), int(cy + h * k / 2))).resize((S, S), Image.LANCZOS)

def grade(im, batch):
    if batch == 1:                      # первые — ярче и чище: чуть приглушить и согреть
        im = ImageEnhance.Color(im).enhance(0.86)
        im = ImageEnhance.Brightness(im).enhance(0.96)
        warm = Image.new('RGB', im.size, (196, 160, 110))
        im = Image.blend(im, warm, 0.07)
    elif batch == 4:                    # серия XIII века — как есть
        pass
    else:                               # поздние — тусклее: чуть оживить
        im = ImageEnhance.Color(im).enhance(1.06)
        im = ImageEnhance.Brightness(im).enhance(1.04)
        im = ImageEnhance.Contrast(im).enhance(1.03)
    return im

def ring(im):
    big = S * 4
    m = Image.new('L', (big, big), 0); ImageDraw.Draw(m).ellipse((6, 6, big - 6, big - 6), fill=255)
    im = im.convert('RGBA'); im.putalpha(m.resize((S, S), Image.LANCZOS))
    r = Image.new('RGBA', (big, big), (0, 0, 0, 0)); d = ImageDraw.Draw(r)
    d.ellipse((8, 8, big - 8, big - 8), outline=(110, 70, 30, 255), width=40)
    d.ellipse((14, 14, big - 14, big - 14), outline=(214, 166, 74, 255), width=26)
    d.ellipse((40, 40, big - 40, big - 40), outline=(120, 40, 30, 255), width=6)
    im.alpha_composite(r.resize((S, S), Image.LANCZOS))
    return im

names = []
for f, items, batch in JOBS:
    src = Image.open(IMG + f).convert('RGB')
    for n, box in items.items():
        im = ring(grade(inner(src, box, batch), batch))
        im.save(OUT + n + '.webp', 'WEBP', quality=84, method=6)
        names.append(n)
print(len(names))
