@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "SSH_KEY=%USERPROFILE%\.ssh\rehearsals_vps"
set "SSH_HOST=root@45.153.71.162"
set "SSH_PORT=22"
set "REMOTE_DIR=/var/www/rehearsals"
set "REMOTE_SCRIPT=/tmp/rehearsals-deploy.sh"
set "SSH_BIN=%SystemRoot%\System32\OpenSSH\ssh.exe"
set "SCP_BIN=%SystemRoot%\System32\OpenSSH\scp.exe"
set "SKIP_GIT=0"
set "COMMIT_MSG="

if exist "deploy\deploy.local.bat" call "deploy\deploy.local.bat"
call "deploy\ssh-options.bat"

:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--skip-git" (
  set "SKIP_GIT=1"
  shift
  goto parse_args
)
if not defined COMMIT_MSG set "COMMIT_MSG=%~1"
shift
goto parse_args

:args_done

echo.
echo [rehearsals] Deploy to VPS...
echo   Server:  %SSH_HOST%
echo   Port:    %SSH_PORT%
echo   Path:    %REMOTE_DIR%
echo.

if "%SKIP_GIT%"=="0" (
  call :git_prepare
  if errorlevel 1 (
    pause
    exit /b 1
  )
) else (
  echo [git] Skipped ^(--skip-git^)
  for /f "delims=" %%H in ('git rev-parse HEAD 2^>nul') do set "LOCAL_HEAD=%%H"
  for /f "tokens=1" %%H in ('git ls-remote origin HEAD 2^>nul') do set "REMOTE_HEAD=%%H"
  if defined LOCAL_HEAD if defined REMOTE_HEAD if not "!LOCAL_HEAD!"=="!REMOTE_HEAD!" (
    echo.
    echo WARNING: local is ahead of origin — server will NOT get your latest code.
    echo   local:  !LOCAL_HEAD:~0,7!
    echo   remote: !REMOTE_HEAD:~0,7!
    echo Run without --skip-git, or: git push origin HEAD
    echo.
  )
  echo.
)

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

call :check_ssh
if errorlevel 1 (
  pause
  exit /b 1
)

echo Uploading deploy script...
"%SCP_BIN%" -i "%SSH_KEY%" -P %SSH_PORT% %SSH_BATCH_OPTS% "deploy\remote-deploy.sh" %SSH_HOST%:%REMOTE_SCRIPT%
if errorlevel 1 (
  call :print_ssh_failure
  pause
  exit /b 1
)

echo Running deploy on server...
echo.
"%SSH_BIN%" -i "%SSH_KEY%" -p %SSH_PORT% %SSH_BATCH_OPTS% %SSH_HOST% "tr -d '\r' < %REMOTE_SCRIPT% | bash -l -s"

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

:git_prepare
where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: git not found in PATH
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: not a git repository
  exit /b 1
)

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "GIT_BRANCH=%%B"
echo [git] branch: %GIT_BRANCH%

set "HAS_CHANGES=0"
git diff --quiet
if errorlevel 1 set "HAS_CHANGES=1"
git diff --cached --quiet
if errorlevel 1 set "HAS_CHANGES=1"
for /f "delims=" %%F in ('git ls-files --others --exclude-standard') do (
  set "HAS_CHANGES=1"
  goto changes_checked
)
:changes_checked

if "%HAS_CHANGES%"=="1" (
  echo.
  echo [git] Uncommitted changes:
  git status -s
  echo.

  if not defined COMMIT_MSG (
    echo Commit message as argument, or enter below. Empty line = abort.
    echo   deploy.bat "fix venue id collision"
    echo.
    set /p COMMIT_MSG=Commit message: 
    if "!COMMIT_MSG!"=="" (
      echo Aborted: commit or stash changes first, or use --skip-git.
      exit /b 1
    )
  )

  echo [git] git add -A
  git add -A
  if errorlevel 1 exit /b 1

  echo [git] git commit
  git commit -m "!COMMIT_MSG!"
  if errorlevel 1 exit /b 1
  echo.
) else (
  echo [git] Working tree clean
)

echo [git] git push
git push origin HEAD
if errorlevel 1 (
  echo ERROR: git push failed
  exit /b 1
)

for /f "delims=" %%H in ('git rev-parse HEAD') do set "LOCAL_HEAD=%%H"
for /f "tokens=1" %%H in ('git ls-remote origin HEAD 2^>nul') do set "REMOTE_HEAD=%%H"
if not defined REMOTE_HEAD (
  echo ERROR: could not read remote HEAD after push
  exit /b 1
)
if not "!LOCAL_HEAD!"=="!REMOTE_HEAD!" (
  echo.
  echo ERROR: local commit was not published to origin.
  echo   local:  !LOCAL_HEAD!
  echo   remote: !REMOTE_HEAD!
  echo Push manually: git push origin HEAD
  exit /b 1
)
echo [git] remote is up to date: !LOCAL_HEAD:~0,7!
echo.
exit /b 0

:check_ssh
for /f "tokens=2 delims=@" %%I in ("%SSH_HOST%") do set "SSH_IP=%%I"
if not defined SSH_IP set "SSH_IP=%SSH_HOST%"

echo [ssh] Checking TCP port %SSH_PORT% on %SSH_IP%...
powershell -NoProfile -Command "$r = Test-NetConnection -ComputerName '%SSH_IP%' -Port %SSH_PORT% -WarningAction SilentlyContinue; if ($r.TcpTestSucceeded) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  call :print_ssh_failure
  exit /b 1
)

echo [ssh] Port is open, testing SSH (max 25 sec)...
for /f "delims=" %%R in ('powershell -NoProfile -ExecutionPolicy Bypass -File "deploy\ssh-probe.ps1" -SshBin "%SSH_BIN%" -KeyPath "%SSH_KEY%" -HostSpec "%SSH_HOST%" -Port %SSH_PORT% -TimeoutSec 25') do set "SSH_PROBE=%%R"
if not "%SSH_PROBE%"=="OK" (
  echo.
  if "%SSH_PROBE%"=="TIMEOUT" (
    echo ERROR: SSH hung after TCP connect. Turn off VPN and retry.
    echo Or open ssh.bat once and wait — first connect can be slow.
  ) else (
    echo ERROR: TCP port %SSH_PORT% is open, but SSH login failed.
    echo Check key %SSH_KEY% and ~/.ssh/authorized_keys on the server.
  )
  echo Verbose: "%SSH_BIN%" -vvv -i "%SSH_KEY%" %SSH_BATCH_OPTS% %SSH_HOST%
  echo.
  exit /b 1
)
exit /b 0

:print_ssh_failure
echo.
echo ERROR: Cannot reach SSH on %SSH_HOST% port %SSH_PORT%.
echo.
echo This is NOT a git or npm problem. The VPS is unreachable from your PC:
echo   - ping may work, but ports 22/80/443 do not respond
echo   - server may be stopped, suspended, or firewalled
echo.
echo What to do:
echo   1. Open TimeWeb panel - check VPS status and billing
echo   2. Start the server if it is stopped
echo   3. Firewall: allow inbound TCP 22 from your IP
echo   4. Console/VNC: run   systemctl status ssh nginx
echo   5. Run deploy-check.bat for details
echo   6. See deploy\README.md - "Connection timed out"
echo.
exit /b 1
