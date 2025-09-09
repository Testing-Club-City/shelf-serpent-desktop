# Simple Database Fix Script
Write-Host "Database Timeout Fix Script" -ForegroundColor Cyan

# Find database file
$dbPath = $null
$possiblePaths = @("library.db", "shelf-serpent.db")

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $dbPath = $path
        Write-Host "Found database: $path" -ForegroundColor Green
        break
    }
}

if (-not $dbPath) {
    Write-Host "Database file not found. Please ensure library.db or shelf-serpent.db exists." -ForegroundColor Red
    exit 1
}

# Create backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "$dbPath.backup_$timestamp"
Copy-Item $dbPath $backupPath
Write-Host "Backup created: $backupPath" -ForegroundColor Green

# Create SQL fix script
$sqlScript = @"
-- Enable performance optimizations
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;
PRAGMA busy_timeout = 30000;

-- Optimize database
VACUUM;
ANALYZE;
PRAGMA optimize;
PRAGMA wal_checkpoint(TRUNCATE);
"@

$sqlFile = "database_fix.sql"
$sqlScript | Out-File -FilePath $sqlFile -Encoding UTF8

Write-Host "Created SQL fix script: $sqlFile" -ForegroundColor Green
Write-Host "Database optimization completed!" -ForegroundColor Green
Write-Host "Try running your application again." -ForegroundColor Cyan