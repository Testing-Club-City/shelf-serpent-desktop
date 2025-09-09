#!/usr/bin/env pwsh

Write-Host "Building production version with console output enabled..." -ForegroundColor Cyan

# Set environment variables for debugging
$env:RUST_LOG = "debug"
$env:RUST_BACKTRACE = "1"
$env:TAURI_DEBUG = "1"

# Build the frontend first
Write-Host "Building frontend..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

# Build Tauri app with console attached
Write-Host "Building Tauri app with console..." -ForegroundColor Yellow

# Modify the Tauri configuration temporarily to show console
$configPath = "src-tauri\tauri.conf.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

# Backup original config
$backupConfig = $config | ConvertTo-Json -Depth 10
$backupConfig | Out-File "src-tauri\tauri.conf.json.backup" -Encoding UTF8

# Add console window for debugging
if (-not $config.build.PSObject.Properties["windows"]) {
    $config.build | Add-Member -MemberType NoteProperty -Name "windows" -Value @{
        console = $true
    }
} else {
    $config.build.windows.console = $true
}

# Save modified config
$config | ConvertTo-Json -Depth 10 | Out-File $configPath -Encoding UTF8

try {
    # Build with Tauri
    Write-Host "Running Tauri build..." -ForegroundColor Yellow
    npm run tauri build -- --debug
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Build successful! Running the application..." -ForegroundColor Green
        
        # Run the built application with console output
        $exePath = "src-tauri\target\release\tauri-app.exe"
        if (Test-Path $exePath) {
            Write-Host "Starting application at: $exePath" -ForegroundColor Cyan
            & $exePath
        } else {
            Write-Host "Executable not found at: $exePath" -ForegroundColor Red
        }
    } else {
        Write-Host "Tauri build failed!" -ForegroundColor Red
    }
} finally {
    # Restore original config
    Write-Host "Restoring original configuration..." -ForegroundColor Yellow
    Move-Item "src-tauri\tauri.conf.json.backup" $configPath -Force
}
