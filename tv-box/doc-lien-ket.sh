#!/data/data/com.termux/files/usr/bin/bash
# CHỈ ĐỌC: tìm dạng đường dẫn mở thẳng (vd vtvgo://...) có ghi sẵn trong app, để làm nút kênh ngoài màn hình chính.
#   bash doc-lien-ket.sh <cổng adb> [gói, mặc định vn.vtv.vtvgotv] [scheme, mặc định vtvgo]
# doc-app.sh chỉ cho biết app nhận scheme gì (VTVgo: "vtvgo", không ghi host/path) — phần sau scheme nằm trong mã app.
# Chép bản sao APK vào $TMPDIR để đọc, xong HỎI rồi mới xoá bản sao (app trên box không bị đụng tới).
set -uo pipefail
T=127.0.0.1:${1:?thiếu cổng adb}
GOI=${2:-vn.vtv.vtvgotv}
SCHEME=${3:-vtvgo}
A="adb -s $T"
adb connect "$T" >/dev/null 2>&1
[ "$($A get-state 2>/dev/null)" = device ] || { echo "Chưa nối adb $T. Xem cổng ở màn Gỡ lỗi không dây."; exit 1; }
command -v unzip >/dev/null || pkg install -y unzip

duong=$($A shell pm path "$GOI" | tr -d '\r' | sed -n 's/^package://p' | grep 'base.apk' | head -1)
[ -n "$duong" ] || { echo "Không thấy gói $GOI"; exit 1; }
BAN=$TMPDIR/doc-$GOI.apk
$A exec-out cat "$duong" > "$BAN"
echo "Bản sao: $(du -h "$BAN" | cut -f1)"

tep=$(unzip -Z1 "$BAN")
echo "Kiểu app: $(grep -q '^assets/index.android.bundle$' <<<"$tep" && echo React-Native) \
$(grep -q 'libflutter.so' <<<"$tep" && echo Flutter) $(grep -c '^classes[0-9]*\.dex$' <<<"$tep") tệp dex"

# Đọc các tệp có thể chứa mã/chuỗi: dex, bundle JS, libapp.so (Flutter), json/xml cấu hình
doc() { grep -E '^(classes[0-9]*\.dex|assets/.*\.(bundle|js|json)|lib/[^/]+/libapp\.so|res/xml/.*\.xml)$' <<<"$tep" \
  | while read -r f; do unzip -p "$BAN" "$f"; done; }

echo
echo "== Đường dẫn $SCHEME://... ghi sẵn trong app"
doc | grep -a -o -E "$SCHEME://[A-Za-z0-9_./?=&%{}:-]{0,80}" | sort -u | head -40
echo
echo "== Chuỗi quanh deeplink / channel / live (để đoán phần sau $SCHEME://)"
doc | grep -a -o -i -E "[A-Za-z0-9_./:-]{0,30}(deep_?link|/channel|/live|channel_?id|livetv|/kenh)[A-Za-z0-9_./?={}:-]{0,40}" \
  | sort -u | head -60

echo
read -r -p "Xoá bản sao APK tạm $BAN ($(du -h "$BAN" | cut -f1))? [c/k] " tl </dev/tty || tl=k
if [ "$tl" = c ]; then rm -f "$BAN" && echo "Đã xoá bản sao."; else echo "Giữ lại: $BAN"; fi
