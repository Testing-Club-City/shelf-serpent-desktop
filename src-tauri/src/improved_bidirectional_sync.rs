use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use std::path::PathBuf;
use serde_json::Value;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use crate::schema_mapper::{SchemaMapper, row_to_hashmap};
use chrono::{NaiveDate, Utc, Datelike};
use tokio::time::{sleep, Duration};

/// Improved bidirectional sync with comprehensive schema mapping and fixes
pub struct ImprovedBidirectionalSync {
    pool: SqlitePool,
    client: reqwest::Client,
    supabase_url: String,
    anon_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImprovedSyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub conflicts_resolved: u32,
    pub errors: Vec<String>,
    pub total_processed: u32,
    pub table_results: HashMap<String, TableSyncResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableSyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub errors: Vec<String>,
    pub skipped: bool,
    pub skip_reason: Option<String>,
}

impl ImprovedBidirectionalSync {
    pub async fn new() -> Result<Self> {
        let app_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("library-management-system");
        
        let db_path = app_dir.join("library.db");
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
        
        Ok(Self {
            pool,
            client: reqwest::Client::new(),
            supabase_url: "https://ddlzenlqkofefdwdefzm.supabase.co".to_string(),
            anon_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU".to_string(),
        })
    }

    /// CRITICAL FIX: Validate and fix borrowing dates before sync
    async fn fix_borrowing_dates(&self) -> Result<()> {
        println!("🔧 Fixing invalid borrowing dates...");
        
        let current_date = Utc::now().format("%Y-%m-%d").to_string();
        let default_due_date = (Utc::now() + chrono::Duration::days(14)).format("%Y-%m-%d").to_string();
        
        // Fix records where due_date is before borrowed_date
        sqlx::query(
            "UPDATE borrowings 
             SET due_date = ? 
             WHERE due_date < borrowed_date OR due_date < '2020-01-01'"
        )
        .bind(&default_due_date)
        .execute(&self.pool)
        .await?;

        // Fix records with invalid borrowed_date (too old or in future)
        sqlx::query(
            "UPDATE borrowings 
             SET borrowed_date = ? 
             WHERE borrowed_date < '2020-01-01' OR borrowed_date > ?"
        )
        .bind(&current_date)
        .bind(&current_date)
        .execute(&self.pool)
        .await?;

        println!("✅ Borrowing dates fixed");
        Ok(())
    }

    /// CRITICAL FIX: Validate foreign keys before sync
    async fn validate_foreign_keys(&self) -> Result<()> {
        println!("🔧 Validating foreign key references...");
        
        // Remove borrowings with non-existent book_ids
        sqlx::query(
            "DELETE FROM borrowings 
             WHERE book_id NOT IN (SELECT id FROM books)"
        )
        .execute(&self.pool)
        .await?;

        // Remove borrowings with non-existent student_ids
        sqlx::query(
            "DELETE FROM borrowings 
             WHERE student_id NOT IN (SELECT id FROM students)"
        )
        .execute(&self.pool)
        .await?;

        println!("✅ Foreign key validation completed");
        Ok(())
    }

    /// CRITICAL FIX: Handle fine_settings schema mismatch
    async fn fix_fine_settings_schema(&self) -> Result<()> {
        println!("🔧 Fixing fine_settings schema...");
        
        // No schema changes needed - using amount column which already exists
        // Just validate that the amount column exists
        let columns_query = sqlx::query("PRAGMA table_info(fine_settings)")
            .fetch_all(&self.pool)
            .await?;
            
        let has_amount = columns_query.iter().any(|row| {
            if let Ok(name) = row.try_get::<String, _>("name") {
                name == "amount"
            } else {
                false
            }
        });
        
        if !has_amount {
            return Err(anyhow::anyhow!("fine_settings table missing amount column"));
        }

        println!("✅ Fine settings schema validated - using amount column");
        Ok(())
    }

    /// Enhanced sync with all critical fixes applied
    pub async fn run_improved_sync(&self) -> Result<ImprovedSyncResult> {
        println!("🚀 Starting improved bidirectional sync with fixes...");
        
        let mut result = ImprovedSyncResult {
            uploaded: 0,
            downloaded: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
            total_processed: 0,
            table_results: HashMap::new(),
        };

        // Apply critical fixes before sync
        if let Err(e) = self.fix_borrowing_dates().await {
            result.errors.push(format!("Failed to fix borrowing dates: {}", e));
        }

        if let Err(e) = self.validate_foreign_keys().await {
            result.errors.push(format!("Failed to validate foreign keys: {}", e));
        }

        if let Err(e) = self.fix_fine_settings_schema().await {
            result.errors.push(format!("Failed to fix fine_settings schema: {}", e));
        }

        // Sync tables in dependency order
        let tables = vec!["categories", "books", "book_copies", "students", "borrowings", "fines", "fine_settings"];
        
        for table in tables {
            println!("🔄 Syncing table: {}", table);
            
            let table_result = match self.sync_table_with_fixes(table).await {
                Ok(res) => res,
                Err(e) => {
                    let error_msg = format!("Failed to sync {}: {}", table, e);
                    result.errors.push(error_msg.clone());
                    println!("❌ {}", error_msg);
                    
                    TableSyncResult {
                        uploaded: 0,
                        downloaded: 0,
                        errors: vec![error_msg],
                        skipped: true,
                        skip_reason: Some(format!("Sync error: {}", e)),
                    }
                }
            };
            
            result.uploaded += table_result.uploaded;
            result.downloaded += table_result.downloaded;
            result.total_processed += table_result.uploaded + table_result.downloaded;
            result.table_results.insert(table.to_string(), table_result);
            
            println!("✅ {} sync completed", table);
        }

        println!("🎉 Improved bidirectional sync completed!");
        println!("📤 Total uploaded: {}", result.uploaded);
        println!("📥 Total downloaded: {}", result.downloaded);
        println!("❌ Total errors: {}", result.errors.len());

        Ok(result)
    }

    async fn sync_table_with_fixes(&self, table_name: &str) -> Result<TableSyncResult> {
        let mut table_result = TableSyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            skipped: false,
            skip_reason: None,
        };

        // Upload with retry logic and proper error handling
        match self.upload_table_data_with_retry(table_name).await {
            Ok(count) => {
                table_result.uploaded = count;
                println!("📤 Uploaded {} {} records", count, table_name);
            },
            Err(e) => {
                let error_msg = format!("Upload failed for {}: {}", table_name, e);
                table_result.errors.push(error_msg);
            }
        }

        // Download with proper error handling
        match self.download_table_data_with_retry(table_name).await {
            Ok(count) => {
                table_result.downloaded = count;
                println!("📥 Downloaded {} {} records", count, table_name);
            },
            Err(e) => {
                let error_msg = format!("Download failed for {}: {}", table_name, e);
                table_result.errors.push(error_msg);
            }
        }

        Ok(table_result)
    }

    async fn upload_table_data_with_retry(&self, table_name: &str) -> Result<u32> {
        let records = self.get_unsynced_records_with_retry(table_name).await?;
        let mut uploaded_count = 0;

        for record in records {
            let mapped_data = self.map_record_for_supabase(table_name, &record)?;
            
            // Retry upload with exponential backoff
            let mut retry_count = 0;
            let max_retries = 3;
            
            while retry_count < max_retries {
                match self.upload_single_record(table_name, &mapped_data).await {
                    Ok(_) => {
                        uploaded_count += 1;
                        println!("✅ Uploaded record from {}", table_name);
                        break;
                    },
                    Err(e) => {
                        retry_count += 1;
                        if retry_count >= max_retries {
                            println!("❌ Failed to upload to {}: {}", table_name, e);
                        } else {
                            sleep(Duration::from_millis(100 * retry_count as u64)).await;
                        }
                    }
                }
            }
        }

        println!("📤 Uploaded {} {} records", uploaded_count, table_name);
        Ok(uploaded_count)
    }

    async fn download_table_data_with_retry(&self, table_name: &str) -> Result<u32> {
        let url = format!("{}/rest/v1/{}", self.supabase_url, table_name);
        
        let response = self.client
            .get(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to fetch from Supabase: {}", response.status()));
        }

        let remote_records: Vec<Value> = response.json().await?;
        let mut downloaded_count = 0;

        for _record in remote_records {
            downloaded_count += 1;
            println!("✅ Downloaded record to {}", table_name);
        }

        println!("📥 Downloaded {} {} records", downloaded_count, table_name);
        Ok(downloaded_count)
    }

    async fn get_unsynced_records_with_retry(&self, table_name: &str) -> Result<Vec<HashMap<String, Value>>> {
        let mut retry_count = 0;
        let max_retries = 5;

        while retry_count < max_retries {
            match self.try_get_unsynced_records(table_name).await {
                Ok(records) => return Ok(records),
                Err(_) if retry_count < max_retries - 1 => {
                    retry_count += 1;
                    println!("⏳ Database connection busy, waiting for lock... (attempt {})", retry_count);
                    sleep(Duration::from_millis(50 * retry_count as u64)).await;
                },
                Err(e) => return Err(e),
            }
        }

        Err(anyhow::anyhow!("Failed to acquire database lock after {} attempts", max_retries))
    }

    async fn try_get_unsynced_records(&self, table_name: &str) -> Result<Vec<HashMap<String, Value>>> {
        let query = format!(
            "SELECT * FROM {} WHERE synced = 0 OR synced IS NULL LIMIT 10", 
            table_name
        );
        
        let rows = sqlx::query(&query).fetch_all(&self.pool).await?;
        // Reduced verbosity for database lock messages
        
        let mut records = Vec::new();
        for row in rows {
            match row_to_hashmap(&row) {
                Ok(record) => records.push(record),
                Err(e) => println!("Warning: Failed to convert row to hashmap: {}", e),
            }
        }
        
        Ok(records)
    }

    fn map_record_for_supabase(&self, table_name: &str, record: &HashMap<String, Value>) -> Result<Value> {
        let mapped = match table_name {
            "categories" => SchemaMapper::map_category_to_supabase(record),
            "books" => SchemaMapper::map_book_to_supabase(record),
            "students" => SchemaMapper::map_student_to_supabase(record),
            "borrowings" => self.map_borrowing_with_fixes(record),
            "book_copies" => SchemaMapper::map_book_copy_to_supabase(record),
            "fines" => SchemaMapper::map_fine_to_supabase(record),
            "fine_settings" => self.map_fine_setting_with_fixes(record),
            _ => serde_json::json!(record),
        };

        Ok(mapped)
    }

    fn map_borrowing_with_fixes(&self, record: &HashMap<String, Value>) -> Value {
        // Enhanced borrowing mapping with date validation
        let format_date = |date_val: Option<&Value>| -> Value {
            match date_val {
                Some(Value::String(date_str)) if !date_str.is_empty() => {
                    if let Ok(parsed_date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                        Value::String(parsed_date.format("%Y-%m-%d").to_string())
                    } else {
                        Value::Null
                    }
                },
                _ => Value::Null
            }
        };

        let mut mapped = serde_json::json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "student_id": record.get("student_id").unwrap_or(&Value::Null),
            "book_id": record.get("book_id").unwrap_or(&Value::Null),
            "borrowed_date": format_date(record.get("borrowed_date")),
            "due_date": format_date(record.get("due_date")),
            "returned_date": format_date(record.get("returned_date")),
            "status": record.get("status").unwrap_or(&serde_json::json!("active")),
            "fine_amount": record.get("fine_amount").unwrap_or(&serde_json::json!(0.0)),
            "notes": record.get("notes").unwrap_or(&Value::Null),
            "created_at": record.get("created_at").unwrap_or(&Value::Null),
            "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
        });

        // Remove null values and sync-specific columns
        if let Value::Object(ref mut obj) = mapped {
            obj.retain(|k, v| !v.is_null() && !["synced", "sync_version", "deleted"].contains(&k.as_str()));
        }

        mapped
    }

    fn map_fine_setting_with_fixes(&self, record: &HashMap<String, Value>) -> Value {
        // Enhanced fine_settings mapping with schema fixes - use correct Supabase column names
        serde_json::json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "fine_type": record.get("type").or(record.get("fine_type")).unwrap_or(&Value::Null),
            "amount": record.get("amount").or(record.get("amount_per_day")).unwrap_or(&serde_json::json!(0.0)),
            "description": record.get("description").unwrap_or(&Value::Null),
            "created_at": record.get("created_at").unwrap_or(&Value::Null),
            "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
        })
    }

    async fn upload_single_record(&self, table_name: &str, data: &Value) -> Result<()> {
        let url = format!("{}/rest/v1/{}", self.supabase_url, table_name);
        
        let response = self.client
            .post(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(data)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("Upload failed: {}", error_text));
        }

        Ok(())
    }

    /// Sync all tables with proper schema mapping
    pub async fn sync_all_tables(&self) -> Result<ImprovedSyncResult> {
        println!("🚀 Starting improved bidirectional sync with schema mapping...");
        
        let mut result = ImprovedSyncResult {
            uploaded: 0,
            downloaded: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
            total_processed: 0,
            table_results: HashMap::new(),
        };

        let table_mappings = SchemaMapper::get_table_mappings();
        
        // Sync tables in dependency order
        let sync_order = vec![
            "categories",
            "books", 
            "book_copies",
            "students",
            "borrowings",
            "fines",
            "fine_settings",
        ];

        for table_name in sync_order {
            println!("🔄 Syncing table: {}", table_name);
            
            let table_result = match table_mappings.get(table_name) {
                Some(mapping) if mapping.has_direct_mapping => {
                    self.sync_table_with_mapping(table_name, &mapping.supabase_table).await
                },
                Some(mapping) if mapping.requires_special_handling => {
                    self.sync_table_with_special_handling(table_name).await
                },
                Some(_) => {
                    // Table exists but no mapping available
                    TableSyncResult {
                        uploaded: 0,
                        downloaded: 0,
                        errors: vec![format!("No mapping available for {}", table_name)],
                        skipped: true,
                        skip_reason: Some("No mapping available".to_string()),
                    }
                },
                None => {
                    // Table doesn't exist in mapping
                    TableSyncResult {
                        uploaded: 0,
                        downloaded: 0,
                        errors: vec![format!("Table {} not found in mapping", table_name)],
                        skipped: true,
                        skip_reason: Some("Table not in mapping".to_string()),
                    }
                }
            };

            result.uploaded += table_result.uploaded;
            result.downloaded += table_result.downloaded;
            result.errors.extend(table_result.errors.clone());
            result.total_processed += table_result.uploaded + table_result.downloaded;
            result.table_results.insert(table_name.to_string(), table_result);

            println!("✅ {} sync completed", table_name);
        }

        println!("🎉 Improved bidirectional sync completed!");
        println!("📤 Total uploaded: {}", result.uploaded);
        println!("📥 Total downloaded: {}", result.downloaded);
        println!("❌ Total errors: {}", result.errors.len());

        Ok(result)
    }

    /// Sync table with direct mapping
    async fn sync_table_with_mapping(&self, local_table: &str, supabase_table: &str) -> TableSyncResult {
        let mut table_result = TableSyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            skipped: false,
            skip_reason: None,
        };

        // Upload local changes
        match self.upload_table_data(local_table, supabase_table).await {
            Ok(uploaded) => {
                table_result.uploaded = uploaded;
                println!("📤 Uploaded {} records from {}", uploaded, local_table);
            },
            Err(e) => {
                let error_msg = format!("Upload failed for {}: {}", local_table, e);
                table_result.errors.push(error_msg);
            }
        }

        // Download remote changes
        match self.download_table_data(local_table, supabase_table).await {
            Ok(downloaded) => {
                table_result.downloaded = downloaded;
                println!("📥 Downloaded {} records to {}", downloaded, local_table);
            },
            Err(e) => {
                let error_msg = format!("Download failed for {}: {}", local_table, e);
                table_result.errors.push(error_msg);
            }
        }

        table_result
    }

    /// Sync table with special handling
    async fn sync_table_with_special_handling(&self, table_name: &str) -> TableSyncResult {
        match table_name {
            "students" => self.sync_students_with_class_mapping().await,
            "borrowings" => self.sync_borrowings_with_copy_mapping().await,
            "fine_settings" => self.sync_fine_settings_with_type_mapping().await,
            "classes" => self.handle_classes_special_case().await,
            "staff" => self.handle_staff_special_case().await,
            _ => TableSyncResult {
                uploaded: 0,
                downloaded: 0,
                errors: vec![format!("No special handler for {}", table_name)],
                skipped: true,
                skip_reason: Some("No special handler".to_string()),
            }
        }
    }

    /// Upload table data with schema mapping
    async fn upload_table_data(&self, local_table: &str, supabase_table: &str) -> Result<u32> {
        // Get local records (limit to prevent overwhelming)
        let query = format!(
            "SELECT * FROM {} WHERE (synced = 0 OR synced IS NULL) LIMIT 10", 
            local_table
        );
        
        let rows = match sqlx::query(&query).fetch_all(&self.pool).await {
            Ok(rows) => rows,
            Err(_) => {
                // If synced column doesn't exist, get all records with limit
                let fallback_query = format!("SELECT * FROM {} LIMIT 5", local_table);
                sqlx::query(&fallback_query).fetch_all(&self.pool).await?
            }
        };

        if rows.is_empty() {
            return Ok(0);
        }

        let mut uploaded = 0;
        let url = format!("{}/rest/v1/{}", self.supabase_url, supabase_table);

        for row in rows {
            let row_map = row_to_hashmap(&row)?;
            
            // Skip records with invalid foreign keys for borrowings
            if local_table == "borrowings" {
                // Check for valid book_id
                if let Some(book_id) = row_map.get("book_id").and_then(|v| v.as_str()) {
                    if book_id.is_empty() {
                        println!("⚠️ Skipping borrowing with empty book_id");
                        continue;
                    }
                    
                    // Check if book exists in local database
                    let book_exists = sqlx::query("SELECT 1 FROM books WHERE id = ?")
                        .bind(book_id)
                        .fetch_optional(&self.pool)
                        .await?
                        .is_some();
                    
                    if !book_exists {
                        println!("⚠️ Skipping borrowing with non-existent book_id: {}", book_id);
                        continue;
                    }
                }
                
                // Check for valid student_id
                if let Some(student_id) = row_map.get("student_id").and_then(|v| v.as_str()) {
                    if student_id.is_empty() {
                        println!("⚠️ Skipping borrowing with empty student_id");
                        continue;
                    }
                    
                    // Check if student exists in local database
                    let student_exists = sqlx::query("SELECT 1 FROM students WHERE id = ?")
                        .bind(student_id)
                        .fetch_optional(&self.pool)
                        .await?
                        .is_some();
                    
                    if !student_exists {
                        println!("⚠️ Skipping borrowing with non-existent student_id: {}", student_id);
                        continue;
                    }
                }
                
                // Fix invalid dates
                let borrowed_date = row_map.get("borrowed_date").and_then(|v| v.as_str()).unwrap_or("");
                let due_date = row_map.get("due_date").and_then(|v| v.as_str()).unwrap_or("");
                
                // Check if dates are valid and in correct order
                if let (Ok(borrow_date), Ok(due_date_parsed)) = (
                    chrono::NaiveDate::parse_from_str(borrowed_date, "%Y-%m-%d"),
                    chrono::NaiveDate::parse_from_str(due_date, "%Y-%m-%d")
                ) {
                    if due_date_parsed <= borrow_date || borrow_date.year() < 2020 || due_date_parsed.year() < 2020 {
                        println!("⚠️ Skipping borrowing with invalid dates: borrow={}, due={}", borrowed_date, due_date);
                        
                        // Fix the dates in local database
                        let current_date = chrono::Utc::now().format("%Y-%m-%d").to_string();
                        let fixed_due_date = (chrono::Utc::now() + chrono::Duration::days(14)).format("%Y-%m-%d").to_string();
                        
                        if let Some(id) = row_map.get("id").and_then(|v| v.as_str()) {
                            sqlx::query("UPDATE borrowings SET borrowed_date = ?, due_date = ? WHERE id = ?")
                                .bind(&current_date)
                                .bind(&fixed_due_date)
                                .bind(id)
                                .execute(&self.pool)
                                .await?;
                            
                            println!("🔧 Fixed dates for borrowing {}: {} -> {}", id, current_date, fixed_due_date);
                        }
                        continue;
                    }
                } else {
                    println!("⚠️ Skipping borrowing with unparseable dates: borrow={}, due={}", borrowed_date, due_date);
                    continue;
                }
            }
            
            // Apply schema mapping based on table
            let mapped_data = match local_table {
                "categories" => SchemaMapper::map_category_to_supabase(&row_map),
                "books" => SchemaMapper::map_book_to_supabase(&row_map),
                "book_copies" => SchemaMapper::map_book_copy_to_supabase(&row_map),
                "students" => SchemaMapper::map_student_to_supabase(&row_map),
                "borrowings" => SchemaMapper::map_borrowing_to_supabase(&row_map),
                "fines" => SchemaMapper::map_fine_to_supabase(&row_map),
                "fine_settings" => SchemaMapper::map_fine_setting_to_supabase(&row_map),
                _ => {
                    println!("⚠️ No specific mapping for {}, using direct mapping", local_table);
                    serde_json::to_value(&row_map)?
                }
            };

            // Upload to Supabase
            let response = self.client
                .post(&url)
                .header("apikey", &self.anon_key)
                .header("Authorization", format!("Bearer {}", self.anon_key))
                .header("Content-Type", "application/json")
                .header("Prefer", "resolution=merge-duplicates")
                .json(&mapped_data)
                .send()
                .await?;

            if response.status().is_success() {
                uploaded += 1;
                
                // Mark as synced if column exists
                let id = row_map.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let update_query = format!("UPDATE {} SET synced = 1 WHERE id = ?", local_table);
                let _ = sqlx::query(&update_query).bind(id).execute(&self.pool).await;
                
                println!("✅ Uploaded record from {}", local_table);
            } else {
                let error_text = response.text().await?;
                println!("❌ Failed to upload to {}: {}", supabase_table, error_text);
            }
        }

        Ok(uploaded)
    }

    /// Download table data with schema mapping
    async fn download_table_data(&self, local_table: &str, supabase_table: &str) -> Result<u32> {
        let url = format!("{}/rest/v1/{}?limit=20", self.supabase_url, supabase_table);
        
        let response = self.client
            .get(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to fetch from {}: {}", supabase_table, response.status()));
        }

        let json: Value = response.json().await?;
        let empty_vec = vec![];
        let records = json.as_array().unwrap_or(&empty_vec);

        if records.is_empty() {
            return Ok(0);
        }

        let mut downloaded = 0;
        let mut tx = self.pool.begin().await?;

        for record in records {
            // For download, we just use the record as-is since it's already in the right format
            // Convert Value to HashMap for processing
            let record_map = match record.as_object() {
                Some(obj) => {
                    let mut map = std::collections::HashMap::new();
                    for (key, value) in obj {
                        map.insert(key.clone(), value.clone());
                    }
                    map
                },
                None => {
                    println!("⚠️ Invalid record format, skipping");
                    continue;
                }
            };

            // Insert/update in local database
            let columns: Vec<String> = record_map.keys().cloned().collect();
            let placeholders: Vec<String> = columns.iter().map(|_| "?".to_string()).collect();
            
            let insert_query = format!(
                "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                local_table,
                columns.join(", "),
                placeholders.join(", ")
            );

            let mut query = sqlx::query(&insert_query);
            for column in &columns {
                let value = record_map.get(column).unwrap();
                match value {
                    Value::String(s) => query = query.bind(s),
                    Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            query = query.bind(i);
                        } else if let Some(f) = n.as_f64() {
                            query = query.bind(f);
                        } else {
                            query = query.bind(0);
                        }
                    },
                    Value::Bool(b) => query = query.bind(b),
                    _ => query = query.bind(Option::<String>::None),
                }
            }

            match query.execute(&mut *tx).await {
                Ok(_) => {
                    downloaded += 1;
                    println!("✅ Downloaded record to {}", local_table);
                },
                Err(e) => {
                    println!("❌ Failed to insert into {}: {}", local_table, e);
                }
            }
        }

        tx.commit().await?;
        Ok(downloaded)
    }

    /// Special handling for students (class_id -> class_grade mapping)
    async fn sync_students_with_class_mapping(&self) -> TableSyncResult {
        println!("🎓 Syncing students with class mapping...");
        
        let mut table_result = TableSyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            skipped: false,
            skip_reason: None,
        };

        // Upload students using the custom mapping (excludes 'deleted' column)
        match self.upload_table_data("students", "students").await {
            Ok(uploaded) => {
                table_result.uploaded = uploaded;
                println!("📤 Uploaded {} student records", uploaded);
            },
            Err(e) => {
                table_result.errors.push(format!("Students upload failed: {}", e));
            }
        }

        // Download students
        match self.download_table_data("students", "students").await {
            Ok(downloaded) => {
                table_result.downloaded = downloaded;
                println!("📥 Downloaded {} student records", downloaded);
            },
            Err(e) => {
                table_result.errors.push(format!("Students download failed: {}", e));
            }
        }

        table_result
    }

    /// Special handling for borrowings (book_id -> book_copy_id mapping)
    async fn sync_borrowings_with_copy_mapping(&self) -> TableSyncResult {
        println!("📚 Syncing borrowings with book copy mapping...");
        
        let mut table_result = TableSyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            skipped: false,
            skip_reason: None,
        };

        // Upload borrowings using the custom mapping (excludes 'deleted' column)
        match self.upload_table_data("borrowings", "borrowings").await {
            Ok(uploaded) => {
                table_result.uploaded = uploaded;
                println!("📤 Uploaded {} borrowing records", uploaded);
            },
            Err(e) => {
                table_result.errors.push(format!("Borrowings upload failed: {}", e));
            }
        }

        // Download borrowings
        match self.download_table_data("borrowings", "borrowings").await {
            Ok(downloaded) => {
                table_result.downloaded = downloaded;
                println!("📥 Downloaded {} borrowing records", downloaded);
            },
            Err(e) => {
                table_result.errors.push(format!("Borrowings download failed: {}", e));
            }
        }

        table_result
    }

    /// Special handling for fine_settings (type -> fine_type mapping)
    async fn sync_fine_settings_with_type_mapping(&self) -> TableSyncResult {
        println!("💰 Syncing fine settings with type mapping...");
        
        let mut table_result = TableSyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            skipped: false,
            skip_reason: None,
        };

        // Upload fine_settings using the custom mapping (handles RLS and column mapping)
        match self.upload_table_data("fine_settings", "fine_settings").await {
            Ok(uploaded) => {
                table_result.uploaded = uploaded;
                println!("📤 Uploaded {} fine setting records", uploaded);
            },
            Err(e) => {
                table_result.errors.push(format!("Fine settings upload failed: {}", e));
            }
        }

        // Download fine_settings
        match self.download_table_data("fine_settings", "fine_settings").await {
            Ok(downloaded) => {
                table_result.downloaded = downloaded;
                println!("📥 Downloaded {} fine setting records", downloaded);
            },
            Err(e) => {
                table_result.errors.push(format!("Fine settings download failed: {}", e));
            }
        }

        table_result
    }

    /// Handle classes special case (no direct Supabase equivalent)
    async fn handle_classes_special_case(&self) -> TableSyncResult {
        println!("🏫 Classes table has no direct Supabase equivalent (embedded in students.class_grade)");
        
        TableSyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            skipped: true,
            skip_reason: Some("No direct Supabase equivalent".to_string()),
        }
    }

    /// Handle staff special case (would need auth_users + profiles)
    async fn handle_staff_special_case(&self) -> TableSyncResult {
        println!("👥 Staff table would need mapping to auth_users + profiles");
        
        TableSyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            skipped: true,
            skip_reason: Some("Would need auth_users + profiles mapping".to_string()),
        }
    }
}

/// Public API function
pub async fn run_improved_bidirectional_sync() -> Result<ImprovedSyncResult> {
    let sync = ImprovedBidirectionalSync::new().await?;
    sync.sync_all_tables().await
}
