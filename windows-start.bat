@echo off
REM =============================================================================
REM Windows One-Click Application Launcher
REM =============================================================================

echo ============================================================
echo   Starting IT Service Desk & Device Asset Management
echo   Listening on http://localhost:3000
echo ============================================================
echo.

REM "npm start" rebuilds the app first when the source code is newer (e.g. after an update).
call npm start
pause
