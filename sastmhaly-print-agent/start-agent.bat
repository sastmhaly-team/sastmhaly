@echo off
chcp 65001 >nul
title سستمهالي - مساعد الطباعة المباشرة
cd /d "%~dp0"

echo ========================================================
echo    سستمهالي - تشغيل مساعد الطباعة المباشرة (Print Agent)
echo ========================================================
echo.

:: Check if already running on port 18274
netstat -ano | findstr :18274 >nul
if %errorlevel% equ 0 (
    echo [✓] مساعد الطباعة يعمل بالفعل في الخلفية على جهازك!
    echo يمكنك البدء بالطباعة مباشرة من المتصفح الآن.
    timeout /t 3 >nul
    exit /b
)

echo جاري تشغيل مساعد الطباعة في الخلفية...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0SastmhalyPrintAgent.ps1"

pause

