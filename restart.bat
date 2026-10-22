@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ============================================================
echo   REHEARSALS - перезапуск
echo ============================================================
echo.

echo Освобождаю порты 3000, 3003 и 3001...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-dev-ports.ps1"
if errorlevel 1 (
  echo.
  echo Не удалось освободить порты. Закройте другие терминалы или завершите node вручную.
  pause
  exit /b 1
)

echo.
echo   Web     http://localhost:3003
echo   API     http://localhost:3001   - без API данные не сохраняются в SQLite
echo   База    data\rehearsals.db
echo.
echo   Дождитесь строки: [api] http://localhost:3001
echo   Остановка: Ctrl+C
echo.

call npm run dev

endlocal
