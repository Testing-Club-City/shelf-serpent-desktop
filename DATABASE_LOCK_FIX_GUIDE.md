# Database Lock Fix Guide

## Problem Summary
Your application is experiencing SQLite database locking issues with error code 5 ("database is locked") during book copy sync operations. The INSERT OR REPLACE operations are taking 6+ seconds each, causing timeouts and locks.

## Root Causes
1. **Inefficient INSERT OR REPLACE operations** on large datasets
2. **Long-running transactions** without proper timeout handling  
3. **Missing WAL mode configuration** for better concurrency
4. **Inadequate database connection settings**
5. **Concurrent access** to the same database file

## Immediate Fix (Run This Now)

### Option 1: PowerShell Script (Recommended)
```powershell
# Run this in PowerShell from the project root
.\run_emergency_fix.ps1
```

### Option 2: Manual Compilation
```bash
# Navigate to src-tauri directory
cd src-tauri

# Compile the fix
cargo build --bin fix_database_locks --release

# Run the fix
./target/release/fix_database_locks
```

## What the Emergency Fix Does

1. **Switches to WAL Mode**: Enables Write-Ahead Logging for better concurrency
2. **Optimizes SQLite Settings**: 
   - Sets proper cache size (32MB)
   - Configures busy timeout (10 seconds)
   - Enables memory temp storage
   - Sets WAL autocheckpoint
3. **Creates Missing Indexes**: Adds optimized indexes for book_copies table
4. **Checkpoints WAL**: Clears any pending WAL data
5. **Analyzes Tables**: Updates query planner statistics

## Long-term Solutions Implemented

### 1. Database Configuration Improvements
- **File**: `src/database/mod.rs` (updated)
- **Changes**: Optimized SQLite PRAGMA settings for all connections

### 2. Optimized Sync Operations  
- **File**: `src/optimized_book_copies_sync.rs` (new)
- **Features**:
  - Smaller batch sizes (100 instead of 1000)
  - Shorter transaction timeouts (3-10 seconds)
  - INSERT OR IGNORE + UPDATE pattern (faster than INSERT OR REPLACE)
  - Connection pooling with optimized settings

### 3. Database Lock Prevention
- **File**: `src/database_lock_fix.rs` (new)
- **Features**:
  - Comprehensive lock detection and prevention
  - Batch upsert operations with timeout handling
  - Database health monitoring

## Performance Optimizations Applied

### SQLite Configuration
```sql
PRAGMA journal_mode = WAL;           -- Better concurrency
PRAGMA synchronous = NORMAL;         -- Balanced safety/performance  
PRAGMA cache_size = -32000;          -- 32MB cache
PRAGMA temp_store = memory;          -- Temp tables in RAM
PRAGMA busy_timeout = 10000;         -- 10 second timeout
PRAGMA wal_autocheckpoint = 100;     -- Frequent checkpoints
```

### Optimized Indexes
```sql
CREATE INDEX idx_book_copies_id_opt ON book_copies(id);
CREATE INDEX idx_book_copies_legacy_opt ON book_copies(legacy_book_id) WHERE legacy_book_id IS NOT NULL;
CREATE INDEX idx_book_copies_sync_opt ON book_copies(synced, sync_version);
```

## Monitoring and Prevention

### Check Database Health
```rust
// Use the health check function
check_database_health().await?;
```

### Monitor WAL Size
```sql
PRAGMA wal_checkpoint;  -- Returns (busy, log_size, checkpointed)
```

### Best Practices Going Forward

1. **Use Smaller Batches**: Process 50-100 records per transaction instead of 1000
2. **Set Timeouts**: Always set busy_timeout and transaction timeouts
3. **Monitor WAL Size**: Checkpoint regularly to prevent WAL from growing too large
4. **Use Connection Pooling**: Reuse connections instead of creating new ones
5. **Avoid Long Transactions**: Keep transactions short and focused

## Troubleshooting

### If Locks Still Occur
1. Check if multiple processes are accessing the database
2. Verify WAL mode is enabled: `PRAGMA journal_mode;`
3. Monitor WAL file size in the database directory
4. Consider reducing batch sizes further

### Performance Monitoring
```sql
-- Check current settings
PRAGMA journal_mode;
PRAGMA synchronous;  
PRAGMA cache_size;
PRAGMA busy_timeout;

-- Check database size
SELECT page_count * page_size / 1024 / 1024 as size_mb 
FROM pragma_page_count(), pragma_page_size();
```

## Files Modified/Created

### Modified Files
- `src/database/mod.rs` - Updated database initialization with optimized settings

### New Files  
- `src/database_lock_fix.rs` - Comprehensive lock prevention utilities
- `src/optimized_book_copies_sync.rs` - Lock-free sync implementation
- `fix_database_locks.rs` - Emergency fix executable
- `run_emergency_fix.ps1` - PowerShell script to run the fix
- `DATABASE_LOCK_FIX_GUIDE.md` - This guide

## Expected Results

After applying these fixes:
- ✅ INSERT operations should complete in <100ms instead of 6+ seconds
- ✅ No more "database is locked" errors
- ✅ Better concurrent access handling
- ✅ Improved overall application performance
- ✅ More reliable sync operations

## Support

If you continue to experience issues after applying these fixes:
1. Check the application logs for specific error messages
2. Verify the emergency fix completed successfully
3. Restart the application to pick up new database settings
4. Monitor the WAL file size in the database directory

The optimizations should resolve the locking issues and significantly improve performance.