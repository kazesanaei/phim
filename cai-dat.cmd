@echo off
rem ============================================================
rem  Cai dat lan dau sau khi clone ve mot may moi.
rem
rem  Bam dup la xong: kiem Node, cai goi, dung san kho dem
rem  18.719 phim, build roi mo trang.
rem
rem  Chay lai nhieu lan khong sao - no bo qua nhung buoc da lam
rem  va KHONG BAO GIO de len du-lieu\phim.db (lich su xem nam o do).
rem
rem  Dung npm.cmd chu khong npm.ps1 vi PowerShell chan script.
rem ============================================================
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   KHO PHIM - CAI DAT LAN DAU
echo ============================================================
echo.

rem ---------- 1. Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
  echo   [THIEU] Khong tim thay Node.js.
  echo.
  echo   Tai ban LTS o https://nodejs.org roi chay lai file nay.
  echo   Nho dong cua so nay truoc khi cai, de PATH duoc nap lai.
  echo.
  pause
  exit /b 1
)

rem node -v in ra dang v24.19.0 - cat lay so dau tien.
for /f "tokens=1 delims=." %%v in ('node -v') do set "MAJOR=%%v"
set "MAJOR=%MAJOR:v=%"
rem Phien ban la dang khong doc duoc thi dung chan duong - de app tu bao loi
rem con ro rang hon la bat nguoi dung sua mot con so may khong hieu.
if not defined MAJOR goto :bo_qua_ban
if %MAJOR% LSS 22 (
  echo   [CU QUA] Dang co Node %MAJOR%, can tu 22 tro len.
  echo.
  echo   App doc SQLite bang module node:sqlite co san trong Node,
  echo   ban cu khong co module do nen chay la loi ngay.
  echo   Nang cap o https://nodejs.org roi chay lai file nay.
  echo.
  pause
  exit /b 1
)
:bo_qua_ban
echo   [OK] Node.js
node -v

rem ---------- 2. ffmpeg (co thi tot, khong co van chay) ----------
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo   [THIEU] ffmpeg - app van chay, nhung mat: tai phim ve,
  echo           phat file .mkv codec la, anh xem truoc khi tua,
  echo           va thu nho poster. Cai bang:
  echo               winget install Gyan.FFmpeg
) else (
  echo   [OK] ffmpeg
)

rem ---------- 3. Cai goi ----------
echo.
echo   Dang cai cac goi phu thuoc...
call npm install
if errorlevel 1 (
  echo.
  echo   [LOI] npm install that bai. Thuong la do mang.
  echo   Thu lai, hoac chay "npm install" trong cua so nay de xem loi day du.
  echo.
  pause
  exit /b 1
)
echo   [OK] Da cai xong goi

rem ---------- 4. Kho dem metadata dung san ----------
rem Giai nen chi khi CHUA co du-lieu\phim.db. De len la mat lich su xem,
rem yeu thich, moc intro va mat khau LAN - khong co duong lay lai.
echo.
if exist "du-lieu\phim.db" (
  echo   [BO QUA] Da co du-lieu\phim.db - khong de len.
) else (
  if exist "kho-dem\kho-dem-18719-phim.zip" (
    echo   Dang dung kho dem 18.719 phim...
    if not exist "du-lieu" mkdir "du-lieu"
    rem tar cua Windows ^(bsdtar^) doc duoc zip. Zip chi co mot file:
    rem phim-kho-dem.db - doi ten thanh phim.db la dung cho.
    tar -xf "kho-dem\kho-dem-18719-phim.zip" -C "du-lieu"
    if exist "du-lieu\phim-kho-dem.db" (
      move /y "du-lieu\phim-kho-dem.db" "du-lieu\phim.db" >nul
      echo   [OK] Da co kho dem - khoi phai quet 45 phut
    ) else (
      echo   [BO QUA] Giai nen khong ra file mong doi.
      echo            Khong sao: vao Quan tri ^> Kho dem bam Bat dau quet.
    )
  ) else (
    echo   [BO QUA] Khong thay file kho dem.
    echo            Vao Quan tri ^> Kho dem bam Bat dau quet ^(~45 phut^).
  )
)

rem ---------- 5. Build ----------
echo.
if exist ".next\BUILD_ID" (
  echo   [BO QUA] Da co ban build san.
) else (
  echo   Dang build ^(lan dau mat vai phut^)...
  call npm run build
  if errorlevel 1 (
    echo.
    echo   [LOI] Build that bai. Xem thong bao loi o tren.
    echo.
    pause
    exit /b 1
  )
  echo   [OK] Build xong
)

rem ---------- 6. Chay ----------
echo.
echo ============================================================
echo   XONG. Dang mo http://127.0.0.1:3000
echo.
echo   Viec can lam tiep, chi mot lan:
echo     - Them kho phim tren o cung: Quan tri ^> Thu muc nguon,
echo       dan duong dan ^(vi du D:\Phim^) roi bam Them va Quet lai.
echo.
echo   Lan sau khong can file nay nua:
echo     chay.cmd      - xem tren chinh may nay
echo     chay-tv.cmd   - mo ra wifi de xem tren TV Box
echo.
echo   Dong cua so nay la tat server.
echo ============================================================
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul & start "" http://127.0.0.1:3000"
call npm start

echo.
echo Server da dung. Dong cua so nay duoc.
pause
