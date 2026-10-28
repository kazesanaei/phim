#!/data/data/com.termux/files/usr/bin/bash
# Đo độ mượt app Kho phim trên box (CHỈ ĐO: hiệu ứng chỉ tắt tạm trong lúc đo, xong trả về như cũ).
#   bash do-muot.sh <cổng adb>
# Cần: app Kho phim đang mở trên TV, ở trang chủ. Node đã có sẵn (máy chủ phim dùng).
set -uo pipefail
NGUON=${NGUON:-https://raw.githubusercontent.com/kazesanaei/phim/claude/tv-box-chromecast/tv-box}
T=127.0.0.1:${1:?thiếu cổng adb}
A="adb -s $T"
adb connect "$T" >/dev/null 2>&1
[ "$($A get-state 2>/dev/null)" = device ] || { echo "Chưa nối adb $T. Xem cổng ở màn Gỡ lỗi không dây."; exit 1; }

pid=$($A shell pidof vn.khophim.tv | tr -d '\r')
if [ -z "$pid" ]; then
  echo "App Kho phim chưa mở — mở giúp, đợi trang chủ lên..."
  $A shell am start -n vn.khophim.tv/.MainActivity >/dev/null
  sleep 12
  pid=$($A shell pidof vn.khophim.tv | tr -d '\r')
fi
[ -n "$pid" ] || { echo "Không mở được app Kho phim"; exit 1; }

curl -fsSL -o "$HOME/do-muot.mjs" "$NGUON/do-muot.mjs?v=$(date +%s)"
$A forward tcp:9222 "localabstract:webview_devtools_remote_$pid" >/dev/null
node "$HOME/do-muot.mjs" 9222
$A forward --remove tcp:9222 >/dev/null 2>&1

echo
echo "Máy chủ phim trả trang chủ: $(curl -s -o /dev/null -w '%{time_total}' http://127.0.0.1:3000/) giây"
echo "CPU lúc này (8 tiến trình nặng nhất):"
$A shell top -b -n 1 -m 8 -o PID,%CPU,RES,NAME 2>/dev/null | tr -d '\r' | tail -n 9
