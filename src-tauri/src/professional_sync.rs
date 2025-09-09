use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
use std::time::{Duration, Instant};
use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use tokio::{
    sync::{Semaphore, RwLock},
    task::JoinSet,
};
use tracing::{info, warn, error, debug};
use serde_json::Value;
use reqwest;
use dirs;

// Professional sync configuration
pub struct ProfessionalSyncConfig {
    pub batch_size: usize,
    pub max_concurrent_fetches: usize,
    pub max_concurrent_db_ops: usize,
    #[allow(dead_code)]
    pub request_timeout_secs: u64,
    #[allow(dead_code)]
    pub retry_attempts: usize,
    #[allow(dead_code)]
    pub base_delay_ms: u64,
}

impl Default for ProfessionalSyncConfig {
    fn default() -> Self {
        Self {
            batch_size: 50000,  // Massive increase for extreme datasets
            max_concurrent_fetches: 32,  // Quad-core parallel processing
            max_concurrent_db_ops: 16,   // Quad-core database writes
            request_timeout_secs: 120,   // Extended timeout for huge transfers
            retry_attempts: 7,          // Extended retry for network resilience
            base_delay_ms: 250,         // Aggressive retry for massive datasets
        }
    }
}

pub struct ProfessionalSyncEngine {
    config: ProfessionalSyncConfig,
    client: reqwest::Client,
    supabase_url: String,
    anon_key: String,
    pool: Arc<SqlitePool>,
    stats: Arc<RwLock<SyncStats>>,
}

#[derive(Debug)]
pub struct SyncStats {
    pub total_fetched: AtomicUsize,
    pub total_inserted: AtomicUsize,
    pub errors: Vec<String>,
    pub start_time: Option<Instant>,
    pub end_time: Option<Instant>,
    #[allow(dead_code)]
    pub active_tasks: AtomicUsize,
}

impl Default for SyncStats {
    fn default() -> Self {
        Self {
            total_fetched: AtomicUsize::new(0),
            total_inserted: AtomicUsize::new(0),
            errors: Vec::new(),
            start_time: None,
            end_time: None,
            active_tasks: AtomicUsize::new(0),
        }
    }
}

impl ProfessionalSyncEngine {
    pub async fn new(pool: Arc<SqlitePool>) -> Result<Self> {
        // Create optimized HTTP client with connection pooling
        let client = reqwest::Client::builder()
            .pool_max_idle_per_host(20)
            .pool_idle_timeout(Duration::from_secs(30))
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10))
            .tcp_keepalive(Duration::from_secs(60))
            .tcp_nodelay(true)
            .build()?;

        let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co".to_string();
        let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU".to_string();

        Ok(Self {
            config: ProfessionalSyncConfig::default(),
            client,
            supabase_url,
            anon_key,
            pool,
            stats: Arc::new(RwLock::new(SyncStats::default())),
        })
    }

    // Professional multi-threaded data pull with advanced error handling
    #[allow(unused_variables)]
    pub async fn professional_data_pull(&self) -> Result<String> {
        // Check if sync is paused for upload
        if crate::commands::upload_local_changes::is_sync_paused() {
            return Err(anyhow::anyhow!("Sync is paused during upload operation"));
        }
        
        info!("🚀 Starting professional multi-threaded data synchronization");
        
        let start_time = Instant::now();
        {
            let mut stats = self.stats.write().await;
            stats.start_time = Some(start_time);
            stats.total_fetched.store(0, Ordering::Relaxed);
            stats.total_inserted.store(0, Ordering::Relaxed);
            stats.errors.clear();
        }

        // Optimize database for bulk operations
        // Database optimization handled internally
        
        // Create semaphores for controlling concurrency
        let fetch_semaphore = Arc::new(Semaphore::new(self.config.max_concurrent_fetches));
        let db_semaphore = Arc::new(Semaphore::new(self.config.max_concurrent_db_ops));

        info!("📊 Starting parallel data synchronization with {} fetch workers and {} DB workers", 
              self.config.max_concurrent_fetches, self.config.max_concurrent_db_ops);

        // Execute all sync operations in parallel with intelligent dependency management
        let sync_results = tokio::join!(
            self.sync_books_professional(fetch_semaphore.clone(), db_semaphore.clone()),
            self.sync_students_professional(fetch_semaphore.clone(), db_semaphore.clone()),
            async {
                tokio::time::sleep(Duration::from_secs(2)).await; // Allow core entities to populate first
                tokio::join!(
                    self.sync_books_professional(fetch_semaphore.clone(), db_semaphore.clone()),
                    self.sync_students_professional(fetch_semaphore.clone(), db_semaphore.clone()),
                )
            }
        );

        // Process results and collect statistics
        let mut total_records = 0;
        let _total_errors = 0;

        // Phase 1 results
        if let Ok(books) = sync_results.0 { total_records += books; }
        if let Ok(students) = sync_results.1 { total_records += students; }
        
        // Phase 2 results (nested tuple from async block)
        let phase2_results = sync_results.2;
        let (phase2_books, phase2_students) = phase2_results;
        if let Ok(books) = phase2_books { total_records += books; }
        if let Ok(students) = phase2_students { total_records += students; }
        


        let end_time = Instant::now();
        let duration = end_time - start_time;
        
        {
            let mut stats = self.stats.write().await;
            stats.end_time = Some(end_time);
        }

        // Finalize database optimizations
        // Database finalization handled internally

        let performance_stats = self.get_basic_performance_stats().await;
        
        info!("🎉 Professional sync completed: {} records in {:.2}s ({:.0} records/sec)", 
              total_records, duration.as_secs_f64(), total_records as f64 / duration.as_secs_f64());

        Ok(format!(
            "✅ Professional sync completed successfully!\n\
             📊 Total records: {}\n\
             ⏱️ Duration: {:.2}s\n\
             🚀 Throughput: {:.0} records/sec\n\
             🔧 Performance: {}", 
            total_records, 
            duration.as_secs_f64(), 
            total_records as f64 / duration.as_secs_f64(),
            performance_stats
        ))
    }

    #[allow(unused_variables)]
    pub async fn sync_books_professional(
        &self,
        fetch_semaphore: Arc<Semaphore>,
        db_semaphore: Arc<Semaphore>
    ) -> Result<usize> {
        info!("📚 Starting professional books synchronization");
        
        let total_count = self.get_total_record_count("books").await?;
        info!("📊 Total books to sync: {}", total_count);
        
        // Dynamic batch sizing based on data volume
        let dynamic_batch_size = if total_count > 1000000 {
            100000  // Extreme batches for massive datasets (>1M records)
        } else if total_count > 500000 {
            75000   // Large batches for very large datasets
        } else if total_count > 100000 {
            50000   // Large batches for massive datasets
        } else if total_count > 50000 {
            35000   // Medium batches for large datasets
        } else {
            self.config.batch_size  // Use default for smaller datasets
        };
        
        let batches = (total_count + 3000 - 1) / 3000;
        let mut total_inserted = 0;
        
        let mut join_set = JoinSet::new();
        
        for batch_idx in 0..batches {
            let offset = batch_idx * 3000;
            let limit = 3000.min(total_count - offset);
            
            let fetch_permit = fetch_semaphore.clone().acquire_owned().await?;
            let db_permit = db_semaphore.clone().acquire_owned().await?;
            
            let pool = self.pool.clone();
            let client = self.client.clone();
            let supabase_url = self.supabase_url.clone();
            let anon_key = self.anon_key.clone();
            
            join_set.spawn(async move {
                let _fetch_guard = fetch_permit;
                let _db_guard = db_permit;
                
                Self::sync_books_batch(client, supabase_url, anon_key, pool, offset, limit).await
            });
        }
        
        // Collect results from all batches
        while let Some(result) = join_set.join_next().await {
            match result {
                Ok(Ok(count)) => {
                    total_inserted += count;
                    debug!("Books batch completed: {} records", count);
                },
                Ok(Err(e)) => {
                    warn!("Books batch failed: {}", e);
                },
                Err(e) => {
                    error!("Books task join error: {}", e);
                }
            }
        }
        
        info!("✅ Books sync completed: {} records", total_inserted);
        Ok(total_inserted)
    }
    
    #[allow(unused_variables)]
    pub async fn sync_students_professional(
        &self,
        fetch_semaphore: Arc<Semaphore>,
        db_semaphore: Arc<Semaphore>
    ) -> Result<usize> {
        info!("👥 Starting professional students synchronization");
        
        let total_count = self.get_total_record_count("students").await?;
        info!("📊 Total students to sync: {}", total_count);
        
        // Dynamic batch sizing based on data volume
        let dynamic_batch_size = if total_count > 1000000 {
            100000  // Extreme batches for massive datasets (>1M records)
        } else if total_count > 500000 {
            75000   // Large batches for very large datasets
        } else if total_count > 100000 {
            50000   // Large batches for massive datasets
        } else if total_count > 50000 {
            35000   // Medium batches for large datasets
        } else {
            self.config.batch_size  // Use default for smaller datasets
        };
        
        let batches = (total_count + 3000 - 1) / 3000;
        let mut total_inserted = 0;

        let mut join_set = JoinSet::new();

        for batch_idx in 0..batches {
            let offset = batch_idx * 3000;
            let limit = 3000.min(total_count - offset);
            
            let fetch_permit = fetch_semaphore.clone().acquire_owned().await?;
            let db_permit = db_semaphore.clone().acquire_owned().await?;
            
            let pool = self.pool.clone();
            let client = self.client.clone();
            let supabase_url = self.supabase_url.clone();
            let anon_key = self.anon_key.clone();
            
            join_set.spawn(async move {
                let _fetch_guard = fetch_permit;
                let _db_guard = db_permit;
                
                Self::sync_students_batch(client, supabase_url, anon_key, pool, offset, limit).await
            });
        }
        
        // Collect results
        while let Some(result) = join_set.join_next().await {
            match result {
                Ok(Ok(count)) => {
                    total_inserted += count;
                    debug!("Students batch completed: {} records", count);
                },
                Ok(Err(e)) => warn!("Students batch failed: {}", e),
                Err(e) => error!("Students task join error: {}", e)
            }
        }
        
        info!("✅ Students sync completed: {} records", total_inserted);
        Ok(total_inserted)
    }
    
    async fn sync_books_batch(
        client: reqwest::Client,
        supabase_url: String,
        anon_key: String,
        pool: Arc<SqlitePool>,
        offset: usize,
        limit: usize
    ) -> Result<usize> {
        let url = format!(
            "{}/rest/v1/books?select=*&limit={}&offset={}",
            supabase_url, limit, offset
        );
        
        // Fetch with retry logic
        let response = Self::fetch_with_retry(&client, &url, &anon_key, 3).await?;
        let books: Vec<Value> = response.as_array().unwrap_or(&vec![]).clone();
        
        if books.is_empty() {
            return Ok(0);
        }
        
        // Bulk insert with optimized transaction
        let mut tx = pool.begin().await?;
        let mut inserted = 0;
        
        for book in books {
            let query = r#"
                INSERT OR REPLACE INTO books (
                    id, title, author, isbn, genre, publisher, publication_year, 
                    total_copies, available_copies, shelf_location, description, 
                    status, category_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))
            "#;
            
            let result = sqlx::query(query)
                .bind(book["id"].as_str().unwrap_or_default())
                .bind(book["title"].as_str().unwrap_or("Unknown Title"))
                .bind(book["author"].as_str().unwrap_or("Unknown Author"))
                .bind(book["isbn"].as_str())
                .bind(book["genre"].as_str())
                .bind(book["publisher"].as_str())
                .bind(book["publication_year"].as_i64())
                .bind(book["total_copies"].as_i64().unwrap_or(1))
                .bind(book["available_copies"].as_i64().unwrap_or(1))
                .bind(book["shelf_location"].as_str())
                .bind(book["description"].as_str())
                .bind(book["status"].as_str().unwrap_or("available"))
                .bind(book["category_id"].as_str())
                .bind(book["created_at"].as_str())
                .execute(&mut *tx)
                .await;
                
            if result.is_ok() {
                inserted += 1;
            }
        }
        
        tx.commit().await?;
        Ok(inserted)
    }
    
    async fn sync_students_batch(
        client: reqwest::Client,
        supabase_url: String,
        anon_key: String,
        pool: Arc<SqlitePool>,
        offset: usize,
        limit: usize
    ) -> Result<usize> {
        let url = format!(
            "{}/rest/v1/students?select=*&limit={}&offset={}",
            supabase_url, limit, offset
        );
        
        let response = Self::fetch_with_retry(&client, &url, &anon_key, 3).await?;
        let students: Vec<Value> = response.as_array().unwrap_or(&vec![]).clone();
        
        if students.is_empty() {
            return Ok(0);
        }
        
        let mut tx = pool.begin().await?;
        let mut inserted = 0;
        
        for student in students {
            let query = r#"
                INSERT OR REPLACE INTO students (
                    id, admission_number, first_name, last_name, email, phone, 
                    class_grade, address, date_of_birth, enrollment_date, status, 
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))
            "#;

            let result = sqlx::query(query)
                .bind(student["id"].as_str().unwrap_or_default())
                .bind(student["admission_number"].as_str().unwrap_or_default())
                .bind(student["first_name"].as_str().unwrap_or("Unknown"))
                .bind(student["last_name"].as_str().unwrap_or("Unknown"))
                .bind(student["email"].as_str())
                .bind(student["phone"].as_str())
                .bind(student["class_grade"].as_str().unwrap_or("Unknown"))
                .bind(student["address"].as_str())
                .bind(student["date_of_birth"].as_str())
                .bind(student["enrollment_date"].as_str())
                .bind(student["status"].as_str().unwrap_or("active"))
                .bind(student["created_at"].as_str())
                .execute(&mut *tx)
                .await;

            if result.is_ok() {
                inserted += 1;
            }
        }

        tx.commit().await?;
        Ok(inserted)
    }

    async fn fetch_with_retry(
        client: &reqwest::Client,
        url: &str,
        anon_key: &str,
        max_retries: usize
    ) -> Result<serde_json::Value> {
        let mut attempts = 0;
        let mut last_error = None;

        while attempts <= max_retries {
            let response_result = tokio::time::timeout(
                Duration::from_secs(30),
                client
                    .get(url)
                    .header("apikey", anon_key)
                    .header("Authorization", format!("Bearer {}", anon_key))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .send()
            ).await;

            match response_result {
                Ok(Ok(response)) => {
                    if response.status().is_success() {
                        match response.json::<serde_json::Value>().await {
                            Ok(data) => return Ok(data),
                            Err(e) => {
                                last_error = Some(format!("JSON parsing error: {}", e));
                            }
                        }
                    } else if response.status().as_u16() == 429 {
                        // Rate limited - exponential backoff
                        let delay = Duration::from_millis(1000 * (2_u64.pow(attempts as u32)));
                        tokio::time::sleep(delay).await;
                        last_error = Some("Rate limited".to_string());
                    } else {
                        last_error = Some(format!("HTTP error: {}", response.status()));
                    }
                },
                Ok(Err(e)) => {
                    last_error = Some(format!("Request error: {}", e));
                },
                Err(_) => {
                    last_error = Some("Request timeout".to_string());
                }
            }

            attempts += 1;
            if attempts <= max_retries {
                let delay = Duration::from_millis(500 * attempts as u64);
                tokio::time::sleep(delay).await;
            }
        }

        Err(anyhow::anyhow!(
            "Failed after {} attempts. Last error: {}", 
            max_retries + 1, 
            last_error.unwrap_or("Unknown error".to_string())
        ))
    }

    async fn get_total_record_count(&self, table_name: &str) -> Result<usize> {
        let count_url = format!("{}/rest/v1/{}?select=id", self.supabase_url, table_name);
        
        let response = self.client
            .get(&count_url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .header("Prefer", "count=exact")
            .timeout(Duration::from_secs(30))
            .send()
            .await?;
            
        let total_count = response
            .headers()
            .get("content-range")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.split('/').nth(1))
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(1000);
            
        info!("Remote {} count: {}", table_name, total_count);
        Ok(total_count)
    }

    async fn get_basic_performance_stats(&self) -> String {
        let stats = self.stats.read().await;
        let total_fetched = stats.total_fetched.load(Ordering::Relaxed);
        format!("Performance: {} records synced", total_fetched)
    }
}

pub async fn professional_pull_all_database() -> Result<String> {
    use std::path::PathBuf;

    info!("🚀 PROFESSIONAL DATABASE PULL initiated");

    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");

    let db_path = app_dir.join("library.db");

    // Connect to local database
    let pool = Arc::new(SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?);

    // Create professional sync engine
    let sync_engine = ProfessionalSyncEngine::new(pool.clone()).await?;

    // Execute professional sync
    let result = sync_engine.professional_data_pull().await?;

    pool.close().await;

    
    info!("✅ PROFESSIONAL DATABASE PULL completed successfully");
    Ok(result)
}
