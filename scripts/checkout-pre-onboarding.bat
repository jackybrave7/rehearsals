@echo off
setlocal
cd /d "%~dp0.."

echo.
echo [rehearsals] Checkout tag pre-onboarding-engagement (baseline before onboarding work)
echo   commit: 357498a
echo.

git fetch origin --tags 2>nul
git checkout pre-onboarding-engagement
if errorlevel 1 (
  echo ERROR: tag not found. Run: git tag -l pre-onboarding-engagement
  pause
  exit /b 1
)

echo.
echo Detached HEAD at pre-onboarding-engagement. To return:
echo   git checkout feature/onboarding-engagement
echo   or: git checkout main
echo.
endlocal
