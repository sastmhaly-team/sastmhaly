@echo off
chcp 65001 >nul
title سستمهالي - نقاط البيع (تطبيق سطح المكتب المحلي)
cd /d "%~dp0"

set "APP_EXE=%LOCALAPPDATA%\SastmhalyPOS\Sastmhaly_POS.exe"
if exist "%APP_EXE%" (
  start "" "%APP_EXE%"
  exit /b
)

if exist "%~dp0Sastmhaly-POS-Setup.exe" (
  start "" "%~dp0Sastmhaly-POS-Setup.exe"
  exit /b
)

if exist "%~dp0Sastmhaly-Store-Setup.exe" (
  start "" "%~dp0Sastmhaly-Store-Setup.exe"
  exit /b
)
