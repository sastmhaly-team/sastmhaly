@echo off
setlocal EnableDelayedExpansion
title Sastmhaly Print Agent - Installer

REM =========================================================
REM  Sastmhaly Print Agent - Installer v2.0
REM  Permanent Install & Windows Auto-Start on Boot
REM =========================================================

REM Auto-elevate to Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting admin rights - click YES in the popup...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
set "SRC_DIR=%~dp0"
set "INSTALL_DIR=%LOCALAPPDATA%\SastmhalyPrintAgent"

if not exist "%SRC_DIR%SastmhalyPrintAgent.ps1" (
    echo [ERROR] Cannot find SastmhalyPrintAgent.ps1
    echo Please make sure all files are extracted.
    pause
    exit /b 1
)

echo.
echo =========================================================
echo   Sastmhaly Print Agent - Permanent Installer v2.0
echo =========================================================
echo.

REM --- Step 1: Install to permanent location in AppData ---
echo [1/6] Installing agent files to: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1
copy /Y "%SRC_DIR%SastmhalyPrintAgent.ps1" "%INSTALL_DIR%\" >nul 2>&1
copy /Y "%SRC_DIR%silent-start.vbs" "%INSTALL_DIR%\" >nul 2>&1
echo       Done - files installed permanently.

REM --- Step 2: Set PowerShell policy ---
echo [2/6] Setting PowerShell execution policy...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy Bypass -Scope LocalMachine -Force; Set-ExecutionPolicy Bypass -Scope CurrentUser -Force" >nul 2>&1
echo       Done.

REM --- Step 3: Register URL ACL for port 18274 ---
echo [3/6] Registering local port 18274...
netsh http add urlacl url=http://127.0.0.1:18274/ user=Everyone >nul 2>&1
netsh http add urlacl url=http://localhost:18274/ user=Everyone >nul 2>&1
echo       Done.

REM --- Step 4: Firewall rule ---
echo [4/6] Adding Windows Firewall rule for port 18274...
netsh advfirewall firewall delete rule name="SastmhalyPrintAgent" >nul 2>&1
netsh advfirewall firewall add rule name="SastmhalyPrintAgent" dir=in action=allow protocol=TCP localport=18274 description="Sastmhaly Print Agent" >nul 2>&1
echo       Done.

REM --- Step 5: Configure Windows Auto-Start on Boot ---
echo [5/6] Setting up automatic start with Windows...

REM Method A: Windows Startup Folder (runs on every user login)
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_DIR%" (
    copy /Y "%INSTALL_DIR%\silent-start.vbs" "%STARTUP_DIR%\SastmhalyPrintAgent.vbs" >nul 2>&1
)

REM Method B: Windows Registry Run Key (system autostart)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "SastmhalyPrintAgent" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\silent-start.vbs\"" /f >nul 2>&1

REM Method C: Task Scheduler fallback
schtasks /delete /tn "SastmhalyPrintAgent" /f >nul 2>&1
schtasks /create /tn "SastmhalyPrintAgent" /tr "wscript.exe \"%INSTALL_DIR%\silent-start.vbs\"" /sc ONLOGON /f >nul 2>&1

echo       Done - Auto-start configured (Startup Folder + Registry + Task).

REM --- Step 6: Start agent immediately in background ---
echo [6/6] Starting print agent in background now...
start "" wscript.exe "%INSTALL_DIR%\silent-start.vbs"

echo Waiting 5 seconds for agent to start...
timeout /t 5 /nobreak >nul

netstat -ano 2>nul | findstr ":18274" >nul
if %errorlevel% equ 0 (
    echo.
    echo =========================================================
    echo   [SUCCESS] Sastmhaly Print Agent is ACTIVE on port 18274!
    echo.
    echo   - Installed permanently in: %INSTALL_DIR%
    echo   - Will automatically start every time Windows opens
    echo   - No black window, runs silently in the background
    echo.
    echo   You can close this window now and print directly from
    echo   the Sastmhaly website!
    echo =========================================================
) else (
    echo.
    echo =========================================================
    echo   Agent starting up... please check Sastmhaly website
    echo   in a few seconds. If not connected, run start-agent.bat
    echo =========================================================
)

echo.
pause
endlocal
