@echo off
setlocal

rem Navigate to script directory or monorepo root
cd /d "%~dp0"
if exist "scripts\" (
  rem Already in root
) else (
  cd /d "%~dp0\.."
)

set APP_NAME=platform-admin
set DEFAULT_PORT=3002
if "%PORT%"=="" set PORT=%DEFAULT_PORT%
set NODE_ENV=production

echo ==================================================
echo  Starting %APP_NAME% for Deployment (Windows)
echo  Environment: %NODE_ENV%
echo  Port:        %PORT%
echo  Directory:   %CD%
echo ==================================================

if exist ".env" (
  echo [OK] Found root .env configuration
) else (
  echo [WARN] Warning: No root .env file found!
)

rem Check if build needed
if "%1"=="--build" goto do_build
if not exist "apps\%APP_NAME%\.next" goto do_build
goto do_start

:do_build
echo [INFO] Building %APP_NAME% for production...
call pnpm --filter %APP_NAME% build
if errorlevel 1 exit /b %errorlevel%

:do_start
echo [INFO] Starting %APP_NAME% on port %PORT%...
call pnpm --filter %APP_NAME% exec next start -p %PORT%
