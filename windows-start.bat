@echo off
REM Always run from the folder of this file, even when started from a shortcut.
cd /d "%~dp0"
REM =============================================================================
REM Windows One-Click Application Launcher
REM =============================================================================

echo ============================================================
echo   Starting IT Service Desk & Device Asset Management
echo   Folder: %CD%
echo   Listening on http://localhost:3000
echo ============================================================
echo.

REM "npm start" rebuilds the app first when the source code is newer (e.g. after an update).
call npm start
pause
