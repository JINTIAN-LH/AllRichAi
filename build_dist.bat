@echo off
setlocal

cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" build_dist.py %*
) else (
  python build_dist.py %*
)

if errorlevel 1 (
  echo Build failed.
  exit /b 1
)

echo Build succeeded.
