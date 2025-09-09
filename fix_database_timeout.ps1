# Database Timeout Fix PowerShell Script
# This script fixes database lock timeout and borrowing issues

param(
    [string]$DatabasePath = "",
    [switch]$Backup = $true,
    [switch]$Test = $false
)

Write-Host "🔧 Database Timeout Fix Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Function to find database file
function Find-DatabaseFile {
    $possiblePaths = @(
        "library.db",
        "shelf-serpent.db",
        "$env:APPDATA\library-management-system\library.db",
        "$env:LOCALAPPDATA\library-management-system\library.db"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            Write-Host "📁 Found database: $path" -ForegroundColor Green
            return $path
        }
    }
    
    return $null
}

# Function to create backup
function Create-DatabaseBackup {
    param([string]$dbPath)
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = "$dbPath.backup_$timestamp"
    
    try {
        Copy-Item $dbPath $backupPath
        Write-Host "📋 Backup created: $backupPath" -ForegroundColor Green
        return $backupPath
    }
    catch {
        Write-Host "❌ Failed to create backup: $_" -ForegroundColor Red
        return $null
    }
}

# Function to run Python fix script
function Run-PythonFix {
    param([string]$dbPath)
    
    Write-Host "🐍 Running Python database fix..." -ForegroundColor Yellow
    
    # Check if Python is available
    $pythonCmd = $null
    foreach ($cmd in @("python", "python3", "py")) {
        try {
            $version = & $cmd --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                $pythonCmd = $cmd
                Write-Host "✅ Found Python: $version" -ForegroundColor Green
                break
            }
        }
        catch {
            continue
        }
    }
    
    if (-not $pythonCmd) {
        Write-Host "❌ Python not found. Please install Python to run the fix." -ForegroundColor Red
        return $false
    }
    
    # Run the Python fix script
    try {
        & $pythonCmd "fix_database_timeout.py" $dbPath
        return $LASTEXITCODE -eq 0
    }
    catch {
        Write-Host "❌ Python fix script failed: $_" -ForegroundColor Red
        return $false
    }
}

# Function to run Rust fix (if available)
function Run-RustFix {
    Write-Host "🦀 Checking for Rust fix..." -ForegroundColor Yellow
    
    # Check if Rust/Cargo is available
    try {
        $cargoVersion = cargo --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Found Cargo: $cargoVersion" -ForegroundColor Green
            
            # Try to compile and run the Rust fix
            Write-Host "🔨 Compiling Rust database fix..." -ForegroundColor Yellow
            cargo run --bin fix_database_timeout
            return $LASTEXITCODE -eq 0
        }
    }
    catch {
        Write-Host "⚠️ Rust/Cargo not available, skipping Rust fix" -ForegroundColor Yellow
        return $false
    }
}

# Function to test database connectivity
function Test-DatabaseConnectivity {
    param([string]$dbPath)
    
    Write-Host "🧪 Testing database connectivity..." -ForegroundColor Yellow
    
    # Simple SQLite test using PowerShell
    try {
        # Load SQLite assembly if available
        Add-Type -Path "System.Data.SQLite.dll" -ErrorAction SilentlyContinue
        
        $connectionString = "Data Source=$dbPath;Version=3;"
        $connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
        $connection.Open()
        
        $command = $connection.CreateCommand()
        $command.CommandText = "SELECT sqlite_version()"
        $version = $command.ExecuteScalar()
        
        Write-Host "📊 SQLite version: $version" -ForegroundColor Green
        
        $connection.Close()
        return $true
    }
    catch {
        Write-Host "⚠️ Direct SQLite test failed: $_" -ForegroundColor Yellow
        Write-Host "💡 This is normal if System.Data.SQLite is not installed" -ForegroundColor Cyan
        return $false
    }
}

# Function to apply manual fixes
function Apply-ManualFixes {
    param([string]$dbPath)
    
    Write-Host "🔧 Applying manual database fixes..." -ForegroundColor Yellow
    
    # Create a simple SQL script to fix common issues
    $sqlScript = @"
-- Enable performance optimizations
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;
PRAGMA busy_timeout = 30000;

-- Add missing columns to borrowings table (ignore errors if columns exist)
ALTER TABLE borrowings ADD COLUMN student_id TEXT;
ALTER TABLE borrowings ADD COLUMN staff_id TEXT;
ALTER TABLE borrowings ADD COLUMN borrower_type TEXT DEFAULT 'student';
ALTER TABLE borrowings ADD COLUMN tracking_code TEXT;
ALTER TABLE borrowings ADD COLUMN condition_at_issue TEXT DEFAULT 'good';
ALTER TABLE borrowings ADD COLUMN synced INTEGER DEFAULT 0;
ALTER TABLE borrowings ADD COLUMN sync_version INTEGER DEFAULT 1;
ALTER TABLE borrowings ADD COLUMN deleted INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_borrowings_student ON borrowings(student_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_staff ON borrowings(staff_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_book_copy ON borrowings(book_copy_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status);
CREATE INDEX IF NOT EXISTS idx_borrowings_due_date ON borrowings(due_date);

-- Fix group_borrowings table
CREATE TABLE IF NOT EXISTS group_borrowings (
    id TEXT PRIMARY KEY,
    class_id TEXT,
    class_name TEXT NOT NULL,
    book_id TEXT NOT NULL,
    book_title TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    borrowed_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    returned_date TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Optimize database
VACUUM;
ANALYZE;
PRAGMA optimize;
"@

    $sqlFile = "database_fix.sql"
    $sqlScript | Out-File -FilePath $sqlFile -Encoding UTF8
    
    Write-Host "📝 Created SQL fix script: $sqlFile" -ForegroundColor Green
    Write-Host "💡 You can run this script manually with SQLite tools" -ForegroundColor Cyan
    
    return $true
}

# Main execution
try {
    # Find database file
    if (-not $DatabasePath) {
        $DatabasePath = Find-DatabaseFile
        if (-not $DatabasePath) {
            Write-Host "❌ Could not find database file. Please specify the path:" -ForegroundColor Red
            Write-Host "Usage: .\fix_database_timeout.ps1 -DatabasePath 'path\to\library.db'" -ForegroundColor Yellow
            exit 1
        }
    }
    
    if (-not (Test-Path $DatabasePath)) {
        Write-Host "❌ Database file not found: $DatabasePath" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "🎯 Using database: $DatabasePath" -ForegroundColor Cyan
    
    # Create backup if requested
    if ($Backup) {
        $backupPath = Create-DatabaseBackup -dbPath $DatabasePath
        if (-not $backupPath) {
            Write-Host "⚠️ Continuing without backup..." -ForegroundColor Yellow
        }
    }
    
    # Test mode - just test connectivity
    if ($Test) {
        Test-DatabaseConnectivity -dbPath $DatabasePath
        exit 0
    }
    
    # Try different fix methods
    $fixSuccess = $false
    
    # Method 1: Python fix script
    if (Test-Path "fix_database_timeout.py") {
        Write-Host "🔧 Method 1: Python fix script" -ForegroundColor Cyan
        $fixSuccess = Run-PythonFix -dbPath $DatabasePath
        if ($fixSuccess) {
            Write-Host "✅ Python fix completed successfully!" -ForegroundColor Green
        }
    }
    
    # Method 2: Rust fix (if Python failed or not available)
    if (-not $fixSuccess) {
        Write-Host "🔧 Method 2: Rust fix" -ForegroundColor Cyan
        $fixSuccess = Run-RustFix
        if ($fixSuccess) {
            Write-Host "✅ Rust fix completed successfully!" -ForegroundColor Green
        }
    }
    
    # Method 3: Manual SQL fixes
    if (-not $fixSuccess) {
        Write-Host "🔧 Method 3: Manual SQL fixes" -ForegroundColor Cyan
        Apply-ManualFixes -dbPath $DatabasePath
        Write-Host "📝 Manual fix script created. Please run it with SQLite tools." -ForegroundColor Yellow
    }
    
    # Final test
    Write-Host "`n🧪 Final connectivity test..." -ForegroundColor Cyan
    Test-DatabaseConnectivity -dbPath $DatabasePath
    
    Write-Host "`n🎉 Database fix process completed!" -ForegroundColor Green
    Write-Host "💡 Try running your application again." -ForegroundColor Cyan
    Write-Host "💡 If issues persist, check the backup file and logs." -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Script execution failed: $_" -ForegroundColor Red
    Write-Host "💡 Check the error details and try running individual fix methods." -ForegroundColor Yellow
    exit 1
}