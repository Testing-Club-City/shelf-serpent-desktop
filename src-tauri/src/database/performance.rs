use sqlx::{Pool, Sqlite, SqlitePool, Row};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore, Mutex as AsyncMutex};
use std::collections::HashMap;
use uuid::Uuid;
use crate::models::{Book, Student, Staff, Category, BookCopy, Borrowing, BookWithDetails, BorrowingWithDetails};
use anyhow::Result;
use tracing::{info, warn, error, instrument};
use std::time::{SystemTime, UNIX_EPOCH, Instant, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry<T> {
    data: T,
    timestamp: u64,
    expires_at: u64,
}

impl<T> CacheEntry<T> {
    fn new(data: T, ttl_seconds: u64) -> Self {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        Self {
            data,
            timestamp: now,
            expires_at: now + ttl_seconds,
        }
    }

    fn is_expired(&self) -> bool {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        now > self.expires_at
    }
}

type Cache<T> = Arc<RwLock<HashMap<String, CacheEntry<T>>>>;

#[derive(Clone)]
pub struct PerformanceDatabase {
    pool: SqlitePool,
    connection_semaphore: Arc<Semaphore>,
    query_cache: Cache<serde_json::Value>,
    // Background task handles
    cache_warmer_handle: Arc<AsyncMutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl PerformanceDatabase {
    pub async fn new(database_url: &str) -> Result<Self> {
        info!("🚀 Creating high-performance database with advanced optimizations...");
        
        // Configure connection pool for maximum performance
        let pool = SqlitePool::connect_with(
            sqlx::sqlite::SqliteConnectOptions::new()
                .filename(database_url)
                .create_if_missing(true)
                // Advanced SQLite performance optimizations
                .pragma("journal_mode", "WAL")           // Write-Ahead Logging
                .pragma("synchronous", "NORMAL")         // Balance safety/performance
                .pragma("cache_size", "50000")           // 50MB cache (10,000 pages * 4KB)
                .pragma("temp_store", "MEMORY")          // Temp tables in memory
                .pragma("mmap_size", "1073741824")       // 1GB memory map
                .pragma("page_size", "4096")             // Optimal page size
                .pragma("optimize", "1")                 // Auto-optimize
                .pragma("wal_autocheckpoint", "1000")    // WAL checkpoint interval
                .pragma("busy_timeout", "5000")          // 5 second busy timeout
        ).await?;
        
        // Set optimal connection pool size based on CPU cores
        let max_connections = std::thread::available_parallelism()
            .map(|p| p.get().min(20))
            .unwrap_or(8);
        
        let connection_semaphore = Arc::new(Semaphore::new(max_connections));
        
        info!("✅ Performance database initialized with {} max connections", max_connections);
        
        let db = Self {
            pool,
            connection_semaphore,
            query_cache: Arc::new(RwLock::new(HashMap::new())),
            cache_warmer_handle: Arc::new(AsyncMutex::new(None)),
        };

        // Start background cache warming
        db.start_background_tasks().await;

        Ok(db)
    }

    async fn start_background_tasks(&self) {
        let db = self.clone();
        let handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(120)); // Every 2 minutes
            
            loop {
                interval.tick().await;
                
                info!("🔄 Background cache warming started");
                let start = Instant::now();
                
                // Pre-warm frequently accessed data
                let _ = tokio::join!(
                    db.warm_books_cache(),
                    db.warm_students_cache(),
                    db.warm_dashboard_stats(),
                    db.optimize_database(),
                );
                
                info!("✅ Background tasks completed in {:?}", start.elapsed());
            }
        });
        
        *self.cache_warmer_handle.lock().await = Some(handle);
    }

    async fn get_cached_query<T>(&self, cache_key: &str, ttl_seconds: u64) -> Option<T> 
    where 
        T: Clone + for<'de> Deserialize<'de>,
    {
        let cache = self.query_cache.read().await;
        if let Some(entry) = cache.get(cache_key) {
            if !entry.is_expired() {
                if let Ok(data) = serde_json::from_value(entry.data.clone()) {
                    return Some(data);
                }
            }
        }
        None
    }

    async fn set_cached_query<T>(&self, cache_key: &str, data: &T, ttl_seconds: u64) 
    where 
        T: Serialize,
    {
        if let Ok(json_data) = serde_json::to_value(data) {
            let mut cache = self.query_cache.write().await;
            cache.insert(cache_key.to_string(), CacheEntry::new(json_data, ttl_seconds));
        }
    }

    #[instrument(skip(self))]
    pub async fn get_books_performance_optimized(&self) -> Result<Vec<BookWithDetails>> {
        let cache_key = "books_with_details";
        
        // Check cache first
        if let Some(cached) = self.get_cached_query::<Vec<BookWithDetails>>(cache_key, 300).await {
            return Ok(cached);
        }

        let _permit = self.connection_semaphore.acquire().await.unwrap();
        let start_time = Instant::now();

        // Optimized query with proper indexing hints
        let books = sqlx::query_as!(
            BookWithDetails,
            r#"
            SELECT 
                b.id,
                b.title,
                b.author,
                b.isbn,
                b.category_id,
                b.image_url,
                b.description,
                b.created_at,
                b.updated_at,
                c.name as category_name,
                COALESCE(bc_stats.total_copies, 0) as total_copies,
                COALESCE(bc_stats.available_copies, 0) as available_copies
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.id
            LEFT JOIN (
                SELECT 
                    book_id,
                    COUNT(*) as total_copies,
                    SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_copies
                FROM book_copies 
                GROUP BY book_id
            ) bc_stats ON b.id = bc_stats.book_id
            ORDER BY b.title
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let duration = start_time.elapsed();
        info!("📚 Performance: Fetched {} books in {:?}", books.len(), duration);
        
        // Cache the result
        self.set_cached_query(cache_key, &books, 300).await;
        
        Ok(books)
    }

    #[instrument(skip(self))]
    pub async fn search_books_performance(&self, query: &str, limit: i64) -> Result<Vec<Book>> {
        let cache_key = format!("search_books_{}_{}", query, limit);
        
        if let Some(cached) = self.get_cached_query::<Vec<Book>>(&cache_key, 60).await {
            return Ok(cached);
        }

        let _permit = self.connection_semaphore.acquire().await.unwrap();
        let start_time = Instant::now();

        let search_pattern = format!("%{}%", query);
        
        // Use full-text search if available, otherwise use LIKE with optimization
        let books = sqlx::query_as!(
            Book,
            r#"
            SELECT id, title, author, isbn, category_id, image_url, description, created_at, updated_at
            FROM books 
            WHERE (
                title LIKE ?1 COLLATE NOCASE OR 
                author LIKE ?1 COLLATE NOCASE OR 
                isbn LIKE ?1 COLLATE NOCASE
            )
            ORDER BY 
                (CASE 
                    WHEN title LIKE ?1 THEN 1
                    WHEN author LIKE ?1 THEN 2
                    WHEN isbn LIKE ?1 THEN 3
                    ELSE 4
                END),
                title COLLATE NOCASE
            LIMIT ?2
            "#,
            search_pattern, search_pattern, search_pattern,
            search_pattern, search_pattern, search_pattern,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        let duration = start_time.elapsed();
        info!("🔍 Performance: Search '{}' returned {} results in {:?}", query, books.len(), duration);
        
        self.set_cached_query(&cache_key, &books, 60).await;
        
        Ok(books)
    }

    #[instrument(skip(self))]
    pub async fn get_students_performance(&self) -> Result<Vec<Student>> {
        let cache_key = "students_all";
        
        if let Some(cached) = self.get_cached_query::<Vec<Student>>(cache_key, 600).await {
            return Ok(cached);
        }

        let _permit = self.connection_semaphore.acquire().await.unwrap();
        let start_time = Instant::now();

        let students = sqlx::query_as!(
            Student,
            r#"
            SELECT * FROM students 
            ORDER BY first_name COLLATE NOCASE, last_name COLLATE NOCASE
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let duration = start_time.elapsed();
        info!("👥 Performance: Fetched {} students in {:?}", students.len(), duration);
        
        self.set_cached_query(cache_key, &students, 600).await;
        
        Ok(students)
    }

    #[instrument(skip(self))]
    pub async fn get_dashboard_stats_performance(&self) -> Result<serde_json::Value> {
        let cache_key = "dashboard_stats";
        
        if let Some(cached) = self.get_cached_query::<serde_json::Value>(cache_key, 30).await {
            return Ok(cached);
        }

        let _permit = self.connection_semaphore.acquire().await.unwrap();
        let start_time = Instant::now();

        // Execute all stats queries in parallel for maximum performance
        let (total_books, total_students, active_borrowings, overdue_count, available_books) = tokio::join!(
            sqlx::query!("SELECT COUNT(*) as count FROM books").fetch_one(&self.pool),
            sqlx::query!("SELECT COUNT(*) as count FROM students").fetch_one(&self.pool),
            sqlx::query!("SELECT COUNT(*) as count FROM borrowings WHERE returned_at IS NULL").fetch_one(&self.pool),
            sqlx::query!("SELECT COUNT(*) as count FROM borrowings WHERE returned_at IS NULL AND due_date < date('now')").fetch_one(&self.pool),
            sqlx::query!("SELECT COUNT(*) as count FROM book_copies WHERE status = 'available'").fetch_one(&self.pool)
        );

        let stats = serde_json::json!({
            "total_books": total_books?.count,
            "total_students": total_students?.count,
            "active_borrowings": active_borrowings?.count,
            "overdue_books": overdue_count?.count,
            "available_books": available_books?.count,
            "last_updated": chrono::Utc::now().to_rfc3339()
        });

        let duration = start_time.elapsed();
        info!("📊 Performance: Generated dashboard stats in {:?}", duration);
        
        self.set_cached_query(cache_key, &stats, 30).await;
        
        Ok(stats)
    }

    // Batch operations with transaction optimization
    #[instrument(skip(self, books))]
    pub async fn create_books_batch_performance(&self, books: Vec<Book>) -> Result<usize> {
        let _permit = self.connection_semaphore.acquire().await.unwrap();
        let start_time = Instant::now();
        
        let mut tx = self.pool.begin().await?;
        let mut success_count = 0;

        // Use batch insert for better performance
        for chunk in books.chunks(100) { // Process in chunks of 100
            let mut query_parts = Vec::new();
            let mut values = Vec::new();
            
            for (i, book) in chunk.iter().enumerate() {
                let base = i * 9;
                query_parts.push(format!("(?{}, ?{}, ?{}, ?{}, ?{}, ?{}, ?{}, ?{}, ?{})", 
                    base + 1, base + 2, base + 3, base + 4, base + 5, base + 6, base + 7, base + 8, base + 9));
                
                values.extend([
                    book.id.to_string(),
                    book.title.clone(),
                    book.author.clone(),
                    book.isbn.clone().unwrap_or_default(),
                    book.category_id.map(|id| id.to_string()).unwrap_or_default(),
                    book.image_url.clone().unwrap_or_default(),
                    book.description.clone().unwrap_or_default(),
                    book.created_at.to_rfc3339(),
                    book.updated_at.to_rfc3339(),
                ]);
            }
            
            let query = format!(
                "INSERT OR REPLACE INTO books (id, title, author, isbn, category_id, image_url, description, created_at, updated_at) VALUES {}",
                query_parts.join(", ")
            );
            
            let result = sqlx::query(&query);
            let mut query_with_values = result;
            for value in &values {
                query_with_values = query_with_values.bind(value);
            }
            
            match query_with_values.execute(&mut *tx).await {
                Ok(result) => success_count += result.rows_affected() as usize,
                Err(e) => warn!("Failed to insert book batch: {:?}", e),
            }
        }

        tx.commit().await?;
        
        // Invalidate related caches
        self.invalidate_cache("books").await;
        
        let duration = start_time.elapsed();
        info!("📚 Performance: Batch created {} books in {:?}", success_count, duration);
        
        Ok(success_count)
    }

    async fn warm_books_cache(&self) {
        if let Err(e) = self.get_books_performance_optimized().await {
            warn!("Failed to warm books cache: {:?}", e);
        }
    }

    async fn warm_students_cache(&self) {
        if let Err(e) = self.get_students_performance().await {
            warn!("Failed to warm students cache: {:?}", e);
        }
    }

    async fn warm_dashboard_stats(&self) {
        if let Err(e) = self.get_dashboard_stats_performance().await {
            warn!("Failed to warm dashboard stats: {:?}", e);
        }
    }

    async fn optimize_database(&self) {
        let _permit = self.connection_semaphore.acquire().await.unwrap();
        
        // Run SQLite optimization commands
        let optimizations = [
            "PRAGMA optimize",
            "PRAGMA wal_checkpoint(TRUNCATE)",
        ];
        
        for cmd in &optimizations {
            if let Err(e) = sqlx::query(cmd).execute(&self.pool).await {
                warn!("Database optimization command '{}' failed: {:?}", cmd, e);
            }
        }
    }

    pub async fn invalidate_cache(&self, cache_type: &str) {
        let mut cache = self.query_cache.write().await;
        
        let keys_to_remove: Vec<String> = cache.keys()
            .filter(|key| key.starts_with(cache_type) || cache_type == "all")
            .cloned()
            .collect();
        
        for key in keys_to_remove {
            cache.remove(&key);
        }
        
        info!("🗑️ Invalidated {} cache entries for '{}'", cache.len(), cache_type);
    }

    pub async fn get_performance_metrics(&self) -> Result<serde_json::Value> {
        let cache_size = self.query_cache.read().await.len();
        let pool_size = self.pool.size();
        let available_permits = self.connection_semaphore.available_permits();
        
        Ok(serde_json::json!({
            "cache_entries": cache_size,
            "pool_size": pool_size,
            "available_connections": available_permits,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))
    }
}
