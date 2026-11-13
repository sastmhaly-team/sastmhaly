@echo off
chcp 65001 >nul
title تثبيت التشغيل التلقائي مع الويندوز
cd /d "%~dp0"

echo ========================================================
echo   تثبيت مساعد طباعة سستمهالي للتشغيل التلقائي مع الويندوز
echo ========================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\SastmhalyPrintAgent.vbs"

echo جاري إنشاء ملف التشغيل الصامت في بدء التشغيل...

(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run "powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File ""%~dp0SastmhalyPrintAgent.ps1""", 0, False
) > "%SHORTCUT_PATH%"

echo.
echo [✓] تم التثبيت بنجاح!
echo سيعمل مساعد طباعة سستمهالي تلقائياً وبشكل صامت في الخلفية عند كل تشغيل للكمبيوتر.
echo.
echo جاري تشغيله الآن للمرة الأولى...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0SastmhalyPrintAgent.ps1"

