#!/data/data/com.termux/files/usr/bin/bash
# CHỈ ĐỌC: liệt kê gói, Home, chủ Wi-Fi, RAM theo app — để lập danh sách tắt cho đúng box. Không đổi gì.
#   curl -fLO https://github.com/kazesanaei/phim/releases/latest/download/doc-goi.sh && bash doc-goi.sh <cổng adb>
# Kết quả in gọn (gói nối nhau trên một dòng cho ít trang chụp màn hình) và lưu ở ~/goi-box.txt.
set -uo pipefail
T=127.0.0.1:${1:-5555}
A="adb -s $T"
adb connect "$T" >/dev/null 2>&1
[ "$($A get-state 2>/dev/null)" = device ] || { echo "Chưa nối adb $T. Xem cổng ở màn Gỡ lỗi không dây."; exit 1; }

sh_() { $A shell "$@" | tr -d '\r'; }
gon() { sed 's/^package://' | sort | tr '\n' ' '; echo; }

{
  echo "MAY: $(sh_ getprop ro.product.model) / $(sh_ getprop ro.product.device) / $(sh_ getprop ro.build.version.incremental)"
  echo "HOME: $(sh_ cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -1)"
  echo "WIFI THUOC: $(sh_ dumpsys wifi | grep -oE '(creatorName|cname)=[^ ,]+' | sort -u | tr '\n' ' ')"
  echo
  echo "== HE THONG DANG BAT ($(sh_ pm list packages -s -e | wc -l) goi)"
  sh_ pm list packages -s -e | gon
  echo
  echo "== DA TAT"
  sh_ pm list packages -d | gon
  echo
  echo "== CAI THEM"
  sh_ pm list packages -3 | gon
  echo
  echo "== RAM THEO APP (MB, 30 app nhieu nhat)"
  sh_ dumpsys meminfo | sed -n '/^Total PSS by process:/,/^$/p' | sed -n '2,31p' \
    | sed -E 's/^ *([0-9,]+)K: ([^ ]+).*/\1 \2/' | awk '{ gsub(",", "", $1); printf "%d %s; ", $1 / 1024, $2 }'
  echo
  echo
  echo "== RAM: $(sh_ cat /proc/meminfo | awk '/MemTotal|MemAvailable/ { printf "%s %d MB  ", $1, $2 / 1024 }')"
  echo "== BO NHO: $(df -Pk "$HOME" | awk 'NR==2 { printf "trong %d MB", $4 / 1024 }')"
} | tee "$HOME/goi-box.txt"
