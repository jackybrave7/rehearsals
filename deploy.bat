@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "SSH_KEY=%USERPROFILE%\.ssh\rehearsals_vps"
set "SSH_HOST=root@45.153.71.162"
set "REMOTE_DIR=/var/www/rehearsals"
set "REMOTE_SCRIPT=/tmp/rehearsals-deploy.sh"
set "SSH_BIN=%SystemRoot%\System32\OpenSSH\ssh.exe"
set "SCP_BIN=%SystemRoot%\System32\OpenSSH\scp.exe"
set "SKIP_GIT=0"
set "COMMIT_MSG="

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
echo.
exit /b 0
