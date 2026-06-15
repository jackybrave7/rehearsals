@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "SSH_KEY=%USERPROFILE%\.ssh\rehearsals_vps"
set "SSH_HOST=root@45.153.71.162"

echo.
echo [rehearsals] SSH на VPS...
echo   Сервер:  %SSH_HOST%
echo   Ключ:    %SSH_KEY%
echo   Проект:  /var/www/rehearsals
echo.

set "SSH_BIN=%SystemRoot%\System32\OpenSSH\ssh.exe"

if not exist "%SSH_BIN%" (
  echo Ошибка: OpenSSH не найден: %SSH_BIN%
  pause
  exit /b 1
)

if not exist "%SSH_KEY%" (
  echo Ошибка: ключ не найден: %SSH_KEY%
  pause
  exit /b 1
)

"%SSH_BIN%" -i "%SSH_KEY%" -o StrictHostKeyChecking=accept-new %SSH_HOST% -t "cd /var/www/rehearsals && exec bash -l"

set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo SSH завершился с кодом %EXIT_CODE%.
  pause
)

endlocal
exit /b %EXIT_CODE%
