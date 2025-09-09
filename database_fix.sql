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
