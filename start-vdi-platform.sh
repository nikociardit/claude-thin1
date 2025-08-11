#!/bin/bash

# VDI Platform Startup Script
# Starts both backend and frontend services

echo "🚀 Starting VDI Management Platform..."

# Kill any existing processes on ports 3000 and 3001
echo "🔧 Cleaning up existing processes..."
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "tsx" 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true

# Wait a moment for processes to stop
sleep 2

# Start Backend Server
echo "🔙 Starting Backend API Server..."
cd /root/claudecode/backend
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start Frontend Server
echo "🎨 Starting Frontend Web Server..."
cd /root/claudecode/frontend
npm run dev -- --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

echo ""
echo "✅ VDI Management Platform is now running!"
echo ""
echo "📊 Frontend:  http://45.15.178.63:3000"
echo "🔧 Backend:   http://45.15.178.63:3001"
echo "❤️  Health:   http://45.15.178.63:3001/health"
echo ""
echo "🔑 Demo Login Credentials:"
echo "   Admin:     admin@vdi.com / admin123"
echo "   Operator:  operator@vdi.com / operator123"
echo ""
echo "📝 Process IDs:"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "🛑 To stop both servers, run: pkill -f 'vite|tsx'"
echo ""
echo "⏳ Servers are starting up... Please wait 10-15 seconds then access the web interface."

# Keep the script running to monitor the processes
wait