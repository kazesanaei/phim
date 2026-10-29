#!/data/data/com.termux/files/usr/bin/bash
# Theo dõi phím remote trong app Kho phim ĐANG MỞ trên box: mỗi phím bấm in một dòng (trang có nhận không, ô trỏ đi
# đâu). Không mở lại app, không bấm hộ, không sửa gì. Mở sẵn đúng trang có lỗi trên TV rồi chạy:
#   bash theo-doi-remote.sh [cổng adb] [số giây, mặc định 60]
set -uo pipefail
NGUON=${NGUON:-https://raw.githubusercontent.com/kazesanaei/phim/claude/tv-box-chromecast/tv-box}
# Nối adb vào CHÍNH box (giống thiet-lap-box.sh): không truyền cổng thì tự tìm qua mdns, rồi thử 5555.
noi_adb() {
  command -v adb >/dev/null || pkg install -y android-tools
  local ds=${1:-}
  [ -n "$ds" ] || ds="$(adb mdns services 2>/dev/null | awk '/_adb-tls-connect/ { n = split($NF, a, ":"); print a[n] }' | sort -u) 5555"
  for c in $ds; do
    adb connect "127.0.0.1:$c" >/dev/null 2>&1 || true
    if [ "$(adb -s "127.0.0.1:$c" get-state 2>/dev/null)" = device ]; then T=127.0.0.1:$c; A="adb -s $T"; return 0; fi
  done
  echo "Chưa nối được adb. Trên TV: Cài đặt → Hệ thống → Tuỳ chọn cho nhà phát triển → bật Gỡ lỗi không dây,"
  echo "rồi chạy lại kèm cổng hiện trên màn hình đó: bash theo-doi-remote.sh <cổng>"
  exit 1
}
noi_adb "${1:-}"
APP=vn.khophim.tv
curl -fsSL -o "$HOME/theo-doi-remote.mjs" "$NGUON/theo-doi-remote.mjs?v=$(date +%s)" || { echo "Không tải được theo-doi-remote.mjs"; exit 1; }

pid=$($A shell pidof $APP | tr -d '\r')
[ -n "$pid" ] || { echo "App Kho phim chưa mở. Mở app trên TV, vào trang bị lỗi, rồi chạy lại."; exit 1; }
grep -q "webview_devtools_remote_$pid" <<<"$($A shell cat /proc/net/unix)" || { echo "Không thấy DevTools của app (pid $pid)."; exit 1; }
$A forward tcp:9223 "localabstract:webview_devtools_remote_$pid" >/dev/null
echo "Bản máy chủ phim: $(cat "$HOME/phim/.next/BUILD_ID" 2>/dev/null) | app: $($A shell dumpsys package $APP | tr -d '\r' | sed -n 's/^ *versionName=//p' | head -1)"
node "$HOME/theo-doi-remote.mjs" 9223 "${2:-60}"
$A forward --remove tcp:9223 >/dev/null 2>&1
