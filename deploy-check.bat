@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "SSH_KEY=%USERPROFILE%\.ssh\rehearsals_vps"
set "SSH_HOST=root@45.153.71.162"
set "SSH_PORT=22"
set "SSH_BIN=%SystemRoot%\System32\OpenSSH\ssh.exe"

if exist "deploy\deploy.local.bat" call "deploy\deploy.local.bat"

for /f "tokens=2 delims=@" %%I in ("%SSH_HOST%") do set "SSH_IP=%%I"
if not defined SSH_IP set "SSH_IP=%SSH_HOST%"

echo.
echo [rehearsals] Deploy connectivity check
echo   Host: %SSH_HOST%
echo   Port: %SSH_PORT%
echo   IP:   %SSH_IP%
echo.

if not exist "%SSH_KEY%" (
  echo FAIL: SSH key not found: %SSH_KEY%
  goto done
)

echo [1/3] Ping...
ping -n 1 -w 3000 %SSH_IP% | findstr /i "TTL=" >nul
if errorlevel 1 (
  echo       FAIL: host does not respond to ping
) else (
  echo       OK
)

echo [2/3] TCP port %SSH_PORT%...
powershell -NoProfile -Command "$r = Test-NetConnection -ComputerName '%SSH_IP%' -Port %SSH_PORT% -WarningAction SilentlyContinue; if ($r.TcpTestSucceeded) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo       FAIL: port %SSH_PORT% is closed or filtered
) else (
  echo       OK
)

echo [3/3] SSH handshake...
"%SSH_BIN%" -i "%SSH_KEY%" -p %SSH_PORT% -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new %SSH_HOST% "echo ok" >nul 2>&1
if errorlevel 1 (
  echo       FAIL: SSH did not accept the key / connection
) else (
  echo       OK
)

echo.
echo If step 2 or 3 failed, deploy.bat cannot work from this PC right now.
echo The VPS may be stopped, firewalled, or sshd is down.
echo See deploy\README.md section "Connection timed out".
echo.

:done
pause
endlocal
