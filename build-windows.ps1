# Windows Build Script for Shelf Serpent Desktop
# Run this script in PowerShell as Administrator

Write-Host "🚀 Building Shelf Serpent Desktop for Windows..." -ForegroundColor Green

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ This script requires Administrator privileges. Please run PowerShell as Administrator." -ForegroundColor Red
    exit 1
}

# Set execution policy temporarily
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18 or higher." -ForegroundColor Red
    exit 1
}

# Check Rust
try {
    $rustVersion = rustc --version
    Write-Host "✅ Rust found: $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Rust not found. Please install Rust from https://rustup.rs/" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "src-tauri/target") {
    Remove-Item -Recurse -Force "src-tauri/target"
}

# Build the application
Write-Host "🔨 Building application..." -ForegroundColor Yellow
try {
    npm run tauri build
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    
    # Show build artifacts location
    Write-Host "📁 Build artifacts can be found in:" -ForegroundColor Cyan
    Write-Host "   - MSI Installer: src-tauri/target/release/bundle/msi/" -ForegroundColor White
    Write-Host "   - NSIS Installer: src-tauri/target/release/bundle/nsis/" -ForegroundColor White
    
} catch {
    Write-Host "❌ Build failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Windows build process completed!" -ForegroundColor Green
