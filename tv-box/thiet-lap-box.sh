#!/data/data/com.termux/files/usr/bin/bash
# Termux tự nối adb vào CHÍNH box (không cần laptop), rồi
#   1. tắt "phantom process killer" — Android 12+ giết tiến trình con của Termux, tức là giết máy chủ phim
#   2. cho Termux khỏi bị Android cho ngủ
#   3. cài / cập nhật app Kho phim (tv-box/kho-phim-app), cấp quyền nhờ Termux chạy lại máy chủ phim
#   4. in bảng app chiếm bộ nhớ để quyết định dọn gì (chỉ đọc, không xoá gì)
# Chạy lại bao nhiêu lần cũng được (mỗi lần có app Kho phim mới). Chạy trong Termux:
#   curl -fLO https://github.com/kazesanaei/phim/releases/latest/download/thiet-lap-box.sh && bash thiet-lap-box.sh [cổng]
#
# Hai kiểu adb, tuỳ box:
#  - Box mở adb cổng 5555 khi bật Gỡ lỗi USB (Xiaomi): TV hỏi "Cho phép gỡ lỗi" lần đầu.
#  - Chromecast with Google TV (Android 14) KHÔNG mở 5555. Dùng Gỡ lỗi không dây: Tuỳ chọn nhà phát triển →
#    Gỡ lỗi không dây → bật → "Ghép nối thiết bị bằng mã" → trong Termux: `adb pair 127.0.0.1:<cổng ghép nối>
#    <mã 6 số>` (MỘT lần). Sau đó không cần cổng: script tự tìm. Gỡ lỗi không dây tự tắt mỗi lần khởi động lại
#    box — bật lại trong Cài đặt trước khi chạy.
set -euo pipefail
NGUON=${NGUON:-https://github.com/kazesanaei/phim/releases/latest/download}
APP=vn.khophim.tv

# Nối adb vào CHÍNH box. Không truyền cổng thì tự tìm: Chromecast đổi cổng Gỡ lỗi không dây sau mỗi lần khởi
# động lại, `adb mdns services` liệt kê các cổng đang mở trong mạng — thử lần lượt trên 127.0.0.1 (máy khác
# trong nhà cũng bật gỡ lỗi thì cổng của nó không mở ở 127.0.0.1, tự bị loại). Box mở 5555 (Xiaomi) thì dùng 5555.
noi_adb() {
  command -v adb >/dev/null || pkg install -y android-tools
  local ds=${1:-}
  [ -n "$ds" ] || ds="$(adb mdns services 2>/dev/null | awk '/_adb-tls-connect/ { n = split($NF, a, ":"); print a[n] }' | sort -u) 5555"
  for c in $ds; do
    adb connect "127.0.0.1:$c" >/dev/null 2>&1 || true
    if [ "$(adb -s "127.0.0.1:$c" get-state 2>/dev/null)" = device ]; then T=127.0.0.1:$c; A="adb -s $T"; return 0; fi
  done
  echo "Chưa nối được adb. Trên TV: Cài đặt → Hệ thống → Tuỳ chọn cho nhà phát triển → bật Gỡ lỗi không dây"
  echo "(tự tắt mỗi lần khởi động lại box). Lần đầu thì ghép nối: xem đầu tệp này (head -20 thiet-lap-box.sh)."
  exit 1
}
hoi() { local tl=""; printf '\n>>> %s [c/k] ' "$1" >/dev/tty 2>/dev/null || return 1; read -r tl </dev/tty || return 1; [ "$tl" = c ]; }

noi_adb "${1:-}"
echo "Đã nối adb ($T): $($A shell getprop ro.product.model | tr -d '\r'), Android $($A shell getprop ro.build.version.release | tr -d '\r')"

# 1 + 2. Giống box Xiaomi (tvbox-phim/PHAN-TICH-MAY-CHU-PHIM.md). Đặt lại như cũ:
#   settings put global settings_enable_monitor_phantom_procs true ; dumpsys deviceidle whitelist -com.termux
$A shell settings put global settings_enable_monitor_phantom_procs false
$A shell dumpsys deviceidle whitelist +com.termux >/dev/null
$A shell cmd appops set com.termux RUN_ANY_IN_BACKGROUND allow
echo "Đã tắt phantom process killer và miễn ngủ cho Termux."

# 3. App Kho phim. Từ bản 1.1 ký bằng khoá cố định (tv-box/khoa) — bản 1.0 cài trước đó ký bằng khoá ngẫu nhiên
#    của GitHub nên không cài đè được: phải gỡ bản cũ một lần (chỉ mất cookie/cài đặt trình phát trong app).
mkdir -p "$HOME/tai-ve"
curl -fL --retry 3 -o "$HOME/tai-ve/kho-phim.apk" "$NGUON/kho-phim.apk"
kq=$($A install -r "$HOME/tai-ve/kho-phim.apk" 2>&1 || true)
echo "$kq" | tail -1
case "$kq" in
  *Success*) ;;
  *UPDATE_INCOMPATIBLE*|*signatures*)
    echo "Bản app Kho phim đang cài ký bằng khoá cũ, không cài đè được."
    if hoi "Gỡ app Kho phim cũ rồi cài bản mới? (lịch sử xem nằm ở máy chủ phim, KHÔNG mất)"; then
      $A uninstall "$APP"
      kq=$($A install "$HOME/tai-ve/kho-phim.apk" 2>&1 || true)
      echo "$kq" | tail -1
      case "$kq" in *Success*) ;; *) echo "[LỖI] Đã gỡ bản cũ nhưng cài bản mới lỗi. Chạy lại script này."; exit 1 ;; esac
    else
      echo "Giữ bản cũ, dừng ở đây."; exit 1
    fi ;;
  *) echo "Cài app Kho phim lỗi (xem dòng trên)."; exit 1 ;;
esac
# Cho app nhờ Termux chạy lại máy chủ phim khi nó chết (MainActivity.goiTermux; phía Termux bật trong cai-tren-box.sh)
$A shell pm grant "$APP" com.termux.permission.RUN_COMMAND 2>/dev/null && echo "Đã cấp quyền gọi Termux cho app Kho phim." \
  || echo "Chưa cấp được quyền gọi Termux (app bản cũ?) — app vẫn chạy, chỉ không tự bật lại máy chủ."
echo "App Kho phim: bản $($A shell dumpsys package "$APP" | tr -d '\r' | sed -n 's/^ *versionName=//p' | head -1)"

# 4. Bảng bộ nhớ (số Android tự tính định kỳ, có thể chậm vài giờ)
echo
echo "Bộ nhớ: $(df -Pk "$HOME" | awk 'NR==2 { printf "trống %d MB / tổng %d MB", $4 / 1024, $2 / 1024 }')"
echo "RAM: $(awk '/MemTotal/ { t = $2 } /MemAvailable/ { a = $2 } END { printf "còn %d MB / tổng %d MB", a / 1024, t / 1024 }' /proc/meminfo)"
echo
echo "20 app chiếm nhiều nhất (tổng = app + dữ liệu + đệm):"
ds=$($A shell dumpsys diskstats | tr -d '\r')
mang() { sed -n "s/^$1: \[\(.*\)\]$/\1/p" <<<"$ds" | tr -d '"' | tr ',' '\n'; }
paste <(mang 'Package Names') <(mang 'App Sizes') <(mang 'App Data Sizes') <(mang 'Cache Sizes') \
  | awk -F'\t' '{ printf "%6.0f MB  (đệm %4.0f MB)  %s\n", ($2 + $3 + $4) / 1048576, $4 / 1048576, $1 }' \
  | sort -rn | head -20
