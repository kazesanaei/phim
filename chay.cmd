@echo off
rem Bam dup de mo trang phim. Dung npm.cmd vi PowerShell chan npm.ps1.
cd /d "%~dp0"
if not exist ".next\BUILD_ID" call npm run build
start "" cmd /c "timeout /t 4 /nobreak >nul & start "" http://127.0.0.1:3000"
call npm start
echo.
echo Server da dung. Dong cua so nay duoc.
pause
