#!/bin/bash

echo "🔄 Restarting all PlugBox servers..."

# Kill existing processes
echo "🛑 Stopping existing servers..."
pkill -f "nodemon" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true
pkill -f "node.*server.js" 2>/dev/null || true

# Wait for processes to stop
sleep 2

# Start backend server
echo "🚀 Starting backend server..."
cd /home/ptspl03/Documents/1_PLUGBOX/dashboard/Backend
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running
if curl -s http://localhost:5001/health > /dev/null; then
    echo "✅ Backend server started successfully (PID: $BACKEND_PID)"
else
    echo "❌ Backend server failed to start"
    exit 1
fi

# Start frontend server
echo "🚀 Starting frontend server..."
cd /home/ptspl03/Documents/1_PLUGBOX/dashboard/Frontend
PORT=3002 npm start &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 10

echo "🎉 All servers restarted successfully!"
echo ""
echo "📋 Server Status:"
echo "🔗 Backend: http://localhost:5001 (PID: $BACKEND_PID)"
echo "🔗 Frontend: http://localhost:3002 (PID: $FRONTEND_PID)"
echo ""
echo "🔑 Login Credentials:"
echo "Email: testvendor@plugbox.com"
echo "Password: password123"
echo ""
echo "📊 To stop servers: kill $BACKEND_PID $FRONTEND_PID"
echo "📊 To view logs: tail -f /dev/null & (or check individual terminals)"

# Keep script running to maintain background processes
wait
