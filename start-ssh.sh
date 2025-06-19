#!/bin/bash

# Brastel PIN Checker - SSH Startup Script
# Easy deployment script for SSH usage

echo "🚀 Brastel PIN Checker - SSH Version"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 12+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 12 ]; then
    echo "❌ Node.js version is too old. Please upgrade to Node.js 12 or higher."
    echo "Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies already installed"
fi

# Make CLI executable
chmod +x cli.js

echo ""
echo "🎯 Available Commands:"
echo "  node cli.js help              - Show help"
echo "  node cli.js config            - Show configuration"
echo "  node cli.js stats             - Show statistics"
echo "  node cli.js start             - Start PIN checking"
echo "  node cli.js start --workers 3 - Start with 3 workers"
echo ""
echo "📋 For background execution:"
echo "  screen -S brastel -d -m node cli.js start --workers 3"
echo "  nohup node cli.js start --workers 3 > brastel.log 2>&1 &"
echo ""
echo "✅ Setup completed! You can now use the CLI commands."