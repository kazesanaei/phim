@echo off
rem Xem phim tu xa qua Tailscale - chi thiet bi dang nhap CUNG tai khoan
rem Tailscale moi vao duoc, nguoi ngoai khong thay trang.
rem
rem App van chi nghe 127.0.0.1 (khong mo ra wifi). "tailscale serve" nhan
rem HTTPS o dia chi rieng https://<ten-may>.<tailnet>.ts.net roi chuyen vao.
rem
rem TUYET DOI KHONG dung "tailscale funnel": funnel mo ra CA INTERNET.
rem Chi tiet: CAI-DAT.md, muc "Xem tu xa bang Tailscale".
rem
rem CHI chay tren may CA NHAN. Khong chay tren laptop cong ty: cai phan mem
rem mo duong vao tu xa thuong trai quy dinh IT (xem CAI-DAT.md).
rem
rem Khong dung nhan goto: kho luu file nay bang LF (.gitattributes), cmd.exe
rem doc nhan voi LF hay nhay sai cho.
cd /d "%~dp0"

echo ============================================================
echo   XEM PHIM TU XA QUA TAILSCALE
echo ============================================================
echo.

where tailscale >nul 2>nul
if errorlevel 1 (
  echo   [THIEU] Chua cai Tailscale.
  echo   Tai o https://tailscale.com/download , cai xong dang nhap
  echo   roi bam dup lai file nay.
  echo.
  pause
  exit /b 1
)

tailscale status >nul 2>nul
if errorlevel 1 (
  echo   [CHUA DANG NHAP] Mo trinh duyet de dang nhap Tailscale...
  tailscale up
)
tailscale status >nul 2>nul
if errorlevel 1 (
  echo   [LOI] Van chua dang nhap duoc Tailscale. Mo app Tailscale tren
  echo   khay he thong, dang nhap, roi chay lai file nay.
  echo.
  pause
  exit /b 1
)
echo   [OK] Tailscale

rem Qua Tailscale, voi app moi yeu cau deu "tu chinh may nay" (127.0.0.1),
rem nen BAT BUOC co mat khau lam lop bao ve thu hai.
node scripts\dat-mat-khau.mjs --kiem
if errorlevel 1 (
  echo.
  echo   Xem tu xa BAT BUOC co mat khau. Dat mot lan, moi may nho 1 nam.
  node scripts\dat-mat-khau.mjs --hoi
)
node scripts\dat-mat-khau.mjs --kiem
if errorlevel 1 (
  echo   [LOI] Chua dat duoc mat khau. Chay lai file nay de thu lai.
  echo.
  pause
  exit /b 1
)
echo   [OK] Mat khau

if not exist ".next\BUILD_ID" call npm run build

rem --bg: chay nen, giu ca sau khi khoi dong lai may. Tat han: tailscale serve reset
tailscale serve --bg 3000
if errorlevel 1 (
  echo.
  echo   [LOI] "tailscale serve" khong chay duoc. Thuong do chua bat
  echo   MagicDNS va HTTPS Certificates: vao https://login.tailscale.com/admin/dns
  echo   bat ca hai, roi chay lai file nay.
  echo.
  pause
  exit /b 1
)

echo.
echo   Tren dien thoai / laptop khac / TV Box: cai app Tailscale, dang
echo   nhap CUNG tai khoan, roi mo trinh duyet vao:
echo.
tailscale status --json | node -e "let t='';process.stdin.on('data',d=>t+=d).on('end',()=>{try{const n=JSON.parse(t).Self.DNSName.replace(/\.$/,'');console.log('      https://'+n)}catch{console.log('      (xem dia chi bang lenh: tailscale serve status)')}})"
echo.
echo   May nay PHAI bat thi link moi song. Dong cua so nay la tat app.
echo ============================================================
echo.

call npm start
echo.
echo   Server da dung. Link tu xa bao loi 502 cho toi khi chay lai file nay.
pause
