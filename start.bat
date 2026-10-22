@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ============================================================
echo   REHEARSALS - локальный запуск
echo ============================================================
echo.
echo   Web     http://localhost:3003
echo   API     http://localhost:3001   - без API данные не сохраняются в SQLite
echo   База    data\rehearsals.db
echo   Бэкапы  data\backups\
echo.
echo   Команда npm run dev поднимает ОБА процесса: web и api.
echo   Дождитесь строки: [api] http://localhost:3001
echo   Пока api не поднялся, в браузере возможны ошибки /api - это нормально.
echo   Остановка: Ctrl+C в этом окне
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ОШИБКА: Node.js не найден. Установите с https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Установка зависимостей - npm install...
  call npm install
  if errorlevel 1 (
    echo ОШИБКА: npm install не удался.
    pause
    exit /b 1
  )
  echo.
)

call npm run dev

endlocal
