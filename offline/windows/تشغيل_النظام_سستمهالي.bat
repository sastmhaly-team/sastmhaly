@echo off
chcp 65001 > nul
title سستمهالي - Sastmhaly Desktop POS (Offline)
echo ====================================================
echo        جاري تشغيل سستمهالي - النسخة المكتبية الأوفلاين
echo ====================================================
set OFFLINE_MODE=true
set DATABASE_MODE=sqlite
set PORT=3456
start "" http://localhost:3456/merchant/pos
npm run dev -- -p 3456
pause
