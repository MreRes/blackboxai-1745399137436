#!/bin/bash

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "MongoDB is not installed. Installing MongoDB..."
    # Install MongoDB
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
    sudo apt-get update
    sudo apt-get install -y mongodb-org
fi

# Create data directory if it doesn't exist
sudo mkdir -p /data/db

# Start MongoDB daemon
echo "Starting MongoDB..."
sudo mongod --fork --logpath /var/log/mongodb.log

# Wait for MongoDB to start
sleep 5

# Start the Node.js application
echo "Starting Node.js application..."
node server/index.js
