#!/data/data/com.termux/files/usr/bin/bash
# Dọn Chromecast with Google TV cho mượt: TẮT (pm disable-user, không gỡ) từng nhóm gói, kiểm tra sau mỗi nhóm.
#   bash tat-goi.sh <số nhóm> [cổng adb]      tắt một nhóm (xem DANH_SACH bên dưới)
#   bash tat-goi.sh xem [cổng adb]            chỉ in nhóm nào có gói nào trên box, không đổi gì
#   bash tat-goi.sh khoi-phuc [cổng adb]      bật lại MỌI gói trong danh sách, trả cài đặt về như cũ
# Không cần cổng: tự tìm (xem noi_adb). Kiểu cũ `bash tat-goi.sh <cổng> <nhóm>` vẫn chạy.
#
# Lựa chọn của nhà mình (28/10/2026): không dùng mic remote, không cast, không dùng nút YouTube/Netflix.
# GIỮ: setupwraith (giữ Wi-Fi — chỉ doi-launcher.sh mới đụng tới), CH Play, GMS, cập nhật hệ thống, remote,
# VTVgo, TV360, SmartTube, Kho phim, Termux. Thay launcher là việc riêng của tv-box/doi-launcher.sh.
# Nhóm 5 theo examples/google-chromecast-gtv-4k/debloat.txt của cleanyourtv (đúng mẫu sabrina, đúng bản
# UTTC.250917.004 của box nhà mình, đã chạy ổn trên máy của họ).
set -uo pipefail
if [[ "${1:-}" =~ ^[0-9]{4,5}$ ]]; then CONG=$1; VIEC=${2:-}; else VIEC=${1:-}; CONG=${2:-}; fi
[ -n "$VIEC" ] || { echo "Dùng: bash tat-goi.sh <số nhóm 1-5 | xem | khoi-phuc> [cổng adb]"; exit 1; }

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
# Nhóm 5 — chạy ngầm còn lại: ghi log remote, chẩn đoán mạng, quảng cáo / cá nhân hoá (Privacy Sandbox,
# federated learning), ảnh nền màn hình chờ. Thêm: hiệu ứng chuyển cảnh của hệ thống về 0 (tắt hẳn).
5 com.google.android.tv.remotecontrol.logging
5 com.google.android.apps.tv.netoscope
5 com.google.android.federatedcompute
5 com.google.android.ondevicepersonalization.services
5 com.google.android.adservices.api
5 com.google.android.ext.adservices.api
5 com.google.android.backdrop
'

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
noi_adb "$CONG"
sh_() { $A shell "$@" | tr -d '\r'; }

goi_nhom() { sed -n "s/^$1 \([a-z0-9_.]*\)$/\1/p" <<<"$DANH_SACH"; }
CO=$(sh_ pm list packages | sed 's/^package://')
DA_TAT=$(sh_ pm list packages -d | sed 's/^package://')

# Sau mỗi nhóm: Home vẫn về màn hình chính (Google TV, hoặc launcher mới sau doi-launcher.sh), còn mạng,
# máy chủ phim còn sống
kiem() {
  local loi=0
  # Lần chạy nhóm 1 đầu tiên (28/10/2026) báo lỗi Home dù chỉ tắt 2 gói phản hồi: cách đọc cũ chỉ lấy
  # dòng "ResumedActivity" ĐẦU TIÊN, mà Android 14 in nhiều dòng như vậy. Nay xem mọi dòng và ô đang
  # nhận phím, thử lại vài lần (launcher vẽ chậm), lỗi thì in ra đang có gì trên màn hình.
  local home tren=""
  home=$(sh_ cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -1)
  local LAUNCHER=${home%%/*}
  case "$LAUNCHER" in com.google.android.apps.tv.launcherx|com.gathin.tvhome) ;; *) LAUNCHER=com.google.android.apps.tv.launcherx ;; esac
  sh_ input keyevent KEYCODE_HOME
  for _ in 1 2 3 4 5; do
    sleep 3
    tren=$( { sh_ dumpsys activity activities | grep -E 'ResumedActivity'; sh_ dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'; } )
    grep -q "$LAUNCHER" <<<"$tren" && break
  done
  if grep -q "$LAUNCHER" <<<"$tren"; then
    echo "  [OK] Màn hình chính ($LAUNCHER)"
  else
    echo "  [LỖI] Bấm Home không thấy màn hình chính ($LAUNCHER). Home đăng ký: $home"
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
    for n in 1 2 3 4 5; do
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
  [1-5])
    # Sao lưu một lần: gói nào đã tắt TRƯỚC khi dọn (khôi phục không bật nhầm những gói này)
    [ -f "$HOME/sao-luu-goi-da-tat.txt" ] || { echo "$DA_TAT" > "$HOME/sao-luu-goi-da-tat.txt"; echo "Đã sao lưu danh sách gói đang tắt: ~/sao-luu-goi-da-tat.txt"; }
    echo "Nhóm $VIEC:"
    for p in $(goi_nhom "$VIEC"); do
      grep -qx "$p" <<<"$CO" || { echo "  -- $p (không có trên box, bỏ qua)"; continue; }
      echo "  $(sh_ pm disable-user --user 0 "$p")"
    done
    if [ "$VIEC" = 4 ] || [ "$VIEC" = 5 ]; then
      # Hiệu ứng chuyển cảnh: nhóm 4 nhanh gấp đôi (0.5), nhóm 5 tắt hẳn (0). Đặt lại về 1 là như cũ.
      tl=$([ "$VIEC" = 5 ] && echo 0 || echo 0.5)
      sh_ settings put global window_animation_scale "$tl"
      sh_ settings put global transition_animation_scale "$tl"
      sh_ settings put global animator_duration_scale "$tl"
      echo "  Hiệu ứng chuyển cảnh: ${tl}x"
    fi
    if ! kiem; then
      echo
      echo "CÓ LỖI sau nhóm $VIEC. Bật lại nhóm này:"
      for p in $(goi_nhom "$VIEC"); do echo "  adb -s $T shell pm enable $p"; done
      exit 1
    fi
    ;;
  *) echo "Không hiểu '$VIEC'. Dùng: <số nhóm 1-5> | xem | khoi-phuc"; exit 1 ;;
esac
