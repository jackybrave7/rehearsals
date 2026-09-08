@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "SSH_KEY=%USERPROFILE%\.ssh\rehearsals_vps"
set "SSH_HOST=root@45.153.71.162"
set "SSH_PORT=22"
set "SSH_BIN=%SystemRoot%\System32\OpenSSH\ssh.exe"

if exist "deploy\deploy.local.bat" call "deploy\deploy.local.bat"
call "deploy\ssh-options.bat"

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

echo [3/3] SSH login (max 25 sec, no GSSAPI/password prompts)...
for /f "delims=" %%R in ('powershell -NoProfile -ExecutionPolicy Bypass -File "deploy\ssh-probe.ps1" -SshBin "%SSH_BIN%" -KeyPath "%SSH_KEY%" -HostSpec "%SSH_HOST%" -Port %SSH_PORT% -TimeoutSec 25') do set "SSH_PROBE=%%R"
if "%SSH_PROBE%"=="OK" (
  echo       OK
) else if "%SSH_PROBE%"=="TIMEOUT" (
  echo       FAIL: SSH hung during handshake/auth ^(often VPN or slow GSSAPI^)
  echo       Try: turn off VPN, or run ssh.bat and wait 30-60 sec once
) else (
  echo       FAIL: key not accepted ^(%SSH_PROBE%^)
  echo       Add public key in TimeWeb console: cat %SSH_KEY%.pub ^>^> ~/.ssh/authorized_keys
)

echo.
if not "%SSH_PROBE%"=="OK" (
  echo Manual verbose test:
  echo   "%SSH_BIN%" -vvv -i "%SSH_KEY%" %SSH_BATCH_OPTS% %SSH_HOST%
  echo.
  echo If step 2 OK but step 3 fails: VPN off, verify key on server, check fail2ban.
  echo See deploy\README.md section "Connection timed out".
  echo.
)

:done
pause
endlocal
