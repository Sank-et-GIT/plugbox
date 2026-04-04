@echo off
echo ========================================
echo PlugBox Charger Management Auto-Setup
echo ========================================
echo.

echo [1/5] Checking if Backend is running...
curl -s http://localhost:5000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo Backend not running. Starting it...
    cd "c:\Users\prana\OneDrive\Desktop\plugbox\plugbox\dashboard\Backend"
    start "Backend" cmd /k "npm run dev"
    timeout /t 5 >nul
) else (
    echo Backend is already running!
)

echo [2/5] Checking if Frontend is running...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo Frontend not running. Starting it...
    cd "c:\Users\prana\OneDrive\Desktop\plugbox\plugbox\dashboard\Frontend"
    start "Frontend" cmd /k "npm start"
    timeout /t 5 >nul
) else (
    echo Frontend is already running!
)

echo [3/5] Verifying Charger API endpoints...
curl -s http://localhost:5000/api/chargers >nul 2>&1
if %errorlevel% equ 0 (
    echo Charger API endpoints are working!
) else (
    echo Starting backend server first...
    cd "c:\Users\prana\OneDrive\Desktop\plugbox\plugbox\dashboard\Backend"
    start "Backend" cmd /k "npm run dev"
    timeout /t 10 >nul
)

echo [4/5] Opening browser...
start http://localhost:3000

echo [5/5] Setup Complete!
echo.
echo ========================================
echo Auto-Setup Complete!
echo ========================================
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Features Available:
echo - Add Charger
echo - View Chargers (List)
echo - Edit Charger  
echo - Delete Charger
echo - Vendor Isolation (One Vendor -> Many Chargers)
echo.
echo Ready to use! Press any key to exit...
pause
