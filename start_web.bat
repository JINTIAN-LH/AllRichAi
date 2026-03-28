@echo off
setlocal

cd /d "%~dp0"

set "MODE=run"
set "OPEN_BROWSER=1"
set "DEV_MODE=1"
set "START_PATH=/story-panel"
set "WEB_HOST=127.0.0.1"
if /I "%~1"=="--check" set "MODE=check"
if /I "%~1"=="--no-browser" set "OPEN_BROWSER=0"
if /I "%~1"=="--prod" set "DEV_MODE=0"
if /I "%~1"=="--home" set "START_PATH=/"
if /I "%~1"=="--panel" set "START_PATH=/story-panel"
if /I "%~1"=="--lan" set "WEB_HOST=0.0.0.0"
if /I "%~2"=="--no-browser" set "OPEN_BROWSER=0"
if /I "%~2"=="--prod" set "DEV_MODE=0"
if /I "%~2"=="--home" set "START_PATH=/"
if /I "%~2"=="--panel" set "START_PATH=/story-panel"
if /I "%~2"=="--lan" set "WEB_HOST=0.0.0.0"

echo [1/4] Checking Python virtual environment...
if not exist ".venv\Scripts\python.exe" (
  echo     .venv not found, creating one...
  where py >nul 2>nul
  if %ERRORLEVEL%==0 (
    py -3 -m venv .venv
  ) else (
    python -m venv .venv
  )
  if not %ERRORLEVEL%==0 (
    echo Failed to create virtual environment.
    exit /b 1
  )
)

set "PYTHON_EXE=.venv\Scripts\python.exe"

echo [2/4] Upgrading pip...
"%PYTHON_EXE%" -m pip install --upgrade pip >nul
if not %ERRORLEVEL%==0 (
  echo Failed to upgrade pip.
  exit /b 1
)

echo [3/4] Installing web dependencies...
"%PYTHON_EXE%" -m pip install flask >nul
if not %ERRORLEVEL%==0 (
  echo Failed to install dependencies.
  exit /b 1
)

set "WEB_PORT="
for /f %%p in ('"%PYTHON_EXE%" run_web.py --print-port') do set "WEB_PORT=%%p"
if not defined WEB_PORT set "WEB_PORT=5000"

if /I "%MODE%"=="check" (
  echo [4/4] Check complete. Environment is ready.
  exit /b 0
)

set "ALLRICHAI_WEB_HOST=%WEB_HOST%"

echo [4/5] Checking existing server on port %WEB_PORT%...
set "PORT_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%WEB_PORT% .*LISTENING"') do (
  set "PORT_PID=%%p"
  goto :found_pid
)

:found_pid
if defined PORT_PID (
  echo     Found old process PID %PORT_PID%, stopping it for hot-restart...
  taskkill /PID %PORT_PID% /F >nul 2>nul
)

set "OPEN_URL=http://127.0.0.1:%WEB_PORT%%START_PATH%"
if /I "%WEB_HOST%"=="0.0.0.0" (
  for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object {$_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1'} ^| Select-Object -First 1 -ExpandProperty IPAddress)"') do set "LAN_IP=%%i"
  if defined LAN_IP (
    echo [5/5] Starting web server for LAN access on http://%LAN_IP%:%WEB_PORT%%START_PATH%
    echo     Phone access URL: http://%LAN_IP%:%WEB_PORT%%START_PATH%
  ) else (
    echo [5/5] Starting web server for LAN access on http://0.0.0.0:%WEB_PORT%%START_PATH%
    echo     Phone access URL: use your PC LAN IP + :%WEB_PORT%
  )
) else (
  echo [5/5] Starting web server on %OPEN_URL%
)
if "%OPEN_BROWSER%"=="1" start "" "%OPEN_URL%"
if "%DEV_MODE%"=="1" (
  echo     Dev mode: ON (hot-reload enabled)
  "%PYTHON_EXE%" run_web.py --dev
) else (
  echo     Dev mode: OFF (production-like run)
  "%PYTHON_EXE%" run_web.py
)
