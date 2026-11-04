@echo off
chcp 65001 >nul
title سستمهالي - نقاط البيع
cd /d "%~dp0"
set "OFFLINE_MODE=true"
set "DATABASE_MODE=sqlite"
set "IS_OFFLINE_BUNDLE=true"
set "NEXT_PUBLIC_OFFLINE_MODE=true"
set "PORT=3456"
start "" wscript.exe "%~dp0run_app.vbs"
