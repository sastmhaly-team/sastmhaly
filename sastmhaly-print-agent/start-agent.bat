@echo off
chcp 65001 >nul 2>&1
title سستمهالي - مساعد الطباعة المباشرة
cd /d "%~dp0"

echo.
echo =========================================================
echo   سستمهالي - تشغيل مساعد الطباعة المباشرة
echo   Sastmhaly Direct Print Agent v1.1
echo =========================================================
echo.

REM --- Check if already running ---
netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo [OK] المساعد يعمل بالفعل على المنفذ 18274.
    echo     يمكنك الطباعة مباشرة من المتصفح الان.
    echo.
    pause
    exit /b 0
)

set "PS1_PATH=%~dp0SastmhalyPrintAgent.ps1"

REM --- Launch PowerShell hidden via VBScript (truly no window) ---
set "VBS_TMP=%TEMP%\RunSastmhalyAgent_%RANDOM%.vbs"

echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_TMP%"
echo WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File ""%PS1_PATH%""", 0, False >> "%VBS_TMP%"

start "" wscript.exe "%VBS_TMP%"

echo جاري التشغيل... انتظر 5 ثوان.
echo.
timeout /t 5 /nobreak >nul

REM --- Confirm it started ---
netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo [تم] المساعد يعمل الان على المنفذ 18274!
    echo.
    echo     افتح موقع سستمهالي واضغط زر الباركود.
    echo     ستجد المساعد متصلاً بلون اخضر.
) else (
    echo [!] لم يبدأ المساعد بعد.
    echo.
    echo     *** الحل: ***
    echo     اذا لم يعمل من قبل، شغل "install-autostart.bat" اولاً
    echo     بالضغط بزر الماوس الايمن عليه واختيار "تشغيل كمسؤول"
    echo     (Run as Administrator)
    echo.
    echo     سجل الاخطاء: %TEMP%\SastmhalyPrintAgent.log
)
echo.
pause
