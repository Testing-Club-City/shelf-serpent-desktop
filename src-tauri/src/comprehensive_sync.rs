use anyhow::Result;
use sqlx::SqlitePool;
use std::path::PathBuf;
use reqwest::Client;
use serde_json::Value;
use std::time::Instant;

/// Comprehensive sync system for all library management data
pub struct ComprehensiveSync {
    client: Client,
    pub pool: SqlitePool,
    supabase_url: String,
    anon_key: String,
}

impl ComprehensiveSync {
    pub async fn new() -> Result<Self> {
        let app_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("library-management-system");
        let db_path = app_dir.join("library.db");
        
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
        let client = Client::new();
        
        Ok(Self {
            client,
            pool,
            supabase_url: "https://ddlzenlqkofefdwdefzm.supabase.co".to_string(),
            anon_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU".to_string(),
        })
    }

    /// Sync all tables in the correct dependency order
    pub async fn sync_all_tables(&self) -> Result<SyncSummary> {
        println!("🚀 Starting COMPREHENSIVE SYNC of all library management data...");
        let start_time = Instant::now();
        let mut summary = SyncSummary::new();

        // Phase 1: Core Configuration Tables (no dependencies)
        println!("\n📋 === PHASE 1: CORE CONFIGURATION ===");
        
        summary.add_result("categories", self.sync_categories().await);
        summary.add_result("classes", self.sync_classes().await);
        summary.add_result("fine_settings", self.sync_fine_settings().await);
        summary.add_result("profiles", self.sync_profiles().await);

        // Phase 2: Master Data (depends on Phase 1)
        println!("\n📚 === PHASE 2: MASTER DATA ===");
        
        summary.add_result("books", self.sync_books().await);
        summary.add_result("students", self.sync_students().await);
        summary.add_result("staff", self.sync_staff().await);

        // Phase 3: Dependent Data (depends on Phase 2)
        println!("\n📦 === PHASE 3: DEPENDENT DATA ===");
        
        summary.add_result("book_copies", self.sync_book_copies().await);

        // Phase 4: Transactional Data (depends on all previous phases)
        println!("\n💼 === PHASE 4: TRANSACTIONAL DATA ===");
        
        summary.add_result("borrowings", self.sync_borrowings().await);
        summary.add_result("group_borrowings", self.sync_group_borrowings().await);
        summary.add_result("fines", self.sync_fines().await);
        summary.add_result("theft_reports", self.sync_theft_reports().await);

        // Phase 5: System Data
        println!("\n🔔 === PHASE 5: SYSTEM DATA ===");
        
        summary.add_result("notifications", self.sync_notifications().await);

        let duration = start_time.elapsed();
        summary.total_duration = duration;
        
        println!("\n🎉 === COMPREHENSIVE SYNC COMPLETED ===");
        println!("⏱️  Total time: {:?}", duration);
        println!("📊 Total records synced: {}", summary.total_records());
        println!("✅ Successful tables: {}", summary.successful_tables());
        println!("❌ Failed tables: {}", summary.failed_tables());
        
        if !summary.errors.is_empty() {
            println!("\n⚠️  Errors encountered:");
            for (table, error) in &summary.errors {
                println!("  - {}: {}", table, error);
            }
        }

        Ok(summary)
    }

    /// Generic sync method for any table
    pub async fn sync_table(&self, table_name: &str, batch_size: usize) -> Result<u32> {
        println!("🔄 Syncing table: {}", table_name);
        
        let url = format!("{}/rest/v1/{}?select=*", self.supabase_url, table_name);
        let mut total_synced = 0;
        let mut offset = 0;

        loop {
            let response = self.client
                .get(&url)
                .header("apikey", &self.anon_key)
                .header("Authorization", format!("Bearer {}", self.anon_key))
                .header("Range", format!("{}-{}", offset, offset + batch_size - 1))
                .send()
                .await?;

            if !response.status().is_success() {
                return Err(anyhow::anyhow!("API request failed: {}", response.status()));
            }

            let json: Value = response.json().await?;
            let empty_vec = vec![];
            let records = json.as_array().unwrap_or(&empty_vec);

            if records.is_empty() {
                break;
            }

            let batch_synced = self.process_batch(table_name, records).await?;
            total_synced += batch_synced;
            offset += batch_size;

            println!("  📦 Batch synced: {} records (total: {})", batch_synced, total_synced);

            if records.len() < batch_size {
                break;
            }
        }

        println!("✅ {} sync completed: {} records", table_name, total_synced);
        Ok(total_synced)
    }

    /// Process a batch of records for any table
    async fn process_batch(&self, table_name: &str, records: &[Value]) -> Result<u32> {
        let mut tx = self.pool.begin().await?;
        let mut synced = 0;

        for record in records {
            match table_name {
                "categories" => {
                    if self.insert_category(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "classes" => {
                    if self.insert_class(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "books" => {
                    if self.insert_book(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "students" => {
                    if self.insert_student(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "staff" => {
                    if self.insert_staff(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "book_copies" => {
                    if self.insert_book_copy(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "borrowings" => {
                    if self.insert_borrowing(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "fines" => {
                    if self.insert_fine(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "fine_settings" => {
                    if self.insert_fine_setting(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "group_borrowings" => {
                    if self.insert_group_borrowing(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "theft_reports" => {
                    if self.insert_theft_report(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "notifications" => {
                    if self.insert_notification(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                "profiles" => {
                    if self.insert_profile(record, &mut tx).await.is_ok() {
                        synced += 1;
                    }
                }
                _ => {
                    println!("⚠️  Unknown table: {}", table_name);
                }
            }
        }

        tx.commit().await?;
        Ok(synced)
    }
}

/// Summary of sync operations
#[derive(Debug)]
pub struct SyncSummary {
    pub results: std::collections::HashMap<String, Result<u32, String>>,
    pub errors: Vec<(String, String)>,
    pub total_duration: std::time::Duration,
}

impl SyncSummary {
    fn new() -> Self {
        Self {
            results: std::collections::HashMap::new(),
            errors: Vec::new(),
            total_duration: std::time::Duration::from_secs(0),
        }
    }

    fn add_result(&mut self, table: &str, result: Result<u32>) {
        match result {
            Ok(count) => {
                self.results.insert(table.to_string(), Ok(count));
            }
            Err(e) => {
                let error_msg = e.to_string();
                self.results.insert(table.to_string(), Err(error_msg.clone()));
                self.errors.push((table.to_string(), error_msg));
            }
        }
    }

    pub fn total_records(&self) -> u32 {
        self.results.values()
            .filter_map(|r| r.as_ref().ok())
            .sum()
    }

    pub fn successful_tables(&self) -> usize {
        self.results.values()
            .filter(|r| r.is_ok())
            .count()
    }

    pub fn failed_tables(&self) -> usize {
        self.results.values()
            .filter(|r| r.is_err())
            .count()
    }
}

/// Public function to run comprehensive sync
pub async fn run_comprehensive_sync() -> Result<SyncSummary> {
    let sync = ComprehensiveSync::new().await?;
    sync.sync_all_tables().await
}
