#!/bin/bash

# Shelf Serpent Desktop - Windows Installer Build Script
# This script builds the Windows executable and creates an installer

set -e

echo "🚀 Building Shelf Serpent Desktop Windows Installer..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Build the Windows executable
echo -e "${BLUE}📦 Step 1: Building Windows executable...${NC}"
npm run tauri build -- --target x86_64-pc-windows-gnu

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Windows executable built successfully!${NC}"
else
    echo -e "${RED}❌ Failed to build Windows executable${NC}"
    exit 1
fi

# Step 2: Check if the executable exists
EXE_PATH="src-tauri/target/x86_64-pc-windows-gnu/release/tauri-app.exe"
if [ ! -f "$EXE_PATH" ]; then
    echo -e "${RED}❌ Windows executable not found at $EXE_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found Windows executable: $(ls -lh $EXE_PATH | awk '{print $5}')${NC}"

# Step 3: Create the installer
echo -e "${BLUE}📦 Step 2: Creating Windows installer...${NC}"
makensis installer.nsi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Windows installer created successfully!${NC}"
else
    echo -e "${RED}❌ Failed to create Windows installer${NC}"
    exit 1
fi

# Step 4: Show results
INSTALLER_PATH="Shelf-Serpent-Desktop-Setup.exe"
if [ -f "$INSTALLER_PATH" ]; then
    INSTALLER_SIZE=$(ls -lh "$INSTALLER_PATH" | awk '{print $5}')
    echo -e "${GREEN}✅ Installer created: $INSTALLER_PATH ($INSTALLER_SIZE)${NC}"
    
    echo ""
    echo "🎉 Build Complete!"
    echo "=================="
    echo -e "${YELLOW}📁 Files created:${NC}"
    echo -e "   • Windows Executable: ${BLUE}$EXE_PATH${NC}"
    echo -e "   • Windows Installer:  ${BLUE}$INSTALLER_PATH${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next steps:${NC}"
    echo "   1. Copy the installer to a Windows machine"
    echo "   2. Run the installer as Administrator"
    echo "   3. The app will be installed to Program Files"
    echo "   4. Desktop and Start Menu shortcuts will be created"
    echo ""
    echo -e "${GREEN}🚀 Your Shelf Serpent Desktop is ready for distribution!${NC}"
else
    echo -e "${RED}❌ Installer file not found${NC}"
    exit 1
fi
