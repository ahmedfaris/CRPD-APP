@echo off
REM =============================================================================
REM Update the application to the latest version of its branch.
REM Stop the application before running this file.
REM =============================================================================
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Updating the application
echo ============================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH. Install it from https://git-scm.com
    goto :fail
)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
if "%BRANCH%"=="main" (
    echo [NOTICE] You are on "main". The latest changes are on "claude/security-fixes".
    echo          Switching to it...
    set BRANCH=claude/security-fixes
)

echo [1/5] Backing up the database folder (data) ...
for /f "delims=" %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set STAMP=%%t
if exist data (
    robocopy data "backups\data-%STAMP%" /E /NFL /NDL /NJH /NJS /NP >nul
    if errorlevel 8 (
        echo [ERROR] Could not back up the data folder. Is the application still running?
        goto :fail
    )
    echo        Saved to backups\data-%STAMP%
)
echo.

echo [2/5] Downloading the latest version (%BRANCH%) ...
git fetch origin %BRANCH%
if %errorlevel% neq 0 goto :gitfail
REM The database files change while the app runs; keep the local copy, do not let them block the update.
for /f %%c in ('git stash list ^| find /c /v ""') do set STASH_BEFORE=%%c
git stash push --quiet -- data >nul 2>nul
for /f %%c in ('git stash list ^| find /c /v ""') do set STASH_AFTER=%%c
git checkout %BRANCH%
if %errorlevel% neq 0 goto :gitfail
git merge --ff-only origin/%BRANCH%
if %errorlevel% neq 0 goto :gitfail
if not "%STASH_AFTER%"=="%STASH_BEFORE%" (
    git stash pop --quiet >nul 2>nul
    if errorlevel 1 (
        echo [NOTICE] Restoring your database files from the backup ...
        git checkout -- data >nul 2>nul
        robocopy "backups\data-%STAMP%" data /E /NFL /NDL /NJH /NJS /NP >nul
        git stash drop --quiet >nul 2>nul
    )
)
echo.

echo [3/5] Installing packages ...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    goto :fail
)
echo.

echo [4/5] Building the application ...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] The build failed. See the messages above.
    goto :fail
)
echo.

echo [5/5] Installed version:
git log --oneline -1
echo.
echo ============================================================
echo   Update finished. Start the app with windows-start.bat,
echo   then press Ctrl+F5 in the browser.
echo ============================================================
pause
exit /b 0

:gitfail
echo [ERROR] Git could not update the files. Copy the messages above and send them to support.
:fail
pause
exit /b 1
