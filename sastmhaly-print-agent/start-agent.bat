@echo off
setlocal
title Sastmhaly Print Agent - Start

cd /d "%~dp0"
set "PS1=%~dp0SastmhalyPrintAgent.ps1"

REM Check already running
netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo.
    echo [OK] Agent already running on port 18274. Ready to print!
    echo.
    pause
    exit /b 0
)

if not exist "%PS1%" (
    echo [ERROR] Cannot find: %PS1%
    echo Make sure all files are in the same folder.
    pause
    exit /b 1
)

echo.
echo =========================================================
echo   Sastmhaly Print Agent - Starting...
echo =========================================================
echo.

REM Launch PowerShell hidden directly (no VBS needed with Start-Process)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"%PS1%\"' -WindowStyle Hidden"

echo Waiting 6 seconds...
timeout /t 6 /nobreak >nul

netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Agent is running on port 18274!
    echo   Open Sastmhaly and click the barcode button.
    echo   You will see a GREEN connected indicator.
) else (
    echo.
    echo [NOTE] Agent not detected on port 18274.
    echo.
    echo   FIRST TIME? Run install-autostart.bat as Administrator first:
    echo   Right-click install-autostart.bat - Run as Administrator
    echo.
    echo   Error log: %TEMP%\SastmhalyPrintAgent.log
)
echo.
pause
endlocal
