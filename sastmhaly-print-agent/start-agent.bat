@echo off
setlocal
title Sastmhaly Print Agent

cd /d "%~dp0"
set "PS1=%~dp0SastmhalyPrintAgent.ps1"

REM Check if already running on port 18274
netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo.
    echo =========================================================
    echo   [OK] Sastmhaly Print Agent is ALREADY RUNNING!
    echo   Port: 18274
    echo   Ready to print directly from Sastmhaly website.
    echo =========================================================
    echo.
    timeout /t 3 >nul
    exit /b 0
)

if not exist "%PS1%" (
    echo [ERROR] Cannot find: %PS1%
    pause
    exit /b 1
)

echo.
echo =========================================================
echo   Sastmhaly Print Agent - Starting in background...
echo =========================================================
echo.

REM Launch detached in background with Hidden window
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -ArgumentList '-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"%PS1%\"'"

echo Waiting 5 seconds...
timeout /t 5 /nobreak >nul

netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo.
    echo =========================================================
    echo   [SUCCESS] Print Agent is running in the background!
    echo   You can safely close this window now.
    echo   The agent will stay active for your print jobs.
    echo =========================================================
) else (
    echo.
    echo [NOTE] Agent is initializing... please check the website in a few seconds.
)

echo.
timeout /t 5
endlocal
