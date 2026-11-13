@echo off
chcp 65001 >nul 2>&1
title سستمهالي - تثبيت مساعد الطباعة

REM =========================================================================
REM  Sastmhaly Print Agent Installer
REM  يجب تشغيل هذا الملف كـ "مسؤول" (Run as Administrator) لأول مرة فقط
REM =========================================================================

REM Auto-elevate to Administrator (UAC prompt appears once only)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [!] يحتاج هذا البرنامج صلاحيات المسؤول لتسجيل المنفذ.
    echo     سيظهر لك نافذة "هل تسمح لهذا التطبيق..." - اضغط "نعم"
    echo.
    timeout /t 2 /nobreak >nul
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
set "PS1_PATH=%~dp0SastmhalyPrintAgent.ps1"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_PATH=%STARTUP_FOLDER%\SastmhalyPrintAgent.vbs"

echo.
echo =========================================================
echo   سستمهالي - تثبيت مساعد الطباعة المباشرة
echo =========================================================
echo.

REM --- Step 1: Set PowerShell execution policy ---
echo [1/4] ضبط صلاحيات PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope LocalMachine -Force" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" >nul 2>&1
echo       [OK] تم.

REM --- Step 2: Register URL ACL for port 18274 (required for HttpListener) ---
echo [2/4] تسجيل المنفذ 18274 في الشبكة المحلية...
netsh http add urlacl url=http://127.0.0.1:18274/ user=Everyone >nul 2>&1
netsh http add urlacl url=http://localhost:18274/ user=Everyone >nul 2>&1
echo       [OK] تم تسجيل المنفذ.

REM --- Step 3: Add Windows Firewall rule (inbound) ---
echo [3/4] اضافة قاعدة جدار الحماية...
netsh advfirewall firewall delete rule name="SastmhalyPrintAgent" >nul 2>&1
netsh advfirewall firewall add rule name="SastmhalyPrintAgent" dir=in action=allow protocol=TCP localport=18274 description="Sastmhaly Print Agent local HTTP" >nul 2>&1
echo       [OK] تم.

REM --- Step 4: Create VBS autostart launcher ---
echo [4/4] انشاء التشغيل التلقائي مع الويندوز...

REM Write VBS file using PowerShell to avoid BAT quoting nightmares
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$vbs = 'Set WshShell = CreateObject(""WScript.Shell"")' + [char]13 + [char]10 + 'WshShell.Run ""powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"\"' + '%PS1_PATH%' + '\"\"""' + ', 0, False'; Set-Content -Path '%VBS_PATH%' -Value $vbs -Encoding UTF8"

if exist "%VBS_PATH%" (
    echo       [OK] تم انشاء التشغيل التلقائي.
) else (
    echo       [!] تعذر انشاء التشغيل التلقائي - ستحتاج لتشغيل start-agent.bat يدوياً.
)

echo.
echo =========================================================
echo [تم] اكتمل التثبيت!
echo.
echo جاري تشغيل المساعد الان...
echo =========================================================
echo.

REM --- Start agent immediately (hidden) ---
if exist "%VBS_PATH%" (
    start "" wscript.exe "%VBS_PATH%"
) else (
    start "" powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "%PS1_PATH%"
)

timeout /t 4 /nobreak >nul

REM --- Verify it started ---
netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo [تم] المساعد يعمل الان على المنفذ 18274!
    echo.
    echo افتح موقع سستمهالي في المتصفح واضغط زر الباركود.
    echo ستجد المساعد متصلاً بلون اخضر.
) else (
    echo [!] المساعد لم يبدأ بعد في خلال 4 ثوان.
    echo     قد يحتاج وقتاً اطول - انتظر 10 ثوان ثم اضغط تحديث في المتصفح.
    echo.
    echo     لو لا زال لا يعمل: اضغط مرتين على "start-agent.bat"
)

echo.
echo سجل الاخطاء (ان وجدت): %TEMP%\SastmhalyPrintAgent.log
echo.
pause
