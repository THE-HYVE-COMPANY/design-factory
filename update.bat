@echo off
REM Design Factory - update
REM Windows: double-click this file.
REM Pulls the latest version from GitHub and refreshes dependencies.

cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is required to update. Install it from https://git-scm.com and run this again.
  pause
  exit /b 1
)

echo Updating Design Factory...
call git pull
call npm install
echo Done. Open start to launch the app.
pause
