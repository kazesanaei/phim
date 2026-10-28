#!/data/data/com.termux/files/usr/bin/bash
# Dọn Chromecast with Google TV cho mượt: TẮT (pm disable-user, không gỡ) từng nhóm gói, kiểm tra sau mỗi nhóm.
#   bash tat-goi.sh <cổng adb> <số nhóm>      tắt một nhóm (xem DANH_SACH bên dưới)
#   bash tat-goi.sh <cổng adb> xem            chỉ in nhóm nào có gói nào trên box, không đổi gì
#   bash tat-goi.sh <cổng adb> khoi-phuc      bật lại MỌI gói trong danh sách, trả cài đặt về như cũ
# Cổng adb: màn Gỡ lỗi không dây (đổi sau mỗi lần khởi động lại box).
#
# Lựa chọn của nhà mình (28/10/2026): không dùng mic remote, không cast, không dùng nút YouTube/Netflix.
# GIỮ: launcher Google TV (launcherx), setupwraith (giữ Wi-Fi), CH Play, GMS, cập nhật hệ thống, remote,
# VTVgo, TV360, SmartTube, Kho phim, Termux. Không thay launcher: nhà bố mẹ không có máy để cứu nếu treo logo.
set -uo pipefail
T=127.0.0.1:${1:?thiếu cổng adb}
VIEC=${2:?thiếu số nhóm, xem hoặc khoi-phuc}
A="adb -s $T"
LAUNCHER=com.google.android.apps.tv.launcherx

DANH_SACH='
# Nhóm 1 — gửi phản hồi, thống kê
1 com.google.android.feedback
1 com.android.tv.feedbackconsent
# Nhóm 2 — Trợ lý Google (nút mic) và Chromecast built-in (cast từ điện thoại)
2 com.google.android.katniss
2 com.google.android.apps.mediashell
# Nhóm 3 — app có sẵn không dùng (nút YouTube, Netflix trên remote sẽ không còn tác dụng)
3 com.google.android.youtube.tv
3 com.netflix.ninja
3 com.google.android.youtube.tvmusic
3 com.google.android.youtube.tvkids
3 com.google.android.videos
3 com.google.android.play.games
3 com.google.android.marvin.talkback
# Nhóm 4 — màn hình chờ Ambient (tải ảnh qua mạng, chạy ngầm)
4 com.google.android.apps.tv.dreamx
'

adb connect "$T" >/dev/null 2>&1
[ "$($A get-state 2>/dev/null)" = device ] || { echo "Chưa nối adb $T. Xem cổng ở màn Gỡ lỗi không dây."; exit 1; }
sh_() { $A shell "$@" | tr -d '\r'; }

goi_nhom() { sed -n "s/^$1 \([a-z0-9_.]*\)$/\1/p" <<<"$DANH_SACH"; }
CO=$(sh_ pm list packages | sed 's/^package://')
DA_TAT=$(sh_ pm list packages -d | sed 's/^package://')

# Sau mỗi nhóm: Home vẫn về launcher Google TV, còn mạng, máy chủ phim còn sống
kiem() {
  local loi=0
  # Lần chạy nhóm 1 đầu tiên (28/10/2026) báo lỗi Home dù chỉ tắt 2 gói phản hồi: cách đọc cũ chỉ lấy
  # dòng "ResumedActivity" ĐẦU TIÊN, mà Android 14 in nhiều dòng như vậy. Nay xem mọi dòng và ô đang
  # nhận phím, thử lại vài lần (launcher vẽ chậm), lỗi thì in ra đang có gì trên màn hình.
  local home tren=""
  home=$(sh_ cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -1)
  sh_ input keyevent KEYCODE_HOME
  for _ in 1 2 3 4 5; do
    sleep 3
    tren=$( { sh_ dumpsys activity activities | grep -E 'ResumedActivity'; sh_ dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'; } )
    grep -q "$LAUNCHER" <<<"$tren" && break
  done
  if grep -q "$LAUNCHER" <<<"$tren"; then
    echo "  [OK] Màn hình chính Google TV"
  else
    echo "  [LỖI] Bấm Home không thấy màn hình chính Google TV. Home đăng ký: $home"
    echo "        Đang trên màn hình:"; sed 's/^ */          /' <<<"$tren" | head -6
    loi=1
  fi
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 https://www.google.com/generate_204)" = 204 ]; then
    echo "  [OK] Có mạng"
  else
    echo "  [LỖI] Mất mạng"; loi=1
  fi
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3000/)" = 200 ]; then
    echo "  [OK] Máy chủ phim"
  else
    echo "  [CHÚ Ý] Máy chủ phim không trả lời (có thể đang tự khởi động lại, thử lại sau 10 giây)"
  fi
  return $loi
}

case "$VIEC" in
  xem)
    for n in 1 2 3 4; do
      echo "Nhóm $n:"
      for p in $(goi_nhom $n); do
        if ! grep -qx "$p" <<<"$CO"; then echo "  -- $p (không có trên box)"
        elif grep -qx "$p" <<<"$DA_TAT"; then echo "  ✓  $p (đã tắt)"
        else echo "  •  $p (đang bật)"; fi
      done
    done
    ;;
  khoi-phuc)
    TRUOC=$(cat "$HOME/sao-luu-goi-da-tat.txt" 2>/dev/null)
    for p in $(sed -n 's/^[0-9] \([a-z0-9_.]*\)$/\1/p' <<<"$DANH_SACH"); do
      grep -qx "$p" <<<"$CO" || continue
      if grep -qx "$p" <<<"$TRUOC"; then echo "  -- $p (đã tắt từ trước khi dọn, để nguyên)"; continue; fi
      echo "  $(sh_ pm enable "$p")"
    done
    sh_ settings put global window_animation_scale 1
    sh_ settings put global transition_animation_scale 1
    sh_ settings put global animator_duration_scale 1
    kiem
    ;;
  [1-4])
    # Sao lưu một lần: gói nào đã tắt TRƯỚC khi dọn (khôi phục không bật nhầm những gói này)
    [ -f "$HOME/sao-luu-goi-da-tat.txt" ] || { echo "$DA_TAT" > "$HOME/sao-luu-goi-da-tat.txt"; echo "Đã sao lưu danh sách gói đang tắt: ~/sao-luu-goi-da-tat.txt"; }
    echo "Nhóm $VIEC:"
    for p in $(goi_nhom "$VIEC"); do
      grep -qx "$p" <<<"$CO" || { echo "  -- $p (không có trên box, bỏ qua)"; continue; }
      echo "  $(sh_ pm disable-user --user 0 "$p")"
    done
    if [ "$VIEC" = 4 ]; then
      # Hiệu ứng chuyển cảnh nhanh gấp đôi: box 2 GB thấy mượt hẳn, đặt lại về 1 là như cũ
      sh_ settings put global window_animation_scale 0.5
      sh_ settings put global transition_animation_scale 0.5
      sh_ settings put global animator_duration_scale 0.5
      echo "  Hiệu ứng chuyển cảnh: 0.5x"
    fi
    if ! kiem; then
      echo
      echo "CÓ LỖI sau nhóm $VIEC. Bật lại nhóm này:"
      for p in $(goi_nhom "$VIEC"); do echo "  adb -s $T shell pm enable $p"; done
      exit 1
    fi
    ;;
  *) echo "Không hiểu '$VIEC'. Dùng: <số nhóm 1-4> | xem | khoi-phuc"; exit 1 ;;
esac
