#!/data/data/com.termux/files/usr/bin/bash
# Thử mở thẳng một kênh VTVgo bằng deep link, hỏi người nhìn TV kiểu nào đúng. Không đổi gì trên box.
#   bash thu-kenh.sh <cổng adb>
# doc-lien-ket.sh (28/10/2026) thấy trong app: vtvgo://home, vtvgo://play, vtvgo://spotlight và các chuỗi
# channelId=, channelID, channel_id — chưa biết play nhận mã kênh bằng tên tham số nào, nên thử lần lượt.
# Mã kênh lấy từ trang web vtvgo.vn: /channel/<tên>-<loại>,<mã>.html (VTV1 = 1, Hà Nội 1 = 111).
set -uo pipefail
T=127.0.0.1:${1:?thiếu cổng adb}
A="adb -s $T"
GOI=vn.vtv.vtvgotv
adb connect "$T" >/dev/null 2>&1
[ "$($A get-state 2>/dev/null)" = device ] || { echo "Chưa nối adb $T. Xem cổng ở màn Gỡ lỗi không dây."; exit 1; }

echo "== Mã kênh trên vtvgo.vn (tên-loại,mã)"
curl -sL --max-time 20 -A 'Mozilla/5.0' 'https://vtvgo.vn/channel/vtv1-1,1.html' \
  | grep -o -E 'channel/[a-z0-9-]+-[0-9]+,[0-9]+\.html' | sed 's#channel/##; s#\.html##' | sort -u \
  | grep -i -E 'vtv1-|ha-noi|an-ninh|antv|cong-an' || echo "(không đọc được trang, sẽ thử với VTV1 = 1)"
echo

THU=(
  'vtvgo://play?channelId=1'
  'vtvgo://play?channel_id=1'
  'vtvgo://play?channelID=1'
  'vtvgo://play?id=1'
  'vtvgo://play/1'
  'vtvgo://play?type=1&id=1'
)
for u in "${THU[@]}"; do
  echo ">>> Thử: $u"
  $A shell am force-stop "$GOI"
  $A shell "am start -a android.intent.action.VIEW -d '$u' $GOI" >/dev/null
  sleep 10
  read -r -p "    TV đang PHÁT VTV1? (c = đúng VTV1 / k = không, hoặc chỉ mở trang chủ) " tl </dev/tty || tl=k
  if [ "$tl" = c ]; then
    echo
    echo "ĐÚNG: $u"
    $A shell input keyevent KEYCODE_HOME
    exit 0
  fi
done
$A shell input keyevent KEYCODE_HOME
echo
echo "Chưa kiểu nào mở thẳng được VTV1. Gửi ảnh màn hình TV của lần thử cuối để tôi xem app đang đứng ở đâu."
exit 1
