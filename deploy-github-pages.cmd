@echo off
rem เรียกใช้งานไฟล์นี้จากโฟลเดอร์โปรเจคหลัก
cd /d %~dp0

rem ตรวจสอบว่ามี git หรือไม่
git --version >nul 2>&1
if errorlevel 1 (
  echo Git ไม่พบในระบบ กรุณาติดตั้ง Git และลองใหม่
  pause
  exit /b 1
)

if not exist .git (
  git init
  git add .
  git commit -m "Initial commit for LamthongBBQ stock app"
) else (
  git add .
  git commit -m "Update LamthongBBQ stock app"
)

git branch -M main

echo.
echo เปลี่ยน URL ด้านล่างเป็น GitHub repo ของคุณก่อน push
echo https://github.com/<username>/lamthongbbq.github.io.git
echo.
if "%1"=="" (
  echo ใช้งานไฟล์นี้ด้วยคำสั่ง: deploy-github-pages.cmd <username>
  echo ตัวอย่าง: deploy-github-pages.cmd mygithubname
  pause
  exit /b 1
)

set REMOTEURL=https://github.com/%1/lamthongbbq.github.io.git
git remote remove origin 2>nul
git remote add origin %REMOTEURL%
git push -u origin main
pause
