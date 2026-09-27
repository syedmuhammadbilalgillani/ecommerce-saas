@echo off
setlocal

cd /d "%~dp0"
if exist "scripts\" (
  rem In root
) else (
  cd /d "%~dp0\.."
)

echo ==================================================
echo  Building merchant-admin for Production (Windows)
echo  Directory: %CD%
echo ==================================================

call pnpm --filter merchant-admin build
if errorlevel 1 exit /b %errorlevel%

echo [OK] merchant-admin build complete!
