#!/data/data/com.termux/files/usr/bin/bash
# Kiểm tra trọn đường xem phim trong app Kho phim trên box: mở app (từ trạng thái tắt hẳn), lướt, mở phim,
# phát, tua, dừng/phát, về trang chủ, tìm kiếm — kèm bộ nhớ, CPU, tốc độ máy chủ. Chỉ đo, không sửa gì.
#   bash kiem-tra-app.sh [cổng adb]
# Trong lúc chạy (~2 phút) TV tự bấm, tự phát phim: đừng cầm remote. Bản đủ: ~/bao-cao-app.json
set -uo pipefail
NGUON=${NGUON:-https://raw.githubusercontent.com/kazesanaei/phim/claude/tv-box-chromecast/tv-box}
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
  echo "(tự tắt mỗi lần khởi động lại box)."
  exit 1
}
noi_adb "${1:-}"
APP=vn.khophim.tv
curl -fsSL -o "$HOME/kiem-tra-app.mjs" "$NGUON/kiem-tra-app.mjs?v=$(date +%s)" || { echo "Không tải được kiem-tra-app.mjs"; exit 1; }

ms() { curl -s -o /dev/null -w '%{time_starttransfer}' --max-time 60 "http://127.0.0.1:3000$1" | awk '{ printf "%d", $1 * 1000 }'; }
[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://127.0.0.1:3000/)" = 200 ] || { echo "Máy chủ phim không trả lời ở cổng 3000"; exit 1; }
echo "0. MÁY CHỦ: trang chủ $(ms /) ms, lần nữa $(ms /) ms | bản $(cat "$HOME/phim/.next/BUILD_ID" 2>/dev/null)"

# Mở app từ trạng thái tắt hẳn, như bố bấm vào biểu tượng
$A shell am force-stop $APP
sleep 1
moc=$(date +%s%3N)
$A shell am start -n $APP/.MainActivity >/dev/null
pid=""
for _ in $(seq 1 40); do pid=$($A shell pidof $APP | tr -d '\r'); [ -n "$pid" ] && break; sleep 0.25; done
[ -n "$pid" ] || { echo "App không mở"; exit 1; }
for _ in $(seq 1 60); do grep -q "webview_devtools_remote_$pid" <<<"$($A shell cat /proc/net/unix)" && break; sleep 0.25; done
$A forward tcp:9222 "localabstract:webview_devtools_remote_$pid" >/dev/null
node "$HOME/kiem-tra-app.mjs" 9222 "$moc"
$A forward --remove tcp:9222 >/dev/null 2>&1

# Nguồn có bóp tốc độ từng kết nối không: tải thẳng (không qua máy chủ phim) 1 đoạn, rồi 3 đoạn cùng lúc
mapfile -t DOAN < <(node -e 'try { const b = require(process.env.HOME + "/bao-cao-app.json"); for (const u of (b.buoc.doanVideo || {}).url || []) console.log(u) } catch {}')
if [ "${#DOAN[@]}" -ge 3 ]; then
  tai() { curl -s -o /dev/null --max-time 40 -A 'Mozilla/5.0' -e "$(echo "$1" | sed -E 's#^(https?://[^/]+).*#\1/#')" -w '%{size_download} %{time_total}\n' "$1"; }
  mot=$(tai "${DOAN[0]}" | awk '{ printf "%d", $1 / 1024 / $2 }')
  bd=$(date +%s%3N)
  tong=$( { tai "${DOAN[0]}" & tai "${DOAN[1]}" & tai "${DOAN[2]}" & wait; } | awk '{ s += $1 } END { printf "%d", s / 1024 }')
  ba=$(( tong * 1000 / ( $(date +%s%3N) - bd ) ))
  echo "MẠNG TỚI NGUỒN: 1 luồng ${mot} KB/s | 3 luồng cùng lúc ${ba} KB/s tổng"
fi

echo
pss() { $A shell dumpsys meminfo 2>/dev/null | tr -d '\r' | sed -n '/^Total PSS by process:/,/^$/p' | grep -E "$1" | head -3 \
  | sed -E 's/^ *([0-9,]+)K: ([^ ]+).*/\2 \1/' | awk '{ gsub(",", "", $2); printf "%s %d MB; ", $1, $2 / 1024 }'; }
echo "BỘ NHỚ: app+trình duyệt: $(pss 'khophim|sandboxed_process')"
echo "        máy chủ phim (node): $(ps -eo rss,args | awk '/node server.mjs/ && !/awk/ { printf "%d MB", $1 / 1024; exit }')"
echo "        RAM còn trống: $(awk '/MemAvailable/ { printf "%d MB", $2 / 1024 }' /proc/meminfo) | bộ nhớ trong còn: $(df -Pk "$HOME" | awk 'NR==2 { printf "%d MB", $4 / 1024 }')"
echo "CPU (5 tiến trình nặng nhất lúc này):"
$A shell top -b -n 1 -m 5 -o %CPU,RES,NAME 2>/dev/null | tr -d '\r' | tail -n 5 | sed 's/^/   /'
