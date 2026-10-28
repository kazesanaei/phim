# Vẽ banner (320x180, TV) và icon (192x192) cho từng nút kênh: chữ tên kênh to trên nền màu, không dùng logo đài.
#   python3 ve-banner.py   → app/src/<kênh>/res/drawable-xhdpi/banner.png, mipmap-xxxhdpi/ic_launcher.png
from PIL import Image, ImageDraw, ImageFont
import os

PHONG = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
KENH = {  # thư mục flavor: (chữ trên banner, màu nền)
    'vtv1': ('VTV1', (176, 28, 36)),
    'hanoi1': ('HÀ NỘI 1', (20, 82, 160)),
    'antv': ('ANTV', (28, 110, 60)),
}

def ve(chu, nen, w, h, co_toi_da):
    anh = Image.new('RGB', (w, h), nen)
    d = ImageDraw.Draw(anh)
    co = co_toi_da
    while True:
        f = ImageFont.truetype(PHONG, co)
        x0, y0, x1, y1 = d.textbbox((0, 0), chu, font=f)
        if x1 - x0 <= w * 0.86 or co <= 20:
            break
        co -= 2
    d.text(((w - (x1 - x0)) / 2 - x0, (h - (y1 - y0)) / 2 - y0), chu, font=f, fill='white')
    return anh

goc = os.path.dirname(os.path.abspath(__file__))
for k, (chu, nen) in KENH.items():
    for thu_muc, ten, w, h, co in [('drawable-xhdpi', 'banner.png', 320, 180, 84),
                                   ('mipmap-xxxhdpi', 'ic_launcher.png', 192, 192, 64)]:
        ra = os.path.join(goc, 'app', 'src', k, 'res', thu_muc)
        os.makedirs(ra, exist_ok=True)
        ve(chu, nen, w, h, co).save(os.path.join(ra, ten), optimize=True)
print('xong')
