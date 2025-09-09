#!/bin/bash

echo "🔧 Testing Tauri build configuration..."

# Check if library.db exists
if [ -f "library.db" ]; then
    echo "✅ Database file found: library.db"
    ls -lh library.db
else
    echo "❌ Database file not found!"
    exit 1
fi

# Check tauri.conf.json for resources
echo "📋 Checking Tauri configuration..."
if grep -q "library.db" src-tauri/tauri.conf.json; then
    echo "✅ Database included in bundle resources"
else
    echo "❌ Database not found in bundle resources"
    exit 1
fi

echo "🚀 Configuration looks good! Ready to build with:"
echo "   npm run tauri build"
