@echo off
setlocal
cd /d "%~dp0"

set "SSH_KEY=%USERPROFILE%\.ssh\rehearsals_vps"
set "SSH_HOST=root@45.153.71.162"
set "REMOTE_DIR=/var/www/rehearsals"
set "REMOTE_SCRIPT=/tmp/rehearsals-deploy.sh"
set "SSH_BIN=%SystemRoot%\System32\OpenSSH\ssh.exe"
set "SCP_BIN=%SystemRoot%\System32\OpenSSH\scp.exe"

echo.
echo [rehearsals] Deploy to VPS...
echo   Server:  %SSH_HOST%
echo   Path:    %REMOTE_DIR%
echo.
echo Server steps: git pull, npm build, docker restart
echo Push your commits first: git push
echo.

if not exist "%SSH_BIN%" (
  echo ERROR: OpenSSH not found: %SSH_BIN%
  pause
  exit /b 1
)

if not exist "%SCP_BIN%" (
  echo ERROR: OpenSSH scp not found: %SCP_BIN%
  pause
  exit /b 1
)

if not exist "%SSH_KEY%" (
  echo ERROR: SSH key not found: %SSH_KEY%
  echo See deploy\README.md
  pause
  exit /b 1
)

if not exist "deploy\remote-deploy.sh" (
  echo ERROR: deploy\remote-deploy.sh not found
  pause
  exit /b 1
)

echo Uploading deploy script...
"%SCP_BIN%" -i "%SSH_KEY%" -o StrictHostKeyChecking=accept-new "deploy\remote-deploy.sh" %SSH_HOST%:%REMOTE_SCRIPT%
if errorlevel 1 (
  echo ERROR: scp failed
  pause
  exit /b 1
)

echo Running deploy on server...
echo.
"%SSH_BIN%" -i "%SSH_KEY%" -o StrictHostKeyChecking=accept-new %SSH_HOST% "tr -d '\r' < %REMOTE_SCRIPT% | bash -l -s"

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo [rehearsals] Deploy OK: https://rehears.ru
) else (
  echo [rehearsals] Deploy failed with code %EXIT_CODE%.
  pause
)

endlocal
exit /b %EXIT_CODE%
