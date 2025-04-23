#!/bin/bash

# Kill any process using port 8000
echo "Checking if port 8000 is in use..."
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Port 8000 is in use. Killing process..."
    kill $(lsof -t -i:8000)
fi

# Start the server
echo "Starting server..."
node server/index.js &

# Wait for server to start
sleep 2

# Start Python HTTP server for serving static files
echo "Starting Python HTTP server..."
python3 -m http.server 8000 -d server/public

# Keep the script running
wait
