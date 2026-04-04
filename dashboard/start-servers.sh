#!/bin/bash

echo "🚀 Starting PlugBox Servers..."

# Kill any existing processes
pkill -f "nodemon" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true

# Start backend
cd /home/ptspl03/Documents/1_PLUGBOX/dashboard/Backend && npm run dev &
BACKEND_PID=$!

# Start frontend  
cd /home/ptspl03/Documents/1_PLUGBOX/dashboard/Frontend && PORT=3002 npm start &
FRONTEND_PID=$!

echo "✅ Servers starting..."
echo "Backend: http://localhost:5001 (PID: $BACKEND_PID)"
echo "Frontend: http://localhost:3002 (PID: $FRONTEND_PID)"
echo ""
echo "Login: testvendor@plugbox.com / password123"
