@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo [rehearsals] Restarting app (web + SQLite API)...
echo.

echo Stopping processes on ports 3000, 3003 and 3001...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-dev-ports.ps1"
if errorlevel 1 (
  echo.
  echo Failed to free dev ports. Close other terminals or kill node processes manually.
  pause
  exit /b 1
)

echo.
echo Starting npm run dev...
echo   Web:     http://localhost:3003
echo   API:     http://localhost:3001 (required for SQLite)
echo   SQLite:  data\rehearsals.db
echo   Backup:  data\backups\
echo.
echo Wait until you see: [api] http://localhost:3001
echo Press Ctrl+C to stop.
echo.

call npm run dev

endlocal
