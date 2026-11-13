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
echo   Sastmhaly Print Agent - Starting (VISIBLE mode)
echo   This window will stay open to show any errors.
echo =========================================================
echo.
echo PS1: %PS1%
echo.

REM Run VISIBLE so errors are shown directly in this window
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%PS1%"

echo.
echo =========================================================
echo   Agent stopped or crashed. See error above.
echo =========================================================
pause
endlocal
