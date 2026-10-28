#!/data/data/com.termux/files/usr/bin/bash
# Thay màn hình chính Google TV (launcherx, ~130 MB RAM, tải gợi ý/quảng cáo liên tục) bằng launcher nhẹ
# cleanyourtv — như box Xiaomi phòng mình. Màn hình chính chỉ còn Kho phim · VTVgo · TV360 · SmartTube; nút
# YouTube trên remote mở Kho phim, nút Netflix mở VTVgo (tv-box/launcher/cau-hinh.py).
#   bash doi-launcher.sh [cổng adb]             thay (kiểm tra kỹ, hỏi trước khi tắt gì)
#   bash doi-launcher.sh kiem [cổng adb]        chỉ xem tình trạng, không đổi gì
#   bash doi-launcher.sh khoi-phuc [cổng adb]   trả màn hình chính Google TV như cũ
#
# Theo examples/google-chromecast-gtv-4k/debloat.txt của cleanyourtv (đúng mẫu sabrina, bản UTTC.250917.004):
#  - Bản Android này KHÔNG nghe set-home-activity khi launcherx còn bật: phải tắt cả launcherx LẪN setupwraith
#    (setupwraith bật lại launcherx, RecoveryActivity của nó giành Home).
#  - Tắt setupwraith thì Android XOÁ mạng Wi-Fi do nó tạo: box rớt mạng. Script dừng nếu thấy vậy.
#  - Tắt setupwraith thì mất cast từ điện thoại — nhà mình đã tắt cast từ trước (tat-goi.sh nhóm 2).
#  - Gỡ lỗi không dây tự tắt mỗi lần khởi động lại. Nếu launcher mới hỏng NGAY lúc khởi động thì không còn đường
#    adb để cứu từ xa — cách cuối cùng là khôi phục cài đặt gốc (giữ nút ở lưng Chromecast). Vì vậy: thử kỹ
#    trước khi khởi động lại (bước cuối script hướng dẫn).
set -uo pipefail
NGUON=${NGUON:-https://github.com/kazesanaei/phim/releases/latest/download}
MOI=com.gathin.tvhome
CU=com.google.android.apps.tv.launcherx
WRAITH=com.google.android.tungsten.setupwraith
SAO_LUU=$HOME/sao-luu-launcher.txt
if [[ "${1:-}" =~ ^[0-9]{4,5}$ ]]; then CONG=$1; VIEC=lam; else VIEC=${1:-lam}; CONG=${2:-}; fi

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
hoi() { local tl=""; printf '\n>>> %s [c/k] ' "$1" >/dev/tty 2>/dev/null || return 1; read -r tl </dev/tty || return 1; [ "$tl" = c ]; }
sh_() { $A shell "$@" | tr -d '\r'; }
home_dk() { sh_ cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -1; }
# KHÔNG `| grep -q` sau lệnh dài khi có pipefail: grep -q thoát ngay khi thấy, lệnh phía trước dính SIGPIPE, cả
# chuỗi báo SAI — thử trên box giả 28/10/2026, co_goi báo "chưa cài" với gói có thật. Nên đọc hết rồi mới so.
da_tat() { grep -qx "package:$1" <<<"$(sh_ pm list packages -d)"; }
co_goi() { grep -qx "package:$1" <<<"$(sh_ pm list packages)"; }
# Bấm Home rồi xem màn hình có thuộc gói $1 không (thử lại vài lần, launcher vẽ chậm)
home_ra() {
  sh_ input keyevent KEYCODE_HOME
  for _ in 1 2 3 4 5; do
    sleep 3
    grep -q "$1" <<<"$(sh_ dumpsys activity activities | grep -E 'ResumedActivity'; sh_ dumpsys window | grep -E 'mCurrentFocus')" && return 0
  done
  return 1
}
wifi_cua_wraith() { grep -q "$WRAITH" <<<"$(sh_ dumpsys wifi | grep -oE '(creatorName|cname)=[^ ,]+')"; }

khoi_phuc() {
  echo "Trả màn hình chính Google TV..."
  sh_ pm enable "$WRAITH" >/dev/null
  sh_ pm enable "$CU" >/dev/null
  local hd
  hd=$(sh_ cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME "$CU" | tail -1)
  sh_ cmd package set-home-activity --user 0 "$hd" >/dev/null
  # Dịch vụ phím của launcher mới: trả danh sách trợ năng như trước khi đổi (có sao lưu thì theo sao lưu)
  local tn
  tn=$(sed -n 's/^tro_nang=//p' "$SAO_LUU" 2>/dev/null)
  [ "$tn" = null ] && tn=""
  sh_ settings put secure enabled_accessibility_services "${tn:-}"
  [ -z "$tn" ] && sh_ settings put secure accessibility_enabled 0
  echo "Home đăng ký: $(home_dk)"
  if home_ra "$CU"; then echo "[OK] Đã về màn hình chính Google TV."; else echo "[CHÚ Ý] Chưa thấy Google TV trên màn — bấm Home trên remote xem."; fi
  echo "Launcher mới vẫn còn cài (không gỡ). Muốn gỡ: adb -s $T uninstall $MOI"
}

noi_adb "$CONG"

case "$VIEC" in
  kiem)
    echo "Home đăng ký: $(home_dk)"
    for p in "$CU" "$WRAITH" "$MOI"; do
      if ! co_goi "$p"; then echo "  $p: chưa cài"; elif da_tat "$p"; then echo "  $p: ĐÃ TẮT"; else echo "  $p: đang bật"; fi
    done
    echo "Trợ năng: $(sh_ settings get secure enabled_accessibility_services)"
    echo "Wi-Fi do ai tạo: $(sh_ dumpsys wifi | grep -oE '(creatorName|cname)=[^ ,]+' | sort -u | tr '\n' ' ')"
    echo "Màn hình chờ: $(sh_ settings get secure screensaver_components)"
    exit 0 ;;
  khoi-phuc) khoi_phuc; exit 0 ;;
  lam) ;;
  *) echo "Dùng: bash doi-launcher.sh [kiem | khoi-phuc] [cổng adb]"; exit 1 ;;
esac

# ---------- 1. Kiểm trước, chưa đổi gì ----------
echo "== Kiểm trước khi đổi (chưa đổi gì)"
may=$(sh_ getprop ro.product.device); ban=$(sh_ getprop ro.build.id)
echo "Máy: $may, bản $ban"
[ "$may" = sabrina ] || { hoi "Không phải Chromecast 4K (sabrina) — các bước dưới viết cho sabrina. Vẫn làm tiếp?" || exit 1; }
if wifi_cua_wraith; then
  echo "[DỪNG] Mạng Wi-Fi đang dùng do setupwraith tạo. Tắt setupwraith là Android XOÁ mạng này → box rớt Wi-Fi."
  echo "Làm trước: Cài đặt → Mạng và Internet → chọn mạng → Bỏ qua mạng (Forget), rồi kết nối lại (cần mật khẩu Wi-Fi)."
  echo "Kết nối lại xong thì bật lại Gỡ lỗi không dây và chạy lại script này."
  exit 1
fi
echo "[OK] Wi-Fi không thuộc setupwraith"
co_goi vn.khophim.tv || { echo "[DỪNG] Chưa có app Kho phim — chạy thiet-lap-box.sh trước."; exit 1; }
co_goi com.termux.boot || { echo "[DỪNG] Chưa có Termux:Boot (cần để SSH tự bật khi khởi động — đường cứu box)."; exit 1; }
[ -f "$HOME/.termux/boot/ssh" ] || { echo "[DỪNG] Chưa có ~/.termux/boot/ssh — chạy cai-tren-box.sh bản mới trước."; exit 1; }
echo "[OK] Kho phim, Termux:Boot, SSH tự bật"
hd_cu=$(home_dk)
echo "Home hiện tại: $hd_cu"

# ---------- 2. Cài launcher mới (chưa tắt gì) ----------
mkdir -p "$HOME/tai-ve"
curl -fL --retry 3 -o "$HOME/tai-ve/launcher.apk" "$NGUON/launcher.apk" || { echo "Không tải được launcher.apk"; exit 1; }
kq=$($A install -r "$HOME/tai-ve/launcher.apk" 2>&1); echo "$kq" | tail -1
case "$kq" in *Success*) ;; *) echo "[DỪNG] Cài launcher lỗi — chưa tắt gì."; exit 1 ;; esac
# Mở thử trước khi giao Home cho nó
bd=$(sh_ am start -W -a android.intent.action.MAIN -c android.intent.category.HOME -n "$MOI/.MainActivity")
grep -q 'Status: ok' <<<"$bd" || { echo "$bd"; echo "[DỪNG] Launcher mới không mở được — chưa tắt gì."; exit 1; }
echo "[OK] Launcher mới mở được (TV đang hiện nó)."

echo
echo "Sắp: tắt Google TV launcher ($CU) và trình cài đặt ban đầu ($WRAITH) — chỉ TẮT, không gỡ;"
echo "giao nút Home cho launcher mới; bật dịch vụ phím của nó (nút YouTube → Kho phim, Netflix → VTVgo)."
echo "Quay lại lúc nào cũng được: bash doi-launcher.sh khoi-phuc"
hoi "Làm tiếp?" || { echo "Dừng. Chưa tắt gì (launcher mới đã cài, không làm Home)."; exit 1; }

# ---------- 3. Đổi ----------
{ echo "luc=$(date '+%F %T')"; echo "home=$hd_cu"; echo "tro_nang=$(sh_ settings get secure enabled_accessibility_services)"
  echo "man_cho=$(sh_ settings get secure screensaver_components)"; } > "$SAO_LUU"
echo "Đã sao lưu cài đặt cũ: $SAO_LUU"
sh_ pm grant "$MOI" android.permission.ACCESS_FINE_LOCATION >/dev/null 2>&1
sh_ cmd package compile -m speed -f "$MOI" >/dev/null 2>&1
echo "  $(sh_ pm disable-user --user 0 "$CU")"
echo "  $(sh_ pm disable-user --user 0 "$WRAITH")"
sh_ cmd package set-home-activity --user 0 "$MOI/.MainActivity" >/dev/null
# Dịch vụ phím (HomeKeyService) lo app_keys 190/191. Cách bật theo launcher/build-and-install.sh của cleanyourtv.
sh_ "cmd appops set $MOI AUTO_START allow 2>/dev/null; cmd appops set $MOI APP_AUTO_START allow 2>/dev/null; appops write-settings 2>/dev/null; s=\$(settings get secure enabled_accessibility_services); case \"\$s\" in *$MOI*) ;; null|'') settings put secure enabled_accessibility_services $MOI/.HomeKeyService ;; *) settings put secure enabled_accessibility_services \"\$s:$MOI/.HomeKeyService\" ;; esac; settings put secure accessibility_enabled 1"
# Màn hình chờ Ambient (dreamx) đã tắt ở tat-goi.sh nhóm 4: trỏ sang đồng hồ của launcher
sh_ settings put secure screensaver_components "$MOI/.ClockDream"

# ---------- 4. Kiểm sau khi đổi, hỏng thì tự trả lại ----------
hd=$(home_dk)
echo "Home đăng ký: $hd"
if [[ "$hd" == $MOI/* ]] && home_ra "$MOI"; then
  echo "[OK] Bấm Home ra launcher mới."
else
  echo "[LỖI] Home không về launcher mới — tự trả lại như cũ."
  khoi_phuc
  exit 1
fi
[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 https://www.google.com/generate_204)" = 204 ] && echo "[OK] Còn mạng" \
  || { echo "[LỖI] Mất mạng — tự trả lại như cũ."; khoi_phuc; exit 1; }

cat <<'HET'

XONG phần đổi. Thử bằng remote TRƯỚC khi khởi động lại:
  1. Bấm Home: ra màn hình mới (Kho phim · VTVgo · TV360 · SmartTube).
  2. Mở Kho phim, xem thử một phim; Back về; mở VTVgo.
  3. Bấm nút YouTube trên remote → mở Kho phim; nút Netflix → mở VTVgo.
  4. Vào Cài đặt (bánh răng ở màn hình mới) → Hệ thống → Tuỳ chọn cho nhà phát triển: còn vào được.
Có gì sai: bash doi-launcher.sh khoi-phuc

Ổn hết thì khởi động lại để chắc (rút điện, cắm lại). Sau khi bật:
  - Màn hình mới phải tự lên. Kho phim mở được.
  - Gỡ lỗi không dây tự tắt sau khởi động lại: muốn dùng adb thì bật lại trong Tuỳ chọn cho nhà phát triển.
HET
