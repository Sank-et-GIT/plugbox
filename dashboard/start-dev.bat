@echo off
echo Starting PlugBox Development Servers...
echo.

echo Starting Backend Server...
cd "c:\Users\prana\OneDrive\Desktop\plugbox\plugbox\dashboard\Backend"
start "Backend Server" cmd /k "npm run dev"

echo Starting Frontend Server...
cd "c:\Users\prana\OneDrive\Desktop\plugbox\plugbox\dashboard\Frontend"
start "Frontend Server" cmd /k "npm start"

echo.
echo Both servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause
