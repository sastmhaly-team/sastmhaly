@echo off
setlocal EnableDelayedExpansion
title Sastmhaly Print Agent - Installer

REM =========================================================
REM  Sastmhaly Print Agent - Installer v1.3
REM  Uses Windows Task Scheduler for 100% reliable launch
REM =========================================================

REM Auto-elevate to Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting admin rights - click YES in the popup...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
set "PS1=%~dp0SastmhalyPrintAgent.ps1"

if not exist "%PS1%" (
    echo [ERROR] File not found: %PS1%
    echo Make sure all agent files are in the same folder.
    pause
    exit /b 1
)

echo.
echo =========================================================
echo   Sastmhaly Print Agent Installer v1.3
echo =========================================================
echo.
echo Agent script: %PS1%
echo.

echo [1/5] Setting PowerShell policy...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy Bypass -Scope LocalMachine -Force; Set-ExecutionPolicy Bypass -Scope CurrentUser -Force" >nul 2>&1
echo       Done.

echo [2/5] Registering port 18274 (URL ACL)...
netsh http add urlacl url=http://127.0.0.1:18274/ user=Everyone >nul 2>&1
netsh http add urlacl url=http://localhost:18274/ user=Everyone >nul 2>&1
echo       Done.

echo [3/5] Adding firewall rule...
netsh advfirewall firewall delete rule name="SastmhalyPrintAgent" >nul 2>&1
netsh advfirewall firewall add rule name="SastmhalyPrintAgent" dir=in action=allow protocol=TCP localport=18274 >nul 2>&1
echo       Done.

echo [4/5] Creating scheduled task (autostart on login)...
schtasks /delete /tn "SastmhalyPrintAgent" /f >nul 2>&1
schtasks /create /tn "SastmhalyPrintAgent" /tr "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"%PS1%\"" /sc ONLOGON /ru "%USERNAME%" /rl HIGHEST /f >nul 2>&1
if %errorlevel% equ 0 (
    echo       Done - task created, will run on every login automatically.
) else (
    echo       WARNING - could not create scheduled task.
)

echo [5/5] Starting agent via Task Scheduler now...
schtasks /run /tn "SastmhalyPrintAgent" >nul 2>&1
if %errorlevel% equ 0 (
    echo       Task started.
) else (
    echo       Task run via scheduler failed, trying direct launch...
    start "" powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "%PS1%"
)

echo.
echo Waiting 8 seconds for agent to initialize...
timeout /t 8 /nobreak >nul

echo.
netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo =========================================================
    echo   SUCCESS! Agent is running on port 18274.
    echo.
    echo   Open Sastmhaly in your browser.
    echo   Click any barcode button - you will see GREEN indicator.
    echo   The agent will auto-start every time you log in to Windows.
    echo =========================================================
) else (
    echo =========================================================
    echo   Agent not detected on port 18274 yet.
    echo.
    echo   Checking error log...
    echo.
    if exist "%TEMP%\SastmhalyPrintAgent.log" (
        echo --- Last 20 lines of error log ---
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content '%TEMP%\SastmhalyPrintAgent.log' -Tail 20 -ErrorAction SilentlyContinue"
        echo ---
    ) else (
        echo   No log file found - agent did not start at all.
        echo   PS1 path: %PS1%
    )
    echo.
    echo   Try running start-agent.bat to see the error directly.
    echo =========================================================
)

echo.
pause
endlocal
