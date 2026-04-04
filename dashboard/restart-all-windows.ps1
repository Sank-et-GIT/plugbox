Write-Host "🔄 Restarting all PlugBox servers..."

# Kill existing processes
Write-Host "🛑 Stopping existing servers..."
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Start backend server
Write-Host "🚀 Starting backend server..."
Set-Location "c:\Users\prana\OneDrive\Desktop\plugbox\plugbox\dashboard\Backend"
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru
$BACKEND_PID = $process.Id

# Wait for backend to start
Write-Host "⏳ Waiting for backend to start..."
Start-Sleep -Seconds 5

# Start frontend server
Write-Host "🚀 Starting frontend server..."
Set-Location "c:\Users\prana\OneDrive\Desktop\plugbox\plugbox\dashboard\Frontend"
$env:PORT = "3002"
Start-Process -FilePath "npm" -ArgumentList "start" -PassThru
$FRONTEND_PID = $process.Id

Write-Host "🎉 All servers restarted successfully!"
Write-Host ""
Write-Host "📋 Server Status:"
Write-Host "🔗 Backend: http://localhost:5000"
Write-Host "🔗 Frontend: http://localhost:3002"
Write-Host ""
Write-Host "🔑 Login Credentials:"
Write-Host "Admin: admin@plugbox.com / password123"
Write-Host "Vendor: testvendor@plugbox.com / password123"
