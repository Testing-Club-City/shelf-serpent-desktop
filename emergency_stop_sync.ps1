# Emergency Stop Sync and Fix Database Locks
Write-Host "🛑 Emergency Stop: Fixing Database Locks..." -ForegroundColor Red

# Kill any running sync processes
Write-Host "🔪 Stopping any running sync processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*tauri*" -or $_.ProcessName -like "*shelf*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait a moment
Start-Sleep -Seconds 2

# Navigate to project directory
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

# Apply emergency database fixes
Write-Host "🔧 Applying emergency database fixes..." -ForegroundColor Yellow

# Create emergency fix script
$fixScript = @"
use rusqlite::{Connection, Result};
use std::path::PathBuf;

fn main() -> Result<()> {
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    let conn = Connection::open(&db_path)?;
    
    // Force unlock database
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", [])?;
    conn.execute("PRAGMA journal_mode = WAL", [])?;
    conn.execute("PRAGMA synchronous = NORMAL", [])?;
    conn.execute("PRAGMA busy_timeout = 1000", [])?;
    conn.execute("PRAGMA cache_size = -8000", [])?;
    
    println!("✅ Database unlocked and optimized");
    Ok(())
}
"@

# Write and compile emergency fix
$fixScript | Out-File -FilePath "emergency_fix.rs" -Encoding UTF8

# Add to Cargo.toml
$cargoContent = Get-Content "src-tauri\Cargo.toml" -Raw
if ($cargoContent -notmatch "emergency_fix") {
    Add-Content "src-tauri\Cargo.toml" @"

[[bin]]
name = "emergency_fix"
path = "../emergency_fix.rs"
"@
}

# Compile and run
Write-Host "🔨 Compiling emergency fix..." -ForegroundColor Yellow
Set-Location "src-tauri"
cargo build --bin emergency_fix --release

if ($LASTEXITCODE -eq 0) {
    Write-Host "🚀 Running emergency fix..." -ForegroundColor Green
    .\target\release\emergency_fix.exe
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Emergency fix completed!" -ForegroundColor Green
        Write-Host "💡 Database locks should now be resolved." -ForegroundColor Cyan
        Write-Host "🔄 You can now restart your application and use the new sync method." -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ Emergency fix compilation failed" -ForegroundColor Red
}

Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")