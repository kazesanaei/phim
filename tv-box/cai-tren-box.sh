#!/data/data/com.termux/files/usr/bin/bash
# Cài hoặc lên bản mới máy chủ phim trên TV box. Chạy TRONG Termux (gõ qua SSH cũng được):
#   curl -fLO https://github.com/kazesanaei/phim/releases/latest/download/cai-tren-box.sh && bash cai-tren-box.sh
#
# Lần đầu: cài Node, tải bản gọn (tv-box/dong-goi.sh), dựng kho đệm 18.719 phim + sổ đen 18+,
# đặt tự chạy khi bật box (Termux:Boot), chạy luôn. Chỉ nghe 127.0.0.1: không mở ra Wi-Fi, không cần mật khẩu.
# Lần sau: thay mã + bản build, GIỮ NGUYÊN du-lieu/ (lịch sử xem, yêu thích, duyệt 18+).
# Không tự xoá gì: bản cũ để lại ở ~/phim.cu, cuối script hỏi rồi mới xoá.
set -euo pipefail
NGUON=${NGUON:-https://github.com/kazesanaei/phim/releases/latest/download}
PHIM=$HOME/phim
CU=$HOME/phim.cu
MOI=$HOME/phim.moi
BOOT=$HOME/.termux/boot/kho-phim

# In câu hỏi bằng printf ra /dev/tty: `read -p` không hiện câu hỏi qua SSH (Termius) — đã gặp 28/10/2026,
# người dùng chỉ thấy con trỏ nhấp nháy, tưởng script treo.
hoi() { local tl=""; printf '\n>>> %s [c/k] ' "$1" >/dev/tty 2>/dev/null || return 1; read -r tl </dev/tty || return 1; [ "$tl" = c ]; }

# 1. Node (cần 22+ vì node:sqlite) và unzip (giải nén kho đệm)
command -v node >/dev/null || pkg install -y nodejs-lts
command -v unzip >/dev/null || pkg install -y unzip
command -v pkill >/dev/null || pkg install -y procps
node -e 'require("node:sqlite")' 2>/dev/null || { echo "Node $(node -v) thiếu node:sqlite, cần bản 22 trở lên"; exit 1; }

# 2. Chỗ trống: bản gọn ~130 MB, kho đệm ~11 MB và lớn dần. Dưới ~500 MB là Android báo đầy.
trong=$(df -Pk "$HOME" | awk 'NR==2 { print int($4 / 1024) }')
echo "Bộ nhớ còn trống: $trong MB"
[ "$trong" -ge 400 ] || { echo "Cần ít nhất 400 MB trống. Dọn bớt rồi chạy lại (xem bảng app ở thiet-lap-box.sh)."; exit 1; }

if [ -e "$CU" ]; then
  echo "Còn bản cũ từ lần cập nhật trước: $CU ($(du -sh "$CU" | cut -f1))"
  if hoi "Xoá $CU để cập nhật tiếp?"; then rm -rf "$CU"; else echo "Dừng, chưa đổi gì."; exit 1; fi
fi
[ ! -e "$MOI" ] || { echo "Còn $MOI của lần trước bị dở. Xem lại rồi tự xoá: rm -rf $MOI"; exit 1; }

# 3. Tải thẳng vào thư mục mới, chưa đụng bản đang chạy. Không để lại tệp tải tạm.
mkdir "$MOI"
echo "Đang tải bản mới (~25 MB)..."
curl -fL --retry 3 "$NGUON/phim-tv-box.tar.gz" | tar -xz -C "$MOI"
[ -f "$MOI/phim/.next/BUILD_ID" ] || { echo "Gói tải về thiếu bản build"; exit 1; }

# 4. Dừng máy chủ cũ: diệt vòng lặp trước, không thì nó dựng node lại sau 5 giây
pkill -f "$BOOT" || true
pkill -f "node server.mjs" || true
sleep 2

# 5. Đổi bản, chuyển du-lieu/ sang bản mới
if [ -d "$PHIM" ]; then
  mv "$PHIM" "$CU"
  [ -d "$CU/du-lieu" ] && mv "$CU/du-lieu" "$MOI/phim/du-lieu"
fi
mv "$MOI/phim" "$PHIM"
rmdir "$MOI"

if [ ! -f "$PHIM/du-lieu/phim.db" ]; then
  echo "Dựng kho đệm 18.719 phim (kèm sổ đen 18+)..."
  mkdir -p "$PHIM/du-lieu"
  unzip -q "$PHIM/kho-dem/kho-dem-18719-phim.zip" -d "$PHIM/du-lieu"
  mv "$PHIM/du-lieu/phim-kho-dem.db" "$PHIM/du-lieu/phim.db"
fi

# 6. Tự chạy khi bật box. Vòng lặp: máy chủ chết (hết RAM khi đang xem VTVgo...) thì 5 giây sau tự dậy.
#    Script này còn được app Kho phim gọi lại qua Termux (RUN_COMMAND) khi chờ máy chủ quá lâu — nên tự thoát nếu
#    đã có một vòng lặp đang chạy (tệp pid), không thì hai vòng lặp tranh nhau cổng 3000.
#    KHO_PHIM_BOX=1: máy chủ giãn việc nền (cập nhật kho 6 giờ/lần, quét 18+ lúc 1–5 giờ sáng — lib/cap-nhat-moi.ts,
#    lib/quet-18.ts). TZ lấy theo giờ của box để "1–5 giờ sáng" đúng giờ Việt Nam.
mkdir -p "$(dirname "$BOOT")"
cat > "$BOOT" <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
PID="$HOME/.kho-phim.pid"
if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then exit 0; fi
echo $$ > "$PID"
termux-wake-lock
export KHO_PHIM_BOX=1
TZ=$(getprop persist.sys.timezone)
[ -n "$TZ" ] && export TZ
cd "$HOME/phim" || exit 1
while true; do
  echo "=== $(date '+%F %T') khoi dong" >> server.log
  node server.mjs >> server.log 2>&1
  echo "=== $(date '+%F %T') thoat ma $?" >> server.log
  # Giữ log gọn: quá 2 MB thì cắt còn 2000 dòng cuối
  [ "$(wc -c < server.log)" -gt 2000000 ] && tail -n 2000 server.log > server.log.tmp && mv server.log.tmp server.log
  sleep 5
done
EOF
chmod 700 "$BOOT"

# SSH tự bật khi khởi động box: để sửa từ điện thoại mà khỏi ra TV gõ `sshd` (vẫn cần mật khẩu, chỉ trong mạng nhà)
if command -v sshd >/dev/null; then
  printf '#!/data/data/com.termux/files/usr/bin/sh\ntermux-wake-lock\nsshd\n' > "$HOME/.termux/boot/ssh"
  chmod 700 "$HOME/.termux/boot/ssh"
fi

# Cho app Kho phim nhờ Termux chạy lại máy chủ (RUN_COMMAND). Quyền phía app cấp bằng adb trong thiet-lap-box.sh.
TP=$HOME/.termux/termux.properties
grep -q '^allow-external-apps *= *true' "$TP" 2>/dev/null || echo 'allow-external-apps = true' >> "$TP"
command -v termux-reload-settings >/dev/null && { termux-reload-settings 2>/dev/null || true; }

nohup "$BOOT" >/dev/null 2>&1 &

echo "Đang chờ máy chủ lên..."
for _ in $(seq 1 40); do
  sleep 3
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/)" = 200 ]; then
    echo "XONG: máy chủ phim chạy ở http://127.0.0.1:3000 (bản $(cat "$PHIM/.next/BUILD_ID"))."
    echo "Bộ nhớ còn trống: $(df -Pk "$HOME" | awk 'NR==2 { print int($4 / 1024) }') MB"
    if [ -e "$CU" ] && hoi "Mở app Kho phim xem thử đã. Chạy ổn thì xoá bản cũ $CU ($(du -sh "$CU" | cut -f1))?"; then
      rm -rf "$CU"
    fi
    exit 0
  fi
done
echo "Máy chủ chưa lên sau 2 phút. Xem log: tail -40 ~/phim/server.log"
exit 1
