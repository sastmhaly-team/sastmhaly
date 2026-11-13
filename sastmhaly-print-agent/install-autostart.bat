@echo off
setlocal EnableDelayedExpansion
title Sastmhaly Print Agent - Installer

REM =========================================================
REM  Sastmhaly Print Agent - Installer
REM  Run as Administrator (Right-click -> Run as Administrator)
REM =========================================================

REM Auto-elevate to Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting admin rights - click YES in the popup...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo.
echo =========================================================
echo   Sastmhaly Print Agent Installer
echo =========================================================
echo.
echo [1/4] Setting PowerShell policy...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope LocalMachine -Force; Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" >nul 2>&1
echo       Done.

echo [2/4] Registering port 18274...
netsh http add urlacl url=http://127.0.0.1:18274/ user=Everyone >nul 2>&1
netsh http add urlacl url=http://localhost:18274/ user=Everyone >nul 2>&1
echo       Done.

echo [3/4] Adding firewall rule...
netsh advfirewall firewall delete rule name="SastmhalyPrintAgent" >nul 2>&1
netsh advfirewall firewall add rule name="SastmhalyPrintAgent" dir=in action=allow protocol=TCP localport=18274 >nul 2>&1
echo       Done.

echo [4/4] Creating autostart...

set "PS1=%~dp0SastmhalyPrintAgent.ps1"
set "VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SastmhalyPrintAgent.vbs"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ps1='%PS1%'; $vbs='%VBS%'; $content = @('Set o = CreateObject(\"WScript.Shell\")', 'o.Run \"powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"\"' + $ps1 + '\"\"\"' + ', 0, False') -join \"`r`n\"; [System.IO.File]::WriteAllText($vbs, $content, [System.Text.Encoding]::ASCII)"

if exist "%VBS%" (
    echo       Done - autostart created.
) else (
    echo       WARNING - autostart not created, run start-agent.bat manually each time.
)

echo.
echo Starting agent now...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"%PS1%\"' -WindowStyle Hidden"

echo Waiting 6 seconds...
timeout /t 6 /nobreak >nul

netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo.
    echo =========================================================
    echo   SUCCESS! Agent is running on port 18274.
    echo   Open Sastmhaly and click any barcode button.
    echo   You will see a GREEN connected indicator.
    echo =========================================================
) else (
    echo.
    echo =========================================================
    echo   Agent not detected yet - may need a few more seconds.
    echo   Refresh the Sastmhaly page after 10 seconds.
    echo   Error log: %TEMP%\SastmhalyPrintAgent.log
    echo =========================================================
)
echo.
pause
endlocal
