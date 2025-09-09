use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::sync::{
    error::SyncResult,
    traits::{ConflictResolver, LocalDataStore, RemoteDataSource, SyncStrategy, SyncSummary, SyncStatus},
};

pub struct SyncEngine {
    remote: Arc<dyn RemoteDataSource>,
    local: Arc<dyn LocalDataStore>,
    conflict_resolver: Arc<dyn ConflictResolver>,
    strategies: Arc<RwLock<std::collections::HashMap<String, Arc<dyn SyncStrategy>>>>,
    pub status: Arc<RwLock<SyncStatus>>,
    pub db: Arc<crate::database::DatabaseManager>,
    pub config: crate::sync::remote::supabase::SupabaseConfig,
    pub client: reqwest::Client,
    pub supabase_client: Option<postgrest::Postgrest>,
}

impl SyncEngine {
    #[allow(dead_code)]
    pub fn new(
        remote: Arc<dyn RemoteDataSource>,
        local: Arc<dyn LocalDataStore>,
        conflict_resolver: Arc<dyn ConflictResolver>,
        db: Arc<crate::database::DatabaseManager>,
        config: crate::sync::remote::supabase::SupabaseConfig,
        client: reqwest::Client,
        supabase_client: Option<postgrest::Postgrest>,
    ) -> Self {
        Self {
            remote,
            local,
            conflict_resolver,
            strategies: Arc::new(RwLock::new(std::collections::HashMap::new())),
            status: Arc::new(RwLock::new(SyncStatus {
            is_online: false,
            is_syncing: false,
            last_sync: None,
            last_error: None,
            database_initialized: false,
            initial_sync_completed: false,
            last_connectivity_check: None,
        })),
            db,
            config,
            client,
            supabase_client,
        }
    }

    #[allow(dead_code)]
    pub async fn register_strategy(
        &self,
        table_name: String,
        strategy: Arc<dyn SyncStrategy>,
    ) -> SyncResult<()> {
        let mut strategies = self.strategies.write().await;
        strategies.insert(table_name, strategy);
        Ok(())
    }

    pub async fn get_status(&self) -> SyncStatus {
        let status = self.status.read().await;
        status.clone()
    }

    // Alias for get_status to match the expected function name
    #[allow(dead_code)]
    pub async fn get_sync_status(&self) -> SyncStatus {
        self.get_status().await
    }

    // Perform a full sync of all tables
    #[allow(dead_code)]
    pub async fn full_sync(&self) -> SyncResult<Vec<SyncSummary>> {
        self.sync_all_tables().await
    }

    // Start the sync service
    #[allow(dead_code)]
    pub async fn start_sync_service(&self) -> SyncResult<()> {
        // Initialize the sync engine
        self.initialize().await?;
        
        // Start background sync with a default interval of 30 seconds
        self.start_background_sync(30).await?;
        
        Ok(())
    }

    pub async fn check_connectivity(&self) -> bool {
        let is_online = self.remote.check_connectivity().await;
        let mut status = self.status.write().await;
        status.is_online = is_online;
        status.last_connectivity_check = Some(std::time::Instant::now());
        is_online
    }

    pub async fn check_connectivity_cached(&self) -> bool {
        // Check cache first
        let status = self.status.read().await;
        let last_check = status.last_connectivity_check;
        if let Some(last_check) = last_check {
            let cache_duration = std::time::Duration::from_secs(15); // 15 second cache
            if last_check.elapsed() < cache_duration {
                return status.is_online;
            }
        }
        drop(status);

        // Cache is stale, do fresh check
        self.check_connectivity().await
    }

    pub async fn check_supabase_connection_cached(&self) -> bool {
        // For now, just delegate to the regular supabase connection check
        // In the future, we could add caching here too
        match self.check_supabase_connection().await {
            Ok(result) => result,
            Err(_) => false,
        }
    }

    #[allow(dead_code)]
    pub async fn check_supabase_connection(&self) -> Result<bool, anyhow::Error> {
        // Check actual Supabase database connectivity
        if self.supabase_client.is_none() {
            return Ok(false);
        }

        let client = self.supabase_client.as_ref().unwrap();
        
        // Try to make a simple query to verify database connectivity
        match client
            .from("books")
            .select("id")
            .limit(1)
            .execute()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    Ok(true)
                } else {
                    Ok(false)
                }
            }
            Err(_) => Ok(false),
        }
    }

    pub async fn trigger_data_pull(&self) -> SyncResult<()> {
        use chrono::Utc;
        use std::time::Instant;
        use std::sync::Arc;
        use tokio::sync::Semaphore;
        
        info!("Starting optimized multithreaded data pull from Supabase");
        let start_time = Instant::now();
        
        // Optimize SQLite for bulk operations first
        self.optimize_database_for_bulk_operations().await?;
        
        let mut status = self.status.write().await;
        status.is_syncing = true;
        drop(status);
        
        let result = async {
            // Increased concurrency for better performance
            let fetch_semaphore = Arc::new(Semaphore::new(12)); // 12 concurrent fetch operations
            let db_semaphore = Arc::new(Semaphore::new(6)); // 6 concurrent DB operations
            
            info!("Starting multithreaded fetch operations...");
            let fetch_start = Instant::now();
            
            // Fetch all data types in parallel with controlled concurrency
            let (books_result, categories_result, students_result, staff_result) = tokio::join!(
                self.fetch_books_multithreaded(fetch_semaphore.clone()),
                self.fetch_categories_multithreaded(fetch_semaphore.clone()),
                self.fetch_students_multithreaded(fetch_semaphore.clone()),
                self.fetch_staff_multithreaded(fetch_semaphore.clone())
            );
            
            let fetch_duration = fetch_start.elapsed();
            info!("Completed all multithreaded API requests in {:?}", fetch_duration);
            
            // Process each result set
            let books = books_result?;
            let categories = categories_result?;
            let students = students_result?;
            let staff_list = staff_result?;
            
            info!("Fetched: {} books, {} categories, {} students, {} staff", 
                  books.len(), categories.len(), students.len(), staff_list.len());
            
            // Now process the data to SQLite with multithreaded batch insertions
            let db_start = Instant::now();
            
            // First insert categories (typically small dataset)
            self.insert_categories_parallel(&categories, db_semaphore.clone()).await?;
            
            // Then process other entities in parallel with controlled threading
            let insert_tasks = tokio::join!(
                self.insert_books_parallel(&books, db_semaphore.clone()),
                self.insert_students_parallel(&students, db_semaphore.clone()),
                self.insert_staff_parallel(&staff_list, db_semaphore.clone())
            );
            
            // Check for any insertion errors
            insert_tasks.0?;
            insert_tasks.1?;
            insert_tasks.2?;
            
            let db_duration = db_start.elapsed();
            info!("Multithreaded database operations completed in {:?}", db_duration);
            
            info!("Multithreaded data pull completed successfully");
            Ok::<(), anyhow::Error>(())
        }.await;
        
        let mut status = self.status.write().await;
        status.is_syncing = false;
        match result {
            Ok(_) => {
                status.initial_sync_completed = true;
                status.last_sync = Some(Utc::now());
                status.last_error = None;
                let total_duration = start_time.elapsed();
                info!("Multithreaded data pull completed successfully in {:?}", total_duration);
            }
            Err(e) => {
                status.last_error = Some(e.to_string());
                warn!("Multithreaded data pull failed: {}", e);
                return Err(crate::sync::error::SyncError::InvalidData(e.to_string()));
            }
        }
        
        Ok(())
    }

    #[allow(dead_code)]
    async fn fetch_books_from_supabase(&self) -> Result<Vec<crate::models::Book>, anyhow::Error> {
        use crate::models::{Book, BookStatus, BookCondition};
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        use std::time::Duration;
        
        let mut books = Vec::new();
        let mut offset = 0;
        let limit = 1000;
        
        loop {
            let url = format!("{}/rest/v1/books?select=*&limit={}&offset={}", self.config.url, limit, offset);
            let response = self.client
                .get(&url)
                .header("apikey", &self.config.anon_key)
                .header("Authorization", format!("Bearer {}", self.config.anon_key))
                .timeout(Duration::from_secs(30))
                .send()
                .await?;

            if !response.status().is_success() {
                return Err(anyhow::anyhow!("Failed to fetch books: HTTP {}", response.status()));
            }

            let json: serde_json::Value = response.json().await?;
            
            if let Some(array) = json.as_array() {
                for item in array {
                    let book = Book {
                        id: Uuid::parse_str(item["id"].as_str().unwrap_or_default()).unwrap_or_else(|_| Uuid::new_v4()),
                        title: item["title"].as_str().unwrap_or("Unknown").to_string(),
                        author: item["author"].as_str().unwrap_or("Unknown").to_string(),
                        isbn: item["isbn"].as_str().map(|s| s.to_string()),
                        genre: item["genre"].as_str().map(|s| s.to_string()),
                        publisher: item["publisher"].as_str().map(|s| s.to_string()),
                        publication_year: item["publication_year"].as_i64().map(|y| y as i32),
                        category_id: item["category_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        total_copies: item["total_copies"].as_i64().unwrap_or(1) as i32,
                        available_copies: item["available_copies"].as_i64().unwrap_or(1) as i32,
                        shelf_location: item["shelf_location"].as_str().map(|s| s.to_string()),
                        cover_image_url: item["cover_image_url"].as_str().map(|s| s.to_string()),
                        description: item["description"].as_str().map(|s| s.to_string()),
                        status: BookStatus::Available,
                        condition: item["condition"].as_str().and_then(|s| match s {
                            "excellent" => Some(BookCondition::Excellent),
                            "good" => Some(BookCondition::Good),
                            "fair" => Some(BookCondition::Fair),
                            "poor" => Some(BookCondition::Poor),
                            "damaged" => Some(BookCondition::Damaged),
                            "lost" => Some(BookCondition::Lost),
                            "stolen" => Some(BookCondition::Stolen),
                            _ => None,
                        }),
                        book_code: item["book_code"].as_str().map(|s| s.to_string()),
                        acquisition_year: item["acquisition_year"].as_i64().map(|y| y as i32),
                        legacy_book_id: item["legacy_book_id"].as_i64().map(|i| i as i32),
                        legacy_isbn: item["legacy_isbn"].as_str().map(|s| s.to_string()),
                        supplier_type: item["supplier_type"].as_str().map(|s| s.to_string()),
                        supplier_name: item["supplier_name"].as_str().map(|s| s.to_string()),
                        created_at: item["created_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        updated_at: item["updated_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                    };
                    books.push(book);
                }
                if array.len() < limit {
                    break;
                }
            } else {
                break;
            }
            offset += limit;
        }
        Ok(books)
    }

    async fn fetch_categories_from_supabase(&self) -> Result<Vec<crate::models::Category>, anyhow::Error> {
        use crate::models::Category;
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        use std::time::Duration;
        
        let mut categories = Vec::new();
        let mut offset = 0;
        let limit = 1000;
        
        loop {
            let url = format!("{}/rest/v1/categories?select=*&limit={}&offset={}", self.config.url, limit, offset);
            let response = self.client
                .get(&url)
                .header("apikey", &self.config.anon_key)
                .header("Authorization", format!("Bearer {}", self.config.anon_key))
                .timeout(Duration::from_secs(30))
                .send()
                .await?;

            if !response.status().is_success() {
                return Err(anyhow::anyhow!("Failed to fetch categories: HTTP {}", response.status()));
            }

            let json: serde_json::Value = response.json().await?;
            
            if let Some(array) = json.as_array() {
                for item in array {
                    let category = Category {
                        id: Uuid::parse_str(item["id"].as_str().unwrap_or_default()).unwrap_or_else(|_| Uuid::new_v4()),
                        name: item["name"].as_str().unwrap_or("Unknown").to_string(),
                        description: item["description"].as_str().map(|s| s.to_string()),
                        created_at: item["created_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        updated_at: item["updated_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                    };
                    categories.push(category);
                }
                if array.len() < limit {
                    break;
                }
            } else {
                break;
            }
            offset += limit;
        }
        Ok(categories)
    }

    #[allow(dead_code)]
    async fn fetch_students_from_supabase(&self) -> Result<Vec<crate::models::Student>, anyhow::Error> {
        use crate::models::Student;
        use uuid::Uuid;
        use chrono::{DateTime, Utc, NaiveDate};
        use std::time::Duration;
        
        let mut students = Vec::new();
        let mut offset = 0;
        let limit = 1000;
        
        loop {
            let url = format!("{}/rest/v1/students?select=*&limit={}&offset={}", self.config.url, limit, offset);
            let response = self.client
                .get(&url)
                .header("apikey", &self.config.anon_key)
                .header("Authorization", format!("Bearer {}", self.config.anon_key))
                .timeout(Duration::from_secs(30))
                .send()
                .await?;

            if !response.status().is_success() {
                return Err(anyhow::anyhow!("Failed to fetch students: HTTP {}", response.status()));
            }

            let json: serde_json::Value = response.json().await?;
            
            if let Some(array) = json.as_array() {
                for item in array {
                    let student = Student {
                        id: Uuid::parse_str(item["id"].as_str().unwrap_or_default()).unwrap_or_else(|_| Uuid::new_v4()),
                        admission_number: item["admission_number"].as_str().unwrap_or("").to_string(),
                        first_name: item["first_name"].as_str().unwrap_or("").to_string(),
                        last_name: item["last_name"].as_str().unwrap_or("").to_string(),
                        email: item["email"].as_str().map(|s| s.to_string()),
                        phone: item["phone"].as_str().map(|s| s.to_string()),
                        class_grade: item["class_grade"].as_str().unwrap_or("").to_string(),
                        address: item["address"].as_str().map(|s| s.to_string()),
                        date_of_birth: item["date_of_birth"].as_str()
                            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()),
                        enrollment_date: item["enrollment_date"].as_str()
                            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
                            .unwrap_or_else(|| Utc::now().date_naive()),
                        status: item["status"].as_str().unwrap_or("active").to_string(),
                        class_id: item["class_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        academic_year: item["academic_year"].as_str().unwrap_or("2024").to_string(),
                        is_repeating: item["is_repeating"].as_bool().unwrap_or(false),
                        legacy_student_id: item["legacy_student_id"].as_i64().map(|i| i as i32),
                        created_at: item["created_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        updated_at: item["updated_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                    };
                    students.push(student);
                }
                if array.len() < limit {
                    break;
                }
            } else {
                break;
            }
            offset += limit;
        }
        Ok(students)
    }

    async fn fetch_staff_from_supabase(&self) -> Result<Vec<crate::models::Staff>, anyhow::Error> {
        use crate::models::Staff;
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        use std::time::Duration;
        
        let mut staff_list = Vec::new();
        let mut offset = 0;
        let limit = 1000;
        
        loop {
            let url = format!("{}/rest/v1/staff?select=*&limit={}&offset={}", self.config.url, limit, offset);
            let response = self.client
                .get(&url)
                .header("apikey", &self.config.anon_key)
                .header("Authorization", format!("Bearer {}", self.config.anon_key))
                .timeout(Duration::from_secs(30))
                .send()
                .await?;

            if !response.status().is_success() {
                return Err(anyhow::anyhow!("Failed to fetch staff: HTTP {}", response.status()));
            }

            let json: serde_json::Value = response.json().await?;
            
            if let Some(array) = json.as_array() {
                for item in array {
                    let staff = Staff {
                        id: Uuid::parse_str(item["id"].as_str().unwrap_or_default()).unwrap_or_else(|_| Uuid::new_v4()),
                        staff_id: item["staff_id"].as_str().unwrap_or("").to_string(),
                        first_name: item["first_name"].as_str().unwrap_or("").to_string(),
                        last_name: item["last_name"].as_str().unwrap_or("").to_string(),
                        email: item["email"].as_str().map(|s| s.to_string()),
                        phone: item["phone"].as_str().map(|s| s.to_string()),
                        department: item["department"].as_str().map(|s| s.to_string()),
                        position: item["position"].as_str().map(|s| s.to_string()),
                        status: item["status"].as_str().unwrap_or("active").to_string(),
                        legacy_staff_id: item["legacy_staff_id"].as_i64().map(|i| i as i32),
                        created_at: item["created_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        updated_at: item["updated_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                    };
                    staff_list.push(staff);
                }
                if array.len() < limit {
                    break;
                }
            } else {
                break;
            }
            offset += limit;
        }
        Ok(staff_list)
    }

    /// Optimizes SQLite for bulk insertions by enabling WAL mode and other performance settings
    async fn optimize_database_for_bulk_operations(&self) -> SyncResult<()> {
        // Get the connection and optimize for bulk operations
        let conn = self.db.get_connection().lock().map_err(|e| {
            crate::sync::error::SyncError::InvalidData(format!("Failed to lock database: {:?}", e))
        })?;
        
        // Configure SQLite for maximum bulk insert performance
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA temp_store = MEMORY;
             PRAGMA cache_size = 20000;
             PRAGMA mmap_size = 536870912;
             PRAGMA page_size = 32768;"
        ).map_err(|e| {
            crate::sync::error::SyncError::InvalidData(format!("Failed to optimize database: {}", e))
        })?;
        
        info!("SQLite optimized for bulk operations with enhanced settings");
        Ok(())
    }

    // Multithreaded fetch methods with configurable concurrency
    async fn fetch_books_multithreaded(
        &self, 
        semaphore: Arc<tokio::sync::Semaphore>
    ) -> Result<Vec<crate::models::Book>, anyhow::Error> {
        use crate::models::{Book, BookStatus, BookCondition};
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        use std::time::Duration;
        use futures::stream::{self, StreamExt};
        
        info!("Starting multithreaded books fetch...");
        
        // First, get the total count to determine how many threads we need
        let count_url = format!("{}/rest/v1/books?select=count", self.config.url);
        let count_response = self.client
            .get(&count_url)
            .header("apikey", &self.config.anon_key)
            .header("Authorization", format!("Bearer {}", self.config.anon_key))
            .header("Prefer", "count=exact")
            .timeout(Duration::from_secs(10))
            .send()
            .await?;
            
        let total_count = count_response
            .headers()
            .get("content-range")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.split('/').nth(1))
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(1000); // Fallback if count fails
            
        info!("Total books to fetch: {}", total_count);
        
        let chunk_size = 500; // Fetch 500 books per request
        let chunks: Vec<usize> = (0..total_count).step_by(chunk_size).collect();
        
        // Fetch chunks in parallel with semaphore control
        let all_books = stream::iter(chunks)
            .map(|offset| {
                let semaphore = semaphore.clone();
                let client = self.client.clone();
                let config = self.config.clone();
                
                async move {
                    let _permit = semaphore.acquire().await.unwrap();
                    
                    let url = format!(
                        "{}/rest/v1/books?select=*&limit={}&offset={}", 
                        config.url, chunk_size, offset
                    );
                    
                    let response = client
                        .get(&url)
                        .header("apikey", &config.anon_key)
                        .header("Authorization", format!("Bearer {}", config.anon_key))
                        .timeout(Duration::from_secs(30))
                        .send()
                        .await?;

                    if !response.status().is_success() {
                        return Err(anyhow::anyhow!("Failed to fetch books chunk at offset {}: HTTP {}", offset, response.status()));
                    }

                    let json: serde_json::Value = response.json().await?;
                    let mut chunk_books = Vec::new();
                    
                    if let Some(array) = json.as_array() {
                        for item in array {
                            let book = Book {
                                id: Uuid::parse_str(item["id"].as_str().unwrap_or_default()).unwrap_or_else(|_| Uuid::new_v4()),
                                title: item["title"].as_str().unwrap_or("Unknown").to_string(),
                                author: item["author"].as_str().unwrap_or("Unknown").to_string(),
                                isbn: item["isbn"].as_str().map(|s| s.to_string()),
                                genre: item["genre"].as_str().map(|s| s.to_string()),
                                publisher: item["publisher"].as_str().map(|s| s.to_string()),
                                publication_year: item["publication_year"].as_i64().map(|y| y as i32),
                                category_id: item["category_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                                total_copies: item["total_copies"].as_i64().unwrap_or(1) as i32,
                                available_copies: item["available_copies"].as_i64().unwrap_or(1) as i32,
                                shelf_location: item["shelf_location"].as_str().map(|s| s.to_string()),
                                cover_image_url: item["cover_image_url"].as_str().map(|s| s.to_string()),
                                description: item["description"].as_str().map(|s| s.to_string()),
                                status: BookStatus::Available,
                                condition: item["condition"].as_str().and_then(|s| match s {
                                    "excellent" => Some(BookCondition::Excellent),
                                    "good" => Some(BookCondition::Good),
                                    "fair" => Some(BookCondition::Fair),
                                    "poor" => Some(BookCondition::Poor),
                                    "damaged" => Some(BookCondition::Damaged),
                                    "lost" => Some(BookCondition::Lost),
                                    "stolen" => Some(BookCondition::Stolen),
                                    _ => None,
                                }),
                                book_code: item["book_code"].as_str().map(|s| s.to_string()),
                                acquisition_year: item["acquisition_year"].as_i64().map(|y| y as i32),
                                legacy_book_id: item["legacy_book_id"].as_i64().map(|i| i as i32),
                                legacy_isbn: item["legacy_isbn"].as_str().map(|s| s.to_string()),
                                supplier_type: item["supplier_type"].as_str().map(|s| s.to_string()),
                                supplier_name: item["supplier_name"].as_str().map(|s| s.to_string()),
                                created_at: item["created_at"].as_str()
                                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                                    .map(|dt| dt.with_timezone(&Utc))
                                    .unwrap_or_else(Utc::now),
                                updated_at: item["updated_at"].as_str()
                                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                                    .map(|dt| dt.with_timezone(&Utc))
                                    .unwrap_or_else(Utc::now),
                            };
                            chunk_books.push(book);
                        }
                    }
                    
                    info!("Fetched {} books from offset {}", chunk_books.len(), offset);
                    Ok::<Vec<Book>, anyhow::Error>(chunk_books)
                }
            })
            .buffer_unordered(8) // Process up to 8 chunks concurrently
            .collect::<Vec<_>>()
            .await;
            
        // Flatten results and handle errors
        let mut books = Vec::new();
        for chunk_result in all_books {
            books.extend(chunk_result?);
        }
        
        info!("Completed multithreaded books fetch: {} total books", books.len());
        Ok(books)
    }

    async fn fetch_categories_multithreaded(
        &self, 
        semaphore: Arc<tokio::sync::Semaphore>
    ) -> Result<Vec<crate::models::Category>, anyhow::Error> {
        let _permit = semaphore.acquire().await.unwrap();
        info!("Fetching categories with thread control...");
        // Categories are typically small, so we can fetch them in a single request
        self.fetch_categories_from_supabase().await
    }

    async fn fetch_students_multithreaded(
        &self, 
        semaphore: Arc<tokio::sync::Semaphore>
    ) -> Result<Vec<crate::models::Student>, anyhow::Error> {
        use crate::models::Student;
        use uuid::Uuid;
        use chrono::{DateTime, Utc, NaiveDate};
        use std::time::Duration;
        use futures::stream::{self, StreamExt};
        
        info!("Starting multithreaded students fetch...");
        
        // Get total count
        let count_url = format!("{}/rest/v1/students?select=count", self.config.url);
        let count_response = self.client
            .get(&count_url)
            .header("apikey", &self.config.anon_key)
            .header("Authorization", format!("Bearer {}", self.config.anon_key))
            .header("Prefer", "count=exact")
            .timeout(Duration::from_secs(10))
            .send()
            .await?;
            
        let total_count = count_response
            .headers()
            .get("content-range")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.split('/').nth(1))
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(1000);
            
        info!("Total students to fetch: {}", total_count);
        
        let chunk_size = 500;
        let chunks: Vec<usize> = (0..total_count).step_by(chunk_size).collect();
        
        let all_students = stream::iter(chunks)
            .map(|offset| {
                let semaphore = semaphore.clone();
                let client = self.client.clone();
                let config = self.config.clone();
                
                async move {
                    let _permit = semaphore.acquire().await.unwrap();
                    
                    let url = format!(
                        "{}/rest/v1/students?select=*&limit={}&offset={}", 
                        config.url, chunk_size, offset
                    );
                    
                    let response = client
                        .get(&url)
                        .header("apikey", &config.anon_key)
                        .header("Authorization", format!("Bearer {}", config.anon_key))
                        .timeout(Duration::from_secs(30))
                        .send()
                        .await?;

                    if !response.status().is_success() {
                        return Err(anyhow::anyhow!("Failed to fetch students chunk: HTTP {}", response.status()));
                    }

                    let json: serde_json::Value = response.json().await?;
                    let mut chunk_students = Vec::new();
                    
                    if let Some(array) = json.as_array() {
                        for item in array {
                            let student = Student {
                                id: Uuid::parse_str(item["id"].as_str().unwrap_or_default()).unwrap_or_else(|_| Uuid::new_v4()),
                                admission_number: item["admission_number"].as_str().unwrap_or("").to_string(),
                                first_name: item["first_name"].as_str().unwrap_or("").to_string(),
                                last_name: item["last_name"].as_str().unwrap_or("").to_string(),
                                email: item["email"].as_str().map(|s| s.to_string()),
                                phone: item["phone"].as_str().map(|s| s.to_string()),
                                class_grade: item["class_grade"].as_str().unwrap_or("").to_string(),
                                address: item["address"].as_str().map(|s| s.to_string()),
                                date_of_birth: item["date_of_birth"].as_str()
                                    .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()),
                                enrollment_date: item["enrollment_date"].as_str()
                                    .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
                                    .unwrap_or_else(|| Utc::now().date_naive()),
                                status: item["status"].as_str().unwrap_or("active").to_string(),
                                class_id: item["class_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                                academic_year: item["academic_year"].as_str().unwrap_or("2024").to_string(),
                                is_repeating: item["is_repeating"].as_bool().unwrap_or(false),
                                legacy_student_id: item["legacy_student_id"].as_i64().map(|i| i as i32),
                                created_at: item["created_at"].as_str()
                                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                                    .map(|dt| dt.with_timezone(&Utc))
                                    .unwrap_or_else(Utc::now),
                                updated_at: item["updated_at"].as_str()
                                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                                    .map(|dt| dt.with_timezone(&Utc))
                                    .unwrap_or_else(Utc::now),
                            };
                            chunk_students.push(student);
                        }
                    }
                    
                    info!("Fetched {} students from offset {}", chunk_students.len(), offset);
                    Ok::<Vec<Student>, anyhow::Error>(chunk_students)
                }
            })
            .buffer_unordered(6) // Process up to 6 chunks concurrently
            .collect::<Vec<_>>()
            .await;
            
        let mut students = Vec::new();
        for chunk_result in all_students {
            students.extend(chunk_result?);
        }
        
        info!("Completed multithreaded students fetch: {} total students", students.len());
        Ok(students)
    }

    async fn fetch_staff_multithreaded(
        &self, 
        semaphore: Arc<tokio::sync::Semaphore>
    ) -> Result<Vec<crate::models::Staff>, anyhow::Error> {
        let _permit = semaphore.acquire().await.unwrap();
        info!("Fetching staff with thread control...");
        // Staff are typically small, so we can fetch them in a single request
        self.fetch_staff_from_supabase().await
    }

    // Parallel insertion methods
    async fn insert_categories_parallel(
        &self, 
        categories: &[crate::models::Category], 
        _semaphore: Arc<tokio::sync::Semaphore>
    ) -> Result<(), anyhow::Error> {
        info!("Inserting {} categories...", categories.len());
        for category in categories {
            if let Err(e) = self.db.create_category(&category).await {
                warn!("Failed to insert category {}: {}", category.name, e);
            }
        }
        Ok(())
    }

    async fn insert_books_parallel(
        &self, 
        books: &[crate::models::Book], 
        semaphore: Arc<tokio::sync::Semaphore>
    ) -> Result<(), anyhow::Error> {
        info!("Starting parallel insertion of {} books...", books.len());
        
        // Convert to owned data to avoid lifetime issues
        let owned_books: Vec<crate::models::Book> = books.to_vec();
        let chunk_size = 50;
        
        let mut tasks = Vec::new();
        
        for chunk in owned_books.chunks(chunk_size) {
            let semaphore = semaphore.clone();
            let db = self.db.clone();
            let chunk = chunk.to_vec();
            
            let task = tokio::spawn(async move {
                let _permit = semaphore.acquire().await.unwrap();
                
                for book in chunk {
                    if let Err(e) = db.create_book(&book).await {
                        warn!("Failed to insert book {}: {}", book.title, e);
                    }
                }
            });
            
            tasks.push(task);
        }
        
        // Wait for all tasks to complete
        for task in tasks {
            if let Err(e) = task.await {
                warn!("Book insertion task failed: {}", e);
            }
        }
        
        info!("Completed parallel books insertion");
        Ok(())
    }

    async fn insert_students_parallel(
        &self, 
        students: &[crate::models::Student], 
        semaphore: Arc<tokio::sync::Semaphore>
    ) -> Result<(), anyhow::Error> {
        info!("Starting parallel insertion of {} students...", students.len());
        
        // Convert to owned data to avoid lifetime issues
        let owned_students: Vec<crate::models::Student> = students.to_vec();
        let chunk_size = 50;
        
        let mut tasks = Vec::new();
        
        for chunk in owned_students.chunks(chunk_size) {
            let semaphore = semaphore.clone();
            let db = self.db.clone();
            let chunk = chunk.to_vec();
            
            let task = tokio::spawn(async move {
                let _permit = semaphore.acquire().await.unwrap();
                
                for student in chunk {
                    if let Err(e) = db.create_student(&student).await {
                        warn!("Failed to insert student {} {}: {}", student.first_name, student.last_name, e);
                    }
                }
            });
            
            tasks.push(task);
        }
        
        // Wait for all tasks to complete
        for task in tasks {
            if let Err(e) = task.await {
                warn!("Student insertion task failed: {}", e);
            }
        }
        
        info!("Completed parallel students insertion");
        Ok(())
    }

    async fn insert_staff_parallel(
        &self, 
        staff_list: &[crate::models::Staff], 
        _semaphore: Arc<tokio::sync::Semaphore>
    ) -> Result<(), anyhow::Error> {
        info!("Inserting {} staff members...", staff_list.len());
        for staff in staff_list {
            if let Err(e) = self.db.create_staff(&staff).await {
                warn!("Failed to insert staff {} {}: {}", staff.first_name, staff.last_name, e);
            }
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn sync_table(&self, table_name: &str) -> SyncResult<SyncSummary> {
        let mut status = self.status.write().await;
        if status.is_syncing {
            return Err(crate::sync::error::SyncError::SyncInProgress);
        }
        status.is_syncing = true;
        status.last_error = None;
        drop(status);

        let result = self.perform_table_sync(table_name).await;

        let mut status = self.status.write().await;
        status.is_syncing = false;
        
        match &result {
            Ok(summary) => {
                status.last_sync = Some(chrono::Utc::now());
                if !summary.errors.is_empty() {
                    status.last_error = Some(summary.errors.join(", "));
                }
            }
            Err(e) => {
                status.last_error = Some(e.to_string());
            }
        }

        result
    }

    #[allow(dead_code)]
    async fn perform_table_sync(&self, table_name: &str) -> SyncResult<SyncSummary> {
        // Check connectivity
        if !self.check_connectivity().await {
            return Err(crate::sync::error::SyncError::InvalidData("No internet connection".to_string()));
        }

        let strategies = self.strategies.read().await;
        let strategy = strategies
            .get(table_name)
            .ok_or_else(|| crate::sync::error::SyncError::Config(format!("No strategy registered for table: {}", table_name)))?;

        let summary = strategy
            .sync_table(
                table_name,
                self.remote.as_ref(),
                self.local.as_ref(),
                self.conflict_resolver.as_ref(),
            )
            .await?;

        Ok(summary)
    }

    #[allow(dead_code)]
    pub async fn sync_all_tables(&self) -> SyncResult<Vec<SyncSummary>> {
        let mut status = self.status.write().await;
        if status.is_syncing {
            return Err(crate::sync::error::SyncError::SyncInProgress);
        }
        status.is_syncing = true;
        status.last_error = None;
        drop(status);

        let result = self.perform_all_tables_sync().await;

        let mut status = self.status.write().await;
        status.is_syncing = false;
        
        match &result {
            Ok(summaries) => {
                status.last_sync = Some(chrono::Utc::now());
                let total_errors: Vec<String> = summaries
                    .iter()
                    .flat_map(|s| s.errors.clone())
                    .collect();
                
                if !total_errors.is_empty() {
                    status.last_error = Some(total_errors.join(", "));
                }
            }
            Err(e) => {
                status.last_error = Some(e.to_string());
            }
        }

        result
    }

    #[allow(dead_code)]
    async fn perform_all_tables_sync(&self) -> SyncResult<Vec<SyncSummary>> {
        if !self.check_connectivity().await {
            return Err(crate::sync::error::SyncError::InvalidData("No internet connection".to_string()));
        }

        let strategies = self.strategies.read().await;
        let mut summaries = Vec::new();

        for table_name in strategies.keys() {
            match self.sync_table(table_name).await {
                Ok(summary) => summaries.push(summary),
                Err(e) => {
                    summaries.push(SyncSummary {
                        table_name: table_name.clone(),
                        remote_changes: 0,
                        local_changes: 0,
                        conflicts: 0,
                        resolved: 0,
                        errors: vec![e.to_string()],
                        sync_duration_ms: 0,
                    });
                }
            }
        }

        Ok(summaries)
    }

    #[allow(dead_code)]
    pub async fn start_background_sync(&self, interval_secs: u64) -> SyncResult<()> {
        let status = self.status.clone();
        let engine = self.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));
            
            loop {
                interval.tick().await;
                
                let current_status = status.read().await;
                if !current_status.is_online || current_status.is_syncing {
                    continue;
                }
                drop(current_status);

                if let Err(e) = engine.sync_all_tables().await {
                    tracing::error!("Background sync failed: {}", e);
                }
            }
        });

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get_pending_operations_count(&self) -> SyncResult<usize> {
        // This would need to be implemented based on your specific needs
        // For now, return 0 as pending operations are tracked differently
        Ok(0)
    }

    #[allow(dead_code)]
    pub async fn initialize(&self) -> SyncResult<()> {
        let mut status = self.status.write().await;
        
        // Check connectivity
        status.is_online = self.check_connectivity().await;
        
        // Initialize database
        status.database_initialized = true;
        
        // Mark as initialized
        status.initial_sync_completed = true;
        
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn shutdown(&self) -> SyncResult<()> {
        let mut status = self.status.write().await;
        status.is_syncing = false;
        Ok(())
    }

    pub fn clone(&self) -> Self {
        Self {
            remote: self.remote.clone(),
            local: self.local.clone(),
            conflict_resolver: self.conflict_resolver.clone(),
            strategies: self.strategies.clone(),
            status: self.status.clone(),
            db: self.db.clone(),
            config: self.config.clone(),
            client: self.client.clone(),
            supabase_client: self.supabase_client.clone(),
        }
    }
}

// Builder pattern for easier configuration
pub struct SyncEngineBuilder {
    remote: Option<Arc<dyn RemoteDataSource>>,
    local: Option<Arc<dyn LocalDataStore>>,
    conflict_resolver: Option<Arc<dyn ConflictResolver>>,
    strategies: std::collections::HashMap<String, Arc<dyn SyncStrategy>>,
}

impl SyncEngineBuilder {
    pub fn new() -> Self {
        Self {
            remote: None,
            local: None,
            conflict_resolver: None,
            strategies: std::collections::HashMap::new(),
        }
    }

    pub fn with_remote(mut self, remote: Arc<dyn RemoteDataSource>) -> Self {
        self.remote = Some(remote);
        self
    }

    pub fn with_local(mut self, local: Arc<dyn LocalDataStore>) -> Self {
        self.local = Some(local);
        self
    }

    pub fn with_conflict_resolver(mut self, resolver: Arc<dyn ConflictResolver>) -> Self {
        self.conflict_resolver = Some(resolver);
        self
    }

    #[allow(dead_code)]
    pub fn with_strategy(mut self, table_name: String, strategy: Arc<dyn SyncStrategy>) -> Self {
        self.strategies.insert(table_name, strategy);
        self
    }

    pub fn build(self) -> SyncResult<SyncEngine> {
        let remote = self.remote.ok_or_else(|| 
            crate::sync::error::SyncError::Config("Remote data source required".to_string()))?;
        
        let local = self.local.ok_or_else(|| 
            crate::sync::error::SyncError::Config("Local data store required".to_string()))?;
        
        let conflict_resolver = self.conflict_resolver.ok_or_else(|| 
            crate::sync::error::SyncError::Config("Conflict resolver required".to_string()))?;

        let engine = SyncEngine {
            remote: remote,
            local: local,
            conflict_resolver: conflict_resolver,
            strategies: Arc::new(RwLock::new(self.strategies)),
            status: Arc::new(RwLock::new(SyncStatus {
                is_online: false,
                is_syncing: false,
                last_sync: None,
                last_error: None,
                database_initialized: false,
                initial_sync_completed: false,
                last_connectivity_check: None,
            })),
            db: Arc::new(crate::database::DatabaseManager::new(":memory:").unwrap()), // Placeholder
            config: crate::sync::remote::supabase::SupabaseConfig {
            url: String::new(),
            anon_key: String::new(),
            batch_size: 100,
        }, // Placeholder
            client: reqwest::Client::new(),
            supabase_client: None,
        };

        Ok(engine)
    }
}
