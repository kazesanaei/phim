#!/usr/bin/env bash
# Đóng gói bản gọn chạy trên TV box (Termux). Chạy ở gốc dự án SAU `npm ci && npm run build`:
#   bash tv-box/dong-goi.sh <thư-mục-ra-rỗng>
# Ra: <thư-mục-ra>/phim-tv-box.tar.gz (~25 MB nén, ~130 MB giải nén).
#
# Vì sao phải gọn: Chromecast with Google TV chỉ có 8 GB, nhà bố mẹ còn trống ~1,1 GB.
# Đo 28/10/2026: node_modules chỉ gói chạy là 253 MB, bỏ phần dưới còn 109 MB, máy chủ vẫn chạy đủ trang.
#   - *.map: chỉ để gỡ lỗi
#   - next-server/*.dev.js: bản cho `next dev`, server.mjs chạy dev:false nên không bao giờ nạp
#   - next/dist/docs: tài liệu
#   - hls.js: đã gói vào .next/static (trình duyệt) và chunk máy chủ, lúc chạy không require tới
set -euo pipefail
GOC=$(cd "$(dirname "$0")/.." && pwd)
RA=${1:?thiếu thư mục ra}
[ -f "$GOC/.next/BUILD_ID" ] || { echo "Chưa build: npm run build"; exit 1; }
mkdir -p "$RA"
[ -z "$(ls -A "$RA")" ] || { echo "$RA phải rỗng"; exit 1; }
D=$RA/phim
mkdir "$D"

tar -cf - -C "$GOC" --exclude=./node_modules --exclude=./.git --exclude=./.github --exclude=./tv-box \
  --exclude=./du-lieu --exclude=./.next/cache --exclude=./.next/trace --exclude=./.next/trace-build \
  --exclude=./.next/diagnostics --exclude='*.map' --exclude=./tsconfig.tsbuildinfo . | tar -xf - -C "$D"

cd "$D"
# Box không có SWC native để biên dịch next.config.ts: đổi sang JS thuần (giống day-len-box.sh của tvbox-phim)
sed -e "/^import type { NextConfig }/d" -e "s/^const nextConfig: NextConfig = {/const nextConfig = {/" next.config.ts > next.config.mjs
rm next.config.ts
node --check next.config.mjs

# Không có gói native nào: cài trên máy x64 rồi chép sang ARM vẫn chạy
npm ci --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund
find node_modules -name '*.map' -delete
rm -f node_modules/next/dist/compiled/next-server/*.dev.js
rm -rf node_modules/next/dist/docs node_modules/hls.js

tar -czf "$RA/phim-tv-box.tar.gz" -C "$RA" phim
echo "BUILD_ID $(cat .next/BUILD_ID), $(du -sh "$D" | cut -f1) giải nén, $(du -h "$RA/phim-tv-box.tar.gz" | cut -f1) nén"
