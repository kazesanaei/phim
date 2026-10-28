"""Cấu hình launcher cleanyourtv (github.com/Gathin23/cleanyourtv) cho Chromecast nhà bố mẹ, trước khi build.

    python3 -I tv-box/launcher/cau-hinh.py <thư mục cleanyourtv>

Sửa launcher/app/src/main/res/values/config.xml. Mỗi khoá phải có đúng một chỗ — repo gốc đổi định dạng thì
dừng với lỗi, không build ra một launcher cấu hình sai. Theo examples/google-chromecast-gtv-4k/debloat.txt
(đúng mẫu sabrina, đúng bản UTTC.250917.004 của box):
  - dock: Kho phim, VTVgo, TV360, SmartTube (bản beta hoặc bản thường — app nào chưa cài thì tự bỏ qua);
  - nút YouTube trên remote gửi 190 → mở Kho phim, nút Netflix gửi 191 → mở VTVgo (HomeKeyService lo);
  - không Live TV (dongle không có đầu vào), không hiệu ứng chuyển động (bố mẹ cần nhanh, không cần đẹp);
  - giấu Termux:Boot và Downloader khỏi lưới app (đồ nghề, bấm nhầm không có ích gì).
"""
import re
import sys
from pathlib import Path

goc = Path(sys.argv[1])
p = goc / 'launcher/app/src/main/res/values/config.xml'
s = p.read_text(encoding='utf-8')


def mang(ten, ds):
    global s
    mau = re.compile(r'(<string-array name="%s"[^>]*>)(.*?)(</string-array>)' % re.escape(ten), re.S)
    if len(mau.findall(s)) != 1:
        sys.exit('config.xml: không thấy đúng một string-array "%s"' % ten)
    s = mau.sub(lambda m: m.group(1) + ''.join('\n        <item>%s</item>' % x for x in ds) + '\n    ' + m.group(3), s)


def don(kieu, ten, gia_tri):
    global s
    mau = re.compile(r'(<%s name="%s"[^>]*>)([^<]*)(</%s>)' % (kieu, re.escape(ten), kieu))
    if len(mau.findall(s)) != 1:
        sys.exit('config.xml: không thấy đúng một %s "%s"' % (kieu, ten))
    s = mau.sub(lambda m: m.group(1) + gia_tri + m.group(3), s)


mang('dock_apps', ['vn.khophim.tv', 'vn.vtv.vtvgotv', 'com.viettel.tv360.tv',
                   'com.liskovsoft.smarttubetv.beta', 'com.liskovsoft.smarttubetv'])
mang('hidden_apps', ['com.termux.boot', 'com.esaba.downloader'])
mang('app_keys', ['190:vn.khophim.tv', '191:vn.vtv.vtvgotv'])
don('string', 'live_tv_package', '')
don('bool', 'animations', 'false')
p.write_text(s, encoding='utf-8')
print('Đã cấu hình', p)
