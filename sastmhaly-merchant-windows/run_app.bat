@echo off
setlocal
cd /d "%~dp0"

:: Start Node.js background engine if not running on port 4567
netstat -ano | findstr :4567 >nul
if %errorlevel% neq 0 (
  start "" /b "%~dp0node.exe" "%~dp0server.js"
  timeout /t 1 /nobreak >nul
)

:: Try opening Microsoft Edge in standalone App Mode (isolated native window without browser address bar)
set "EDGE_PATH=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE_PATH%" set "EDGE_PATH=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE_PATH%" set "EDGE_PATH=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE_PATH%" (
  start "" "%EDGE_PATH%" --app=http://127.0.0.1:4567 --window-size=1280,820
  exit /b
)

:: Fallback to Google Chrome in standalone App Mode
set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME_PATH%" (
  start "" "%CHROME_PATH%" --app=http://127.0.0.1:4567 --window-size=1280,820
  exit /b
)

:: Fallback to default browser
start http://127.0.0.1:4567
exit /b

