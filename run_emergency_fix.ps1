# Emergency Database Lock Fix Script
Write-Host "🔧 Running Emergency Database Lock Fix..." -ForegroundColor Yellow

# Navigate to the project directory
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host "📂 Project directory: $projectDir" -ForegroundColor Cyan

# Compile and run the emergency fix
Write-Host "🔨 Compiling emergency fix..." -ForegroundColor Yellow
cargo build --bin fix_database_locks --release

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Compilation successful!" -ForegroundColor Green
    Write-Host "🚀 Running emergency fix..." -ForegroundColor Yellow
    
    # Run the fix
    .\target\release\fix_database_locks.exe
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "🎉 Emergency fix completed successfully!" -ForegroundColor Green
        Write-Host "💡 You can now restart your application." -ForegroundColor Cyan
    } else {
        Write-Host "❌ Emergency fix failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Compilation failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "📝 Check the error messages above for details." -ForegroundColor Yellow
}

Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")