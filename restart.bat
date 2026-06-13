@echo off
setlocal
cd /d "%~dp0"

echo.
echo [rehearsals] Restarting app (web + SQLite API)...
echo.

echo Stopping processes on ports 3000, 3003 and 3001...
for %%A in (3000 3003 3001) do (
  for /f "tokens=5" %%P in ('netstat -aon ^| findstr /R /C:":%%A .*LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1
  )
)

timeout /t 1 /nobreak >nul

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
