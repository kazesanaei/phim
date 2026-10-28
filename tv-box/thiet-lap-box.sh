#!/data/data/com.termux/files/usr/bin/bash
# Một lần cho mỗi box: Termux tự nối adb vào CHÍNH box (không cần laptop), rồi
#   1. tắt "phantom process killer" — Android 12+ giết tiến trình con của Termux, tức là giết máy chủ phim
#   2. cho Termux khỏi bị Android cho ngủ
#   3. cài app Kho phim (tv-box/kho-phim-app)
#   4. in bảng app chiếm bộ nhớ để quyết định dọn gì (chỉ đọc, không xoá gì)
# Cần: Tuỳ chọn nhà phát triển → bật Gỡ lỗi USB. Chạy trong Termux:
#   curl -fLO https://github.com/kazesanaei/phim/releases/latest/download/thiet-lap-box.sh && bash thiet-lap-box.sh
set -euo pipefail
NGUON=${NGUON:-https://github.com/kazesanaei/phim/releases/latest/download}
T=127.0.0.1:5555
A="adb -s $T"

command -v adb >/dev/null || pkg install -y android-tools

adb connect "$T" || true
echo
echo ">>> Nhìn lên TV: tick 'Luôn cho phép từ máy tính này' rồi bấm 'Cho phép'."
for _ in $(seq 1 30); do
  [ "$($A get-state 2>/dev/null)" = device ] && break
  sleep 2
  adb connect "$T" >/dev/null 2>&1 || true
done
if [ "$($A get-state 2>/dev/null)" != device ]; then
  echo "Chưa nối được adb vào $T. Kiểm: Gỡ lỗi USB đã bật chưa; trên TV có hộp thoại nào chưa bấm không."
  echo "Rồi chạy lại script này."
  exit 1
fi
echo "Đã nối adb: $($A shell getprop ro.product.model | tr -d '\r'), Android $($A shell getprop ro.build.version.release | tr -d '\r')"

# 1 + 2. Giống box Xiaomi (tvbox-phim/PHAN-TICH-MAY-CHU-PHIM.md). Đặt lại như cũ:
#   settings put global settings_enable_monitor_phantom_procs true ; dumpsys deviceidle whitelist -com.termux
$A shell settings put global settings_enable_monitor_phantom_procs false
$A shell dumpsys deviceidle whitelist +com.termux >/dev/null
$A shell cmd appops set com.termux RUN_ANY_IN_BACKGROUND allow
echo "Đã tắt phantom process killer và miễn ngủ cho Termux."

# 3. App Kho phim
mkdir -p "$HOME/tai-ve"
curl -fL --retry 3 -o "$HOME/tai-ve/kho-phim.apk" "$NGUON/kho-phim.apk"
$A install -r "$HOME/tai-ve/kho-phim.apk"
echo "Đã cài app Kho phim."

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
