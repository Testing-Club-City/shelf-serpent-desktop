# Performance Testing Script for Library Management System
Write-Host "🚀 Starting Performance Testing..." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found package.json - starting tests..." -ForegroundColor Green

# Step 1: Install dependencies if needed
Write-Host "`n🔧 Checking dependencies..." -ForegroundColor Blue
$nodeModulesExists = Test-Path "node_modules"
if (!$nodeModulesExists) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Dependency installation failed!" -ForegroundColor Red
        exit 1
    }
}

# Step 2: Check Rust compilation
Write-Host "`n🦀 Testing Rust backend performance..." -ForegroundColor Blue
Set-Location "src-tauri"

# Compile with optimizations
Write-Host "🔨 Building optimized Rust backend..." -ForegroundColor Yellow
$rustStart = Get-Date
cargo build --release
$rustEnd = Get-Date
$rustBuildTime = ($rustEnd - $rustStart).TotalSeconds

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Rust compilation failed!" -ForegroundColor Red
    Set-Location ".."
    exit 1
}

Write-Host "✅ Rust backend built successfully in $([math]::Round($rustBuildTime, 2)) seconds" -ForegroundColor Green
Set-Location ".."

# Step 3: Build frontend with optimizations
Write-Host "`n⚛️ Building optimized frontend..." -ForegroundColor Blue
$frontendStart = Get-Date
npm run build
$frontendEnd = Get-Date
$frontendBuildTime = ($frontendEnd - $frontendStart).TotalSeconds

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Frontend built successfully in $([math]::Round($frontendBuildTime, 2)) seconds" -ForegroundColor Green

# Step 4: Performance benchmarks
Write-Host "`n📊 Performance Benchmarks:" -ForegroundColor Cyan
Write-Host "┌─────────────────────────┬─────────────┐" -ForegroundColor White
Write-Host "│ Component               │ Build Time  │" -ForegroundColor White
Write-Host "├─────────────────────────┼─────────────┤" -ForegroundColor White
Write-Host "│ Rust Backend (Release)  │ $([math]::Round($rustBuildTime, 2))s       │" -ForegroundColor White
Write-Host "│ Frontend (Optimized)    │ $([math]::Round($frontendBuildTime, 2))s       │" -ForegroundColor White
Write-Host "│ Total Build Time        │ $([math]::Round($rustBuildTime + $frontendBuildTime, 2))s       │" -ForegroundColor White
Write-Host "└─────────────────────────┴─────────────┘" -ForegroundColor White

# Step 5: Run development server for testing
Write-Host "`n🏃‍♂️ Starting performance test server..." -ForegroundColor Blue
Write-Host "This will start the Tauri development server with performance optimizations enabled." -ForegroundColor Yellow
Write-Host "Monitor the console for performance metrics and loading times." -ForegroundColor Yellow
Write-Host ""
Write-Host "Performance Features Enabled:" -ForegroundColor Cyan
Write-Host "  ✅ Rust multithreading with Tokio" -ForegroundColor Green
Write-Host "  ✅ Database connection pooling" -ForegroundColor Green
Write-Host "  ✅ Advanced SQLite optimizations" -ForegroundColor Green
Write-Host "  ✅ Query result caching with TTL" -ForegroundColor Green
Write-Host "  ✅ Background cache warming" -ForegroundColor Green
Write-Host "  ✅ Virtual scrolling for large lists" -ForegroundColor Green
Write-Host "  ✅ Debounced search functionality" -ForegroundColor Green
Write-Host "  ✅ Parallel data processing" -ForegroundColor Green
Write-Host "  ✅ Memory-optimized data structures" -ForegroundColor Green
Write-Host "  ✅ Batch operations for bulk data" -ForegroundColor Green
Write-Host ""

# Ask user if they want to run the dev server
$runServer = Read-Host "Start performance test server? (y/n)"
if ($runServer -eq 'y' -or $runServer -eq 'Y' -or $runServer -eq 'yes') {
    Write-Host "🚀 Starting Tauri development server with performance monitoring..." -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server when testing is complete." -ForegroundColor Yellow
    Write-Host ""
    
    # Set environment variable for performance mode
    $env:PERFORMANCE_MODE = "true"
    $env:RUST_LOG = "info"
    
    # Start the server
    npm run tauri dev
} else {
    Write-Host "⏸️  Performance test setup complete. Ready for manual testing." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Performance Testing Tips:" -ForegroundColor Cyan
Write-Host "  • Watch console logs for timing information" -ForegroundColor White
Write-Host "  • Test with large datasets (1000+ books/students)" -ForegroundColor White
Write-Host "  • Monitor memory usage during operations" -ForegroundColor White
Write-Host "  • Test search functionality with various queries" -ForegroundColor White
Write-Host "  • Verify virtual scrolling with large lists" -ForegroundColor White
Write-Host "  • Check cache effectiveness by repeating operations" -ForegroundColor White
Write-Host ""
Write-Host "✅ Performance testing script completed!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
