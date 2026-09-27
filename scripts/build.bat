@echo off
setlocal

rem Navigate to script directory or monorepo root
cd /d "%~dp0"
if exist "scripts\" (
  rem In root
) else (
  cd /d "%~dp0\.."
)

set TARGET=%1
if "%TARGET%"=="" set TARGET=all

echo ==================================================
echo  Building POSflow Project: %TARGET% (Windows)
echo  Directory: %CD%
echo ==================================================

if "%TARGET%"=="merchant" goto build_merchant
if "%TARGET%"=="merchant-admin" goto build_merchant
if "%TARGET%"=="platform" goto build_platform
if "%TARGET%"=="platform-admin" goto build_platform
if "%TARGET%"=="api" goto build_api
if "%TARGET%"=="web" goto build_web
if "%TARGET%"=="storefront" goto build_web
if "%TARGET%"=="all" goto build_all

echo Unknown target: %TARGET%
echo Usage: build.bat [all^|merchant^|platform^|api^|web]
exit /b 1

:build_merchant
echo [INFO] Building merchant-admin...
call pnpm --filter merchant-admin build
goto done

:build_platform
echo [INFO] Building platform-admin...
call pnpm --filter platform-admin build
goto done

:build_api
echo [INFO] Building api...
call pnpm --filter api build
goto done

:build_web
echo [INFO] Building web storefront...
call pnpm --filter web build
goto done

:build_all
echo [INFO] Building all apps and packages via Turbo...
call pnpm build
goto done

:done
if errorlevel 1 exit /b %errorlevel%
echo [OK] Build finished successfully!
