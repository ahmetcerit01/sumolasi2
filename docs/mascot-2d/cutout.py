"""Krem zeminli 5'li Damla görselini şeffaf, kare PNG'lere böler.
Kullanım: python -I docs/mascot-2d/cutout.py docs/mascot-2d/damla_moods_sheet.webp assets/mascot   (Pillow gerekir)
Zemin: kenarlardan başlayan, düşük doygunluklu ve açık renkli bölge (gölgeler dahil) silinir.
Karakterin içindeki parlamalar kenara bağlı olmadığı için korunur.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()

def bg_like(p, y):
    r, g, b = p
    sat = max(p) - min(p)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    # zemin sıcak krem (R > B); üst bölgede nötr beyazlar (ör. şapka kenarı) karaktere aittir.
    # alttaki ayak gölgeleri nötr gri olduğu için orada bu kural uygulanmaz.
    warm = (r - b) >= 6 or y > 450
    return sat < 30 and lum > 150 and warm

mask = bytearray(W * H)  # 1 = zemin
q = deque()
for x in range(W):
    for y in (0, H - 1):
        q.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        q.append((x, y))
while q:
    x, y = q.popleft()
    i = y * W + x
    if mask[i] or not bg_like(px[x, y], y):
        continue
    mask[i] = 1
    if x > 0: q.append((x - 1, y))
    if x < W - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < H - 1: q.append((x, y + 1))

alpha = Image.new('L', (W, H))
alpha.putdata([0 if m else 255 for m in mask])
# kenarı 1 px içeri çekip yumuşat: krem hale kalmasın
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
rgba = im.convert('RGBA')
rgba.putalpha(alpha)

# ruh halleri soldan sağa; kesim çizgileri karakterler arasındaki boşluklar
cuts = [0, 425, 775, 1168, 1605, W]
names = ['thirsty', 'normal', 'happy', 'celebrate', 'sleepy']
for name, x0, x1 in zip(names, cuts[:-1], cuts[1:]):
    part = rgba.crop((x0, 0, x1, H))
    bbox = part.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
    part = part.crop(bbox)
    side = int(max(part.size) * 1.06)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    # ayaklar alta yakın, yatayda ortalı
    canvas.paste(part, ((side - part.size[0]) // 2, side - part.size[1] - int(side * 0.03)), part)
    canvas = canvas.resize((512, 512), Image.LANCZOS)
    canvas.save(f'{out}/damla_{name}.png', optimize=True)
    print(name, bbox, part.size)
