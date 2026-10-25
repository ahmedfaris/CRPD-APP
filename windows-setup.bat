@echo off
REM =============================================================================
REM Automated Setup & Deployment Script for Windows
REM Enterprise IT Service Desk & Device Asset Management
REM =============================================================================

echo ============================================================
echo   IT Service Desk & Asset Management - Windows Setup
echo ============================================================
echo.

REM 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your PATH!
    echo Please install Node.js 20 LTS from https://nodejs.org
    pause
    exit /b 1
)

echo [1/5] Checking environment configuration (.env)...
if not exist .env (
    if exist .env.example (
        echo Creating .env from .env.example...
        copy .env.example .env >nul
        echo [NOTICE] Created .env file. Please edit .env with your PostgreSQL credentials before continuing!
        echo Press any key once you have configured .env...
        pause >nul
    ) else (
        echo [WARNING] No .env.example found. Ensure .env exists with your database credentials.
    )
) else (
    echo [OK] .env file detected.
)
echo.

REM 2. Install dependencies
echo [2/5] Running: npm install...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install encountered an error.
    pause
    exit /b %errorlevel%
)
echo [OK] Dependencies installed successfully.
echo.

REM 3. Push Database Schema to PostgreSQL
echo [3/5] Running: npm run db:push (Pushing schema to PostgreSQL)...
call npm run db:push
if %errorlevel% neq 0 (
    echo [WARNING] db:push had an issue. Please verify PostgreSQL is running and .env credentials are correct.
    echo Continuing to next step...
) else (
    echo [OK] Database schema pushed successfully.
)
echo.

REM 4. Seed Database
echo [4/5] Running: npm run db:seed (Seeding initial users, roles, departments, assets)...
call npm run db:seed
if %errorlevel% neq 0 (
    echo [WARNING] db:seed encountered an issue. Check connection settings.
) else (
    echo [OK] Database seeded successfully.
)
echo.

REM 5. Build Application
echo [5/5] Running: npm run build (Compiling frontend and server)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b %errorlevel%
)
echo [OK] Build completed successfully.
echo.

echo ============================================================
echo   Setup Complete!
echo ============================================================
echo To start the application, run:
echo     npm start
echo.
echo The app will be accessible at http://localhost:3000
echo.
echo Default Administrator Login:
echo     Email:    admin@system.local
echo     Password: Admin@2026!
echo ============================================================
echo.
pause
