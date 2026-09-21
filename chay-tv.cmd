@echo off
rem Mo trang phim ra mang LAN de xem tren TV Box.
rem Chay server.mjs chu khong phai `next start`, vi trinh duyet TV ep https
rem con `next start` chi noi http (loi ERR_SSL_PROTOCOL_ERROR).
cd /d "%~dp0"

echo ============================================================
echo   MO RA MANG WIFI TRONG NHA
echo ============================================================
echo.
echo   Moi may trong wifi se vao duoc trang nay, KE CA trang
echo   Quan tri. Neu chua dat mat khau thi vao Quan tri ^> muc
echo   "Xem tren TV Box" dat truoc, chi phai lam mot lan.
echo.
echo   Lan chay dau Windows se hoi mo tuong lua - bam Allow.
echo.
pause

if not exist ".next\BUILD_ID" call npm run build

echo.
echo   Tren TV go dia chi http o duoi. Neu trinh duyet tu doi sang
echo   https va bao loi SSL thi go dia chi https du phong, bam
echo   "Nang cao" roi "Tiep tuc".
echo.
echo   Dong cua so nay la tat server.
echo ============================================================

node server.mjs --lan
echo.
echo Server da dung.
pause
