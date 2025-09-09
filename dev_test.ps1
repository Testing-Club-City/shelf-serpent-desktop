# Quick Development Test Script
Write-Host "🔧 Starting development server..." -ForegroundColor Green

# Kill any existing dev processes (optional)
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*vite*" } | Stop-Process -Force

# Start the development server
Write-Host "🌐 Starting Vite dev server..." -ForegroundColor Blue
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WindowStyle Normal

# Wait a moment for dev server to start
Start-Sleep -Seconds 3

# Start Tauri in development mode
Write-Host "📱 Starting Tauri development..." -ForegroundColor Blue
npm run tauri dev

Write-Host "🏁 Development session ended" -ForegroundColor Yellow
