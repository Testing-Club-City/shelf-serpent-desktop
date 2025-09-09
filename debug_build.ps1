# Debug Build Script for Library Management System
Write-Host "🚀 Starting debug build process..." -ForegroundColor Green

# Step 1: Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found package.json" -ForegroundColor Green

# Step 2: Build frontend
Write-Host "🏗️  Building frontend..." -ForegroundColor Blue
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Frontend build completed" -ForegroundColor Green

# Step 3: Check Rust compilation
Write-Host "🦀 Checking Rust compilation..." -ForegroundColor Blue
Set-Location "src-tauri"
cargo check
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Rust compilation failed!" -ForegroundColor Red
    Set-Location ".."
    exit 1
}
Write-Host "✅ Rust compilation successful" -ForegroundColor Green
Set-Location ".."

# Step 4: Try building the Tauri app
Write-Host "📱 Building Tauri application..." -ForegroundColor Blue
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tauri build failed!" -ForegroundColor Red
    Write-Host "💡 Check the console output above for details" -ForegroundColor Yellow
    exit 1
}

Write-Host "🎉 Build completed successfully!" -ForegroundColor Green
Write-Host "📍 The built application should be in src-tauri/target/release/" -ForegroundColor Blue
