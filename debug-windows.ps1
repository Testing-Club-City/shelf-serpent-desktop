# Windows Debug Script for Shelf Serpent Desktop
# This script helps diagnose Windows-specific issues

Write-Host "🔍 Diagnosing Windows-specific issues..." -ForegroundColor Green

# Check Windows version
$osInfo = Get-WmiObject -Class Win32_OperatingSystem
Write-Host "🖥️  OS: $($osInfo.Caption) $($osInfo.Version)" -ForegroundColor Cyan

# Check database path and permissions
$appDataPath = [Environment]::GetFolderPath('ApplicationData')
$dbDir = Join-Path $appDataPath "library-management-system"
$dbPath = Join-Path $dbDir "library.db"

Write-Host "📂 Database directory: $dbDir" -ForegroundColor Cyan
Write-Host "📄 Database file: $dbPath" -ForegroundColor Cyan

# Check if directory exists and permissions
if (Test-Path $dbDir) {
    Write-Host "✅ Database directory exists" -ForegroundColor Green
    
    # Check permissions
    try {
        $acl = Get-Acl $dbDir
        Write-Host "✅ Directory permissions accessible" -ForegroundColor Green
    } catch {
        Write-Host "❌ Cannot access directory permissions: $_" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Database directory does not exist" -ForegroundColor Red
    try {
        New-Item -ItemType Directory -Path $dbDir -Force
        Write-Host "✅ Created database directory" -ForegroundColor Green
    } catch {
        Write-Host "❌ Cannot create database directory: $_" -ForegroundColor Red
    }
}

# Check if database file exists
if (Test-Path $dbPath) {
    Write-Host "✅ Database file exists" -ForegroundColor Green
    
    # Check file size
    $fileSize = (Get-Item $dbPath).Length
    Write-Host "📊 Database size: $([math]::Round($fileSize/1KB, 2)) KB" -ForegroundColor Cyan
    
    # Check if file is locked
    try {
        $file = [System.IO.File]::Open($dbPath, 'Open', 'Read', 'None')
        $file.Close()
        Write-Host "✅ Database file is accessible" -ForegroundColor Green
    } catch {
        Write-Host "❌ Database file is locked or inaccessible: $_" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Database file does not exist" -ForegroundColor Red
}

# Check antivirus interference
Write-Host "🛡️  Checking for potential antivirus interference..." -ForegroundColor Yellow
$antivirusProducts = Get-WmiObject -Namespace "root\SecurityCenter2" -Class AntiVirusProduct -ErrorAction SilentlyContinue
if ($antivirusProducts) {
    foreach ($av in $antivirusProducts) {
        Write-Host "🛡️  Antivirus detected: $($av.displayName)" -ForegroundColor Yellow
    }
    Write-Host "💡 If issues persist, try adding the app directory to antivirus exclusions" -ForegroundColor Yellow
}

# Check Windows Defender status
try {
    $defenderStatus = Get-MpPreference -ErrorAction SilentlyContinue
    if ($defenderStatus) {
        Write-Host "🛡️  Windows Defender is active" -ForegroundColor Yellow
        Write-Host "💡 Consider adding exclusion for: $dbDir" -ForegroundColor Yellow
    }
} catch {
    # Windows Defender cmdlets not available
}

# Check available disk space
$drive = (Get-Item $dbDir).PSDrive
$freeSpace = [math]::Round($drive.Free / 1GB, 2)
Write-Host "💾 Available disk space: $freeSpace GB" -ForegroundColor Cyan

# Check if running with elevated privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if ($isAdmin) {
    Write-Host "🔑 Running with Administrator privileges" -ForegroundColor Green
} else {
    Write-Host "⚠️  Not running with Administrator privileges" -ForegroundColor Yellow
}

Write-Host "🔍 Diagnosis complete!" -ForegroundColor Green
