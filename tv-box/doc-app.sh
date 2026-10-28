#!/data/data/com.termux/files/usr/bin/bash
# CHỈ ĐỌC: một app nhận những "đường dẫn mở thẳng" (deep link) nào — để làm nút kênh ngoài màn hình chính.
#   bash doc-app.sh <cổng adb> [từ khoá tên gói]      mặc định tìm VTVgo, TV360
# In: gói khớp từ khoá, rồi với từng gói: activity nhận VIEW kèm scheme/host/path. Không đổi gì.
set -uo pipefail
T=127.0.0.1:${1:?thiếu cổng adb}
KHOA=${2:-vtv|tv360|viettel}
A="adb -s $T"
adb connect "$T" >/dev/null 2>&1
[ "$($A get-state 2>/dev/null)" = device ] || { echo "Chưa nối adb $T. Xem cổng ở màn Gỡ lỗi không dây."; exit 1; }
sh_() { $A shell "$@" | tr -d '\r'; }

goi=$(sh_ pm list packages | sed 's/^package://' | grep -iE "$KHOA")
echo "GÓI KHỚP '$KHOA': $(tr '\n' ' ' <<<"$goi")"
for p in $goi; do
  echo
  echo "===== $p  (bản $(sh_ dumpsys package "$p" | sed -n 's/^ *versionName=//p' | head -1))"
  echo "-- Mở bằng: $(sh_ cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER "$p" | tail -1)"
  # Bảng resolver: mỗi khối là một activity + bộ lọc; chỉ giữ dòng có ích, bỏ trùng
  sh_ dumpsys package "$p" | sed -n '/^Activity Resolver Table:/,/^[A-Z][a-z]* Resolver Table:/p' \
    | grep -E "^ +[0-9a-f]+ $p/|Action: \"android.intent.action.VIEW\"|Scheme: |Authority: |Path: |PathPrefix|PathPattern" \
    | sed -E 's/^ +[0-9a-f]+ /  >> /; s/^ +/     /' | awk '!thay[$0]++' | head -60
done
