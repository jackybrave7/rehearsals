@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo [rehearsals] Запуск приложения (web + SQLite API)...
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Ошибка: Node.js не найден. Установите Node.js с https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Установка зависимостей...
  call npm install
  if errorlevel 1 (
    echo Ошибка: npm install не удался.
    pause
    exit /b 1
  )
  echo.
)

echo   Web:     http://localhost:3003
echo   API:     http://localhost:3001  (обязателен для сохранения!)
echo   SQLite:  data\rehearsals.db
echo   Backup:  data\backups\
echo.
echo Важно: нужны ОБА процесса (web + api). Без API данные только в браузере.
echo Для остановки нажмите Ctrl+C
echo.

npm run dev

endlocal
