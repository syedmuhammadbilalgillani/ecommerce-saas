@echo off
setlocal

cd /d "%~dp0"
if exist "scripts\" (
  rem In root
) else (
  cd /d "%~dp0\.."
)

echo ==================================================
echo  Building web storefront for Production (Windows)
echo  Directory: %CD%
echo ==================================================

call pnpm --filter web build
if errorlevel 1 exit /b %errorlevel%

echo [OK] web storefront build complete!
