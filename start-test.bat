@echo off
echo ========================================
echo Starting "Don't Make Me Say" - Test Mode
echo ========================================
echo.

REM Check if node_modules exist in backend
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
    echo.
)

REM Check if node_modules exist in frontend
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
    echo.
)

REM Start MySQL service if it is not already running
echo Checking MySQL service (MySQL80)...
sc query MySQL80 | findstr /i "RUNNING" >nul 2>&1
if errorlevel 1 (
    echo Starting MySQL80 service...
    net start MySQL80
    if errorlevel 1 (
        echo ❌ Failed to start MySQL80. Try running this script as Administrator.
        pause
        exit /b 1
    )
    echo Waiting for MySQL to become ready...
    timeout /t 5 /nobreak >nul
) else (
    echo MySQL80 is already running.
)
echo.

echo Starting backend server...
start "Backend Server" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting frontend development server...
start "Frontend Server" cmd /k "cd frontend && npm start"

echo.
echo ========================================
echo Both servers are starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to stop all servers...
pause >nul

echo Stopping servers...
taskkill /FI "WindowTitle eq Backend Server*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq Frontend Server*" /T /F >nul 2>&1
echo Servers stopped.
