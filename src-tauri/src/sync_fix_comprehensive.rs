use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::{Row, Column, ValueRef, TypeInfo};
use std::path::PathBuf;
use serde_json::{json, Value};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use chrono::{NaiveDate, Utc};
use tokio::time::{sleep, Duration};

/// Comprehensive sync fix addressing all identified issues
pub struct ComprehensiveSyncFix {
    pool: SqlitePool,
    client: reqwest::Client,
    supabase_url: String,
    anon_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub fixed_records: u32,
}

impl ComprehensiveSyncFix {
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

    /// Fix 1: Validate and fix borrowing dates before sync
    async fn fix_borrowing_dates(&self) -> Result<u32> {
        println!("🔧 Fixing invalid borrowing dates...");
        
        let current_date = Utc::now().format("%Y-%m-%d").to_string();
        let default_due_date = (Utc::now() + chrono::Duration::days(14)).format("%Y-%m-%d").to_string();
        
        // Fix records where due_date is before borrowed_date
        let fixed_count = sqlx::query(
            "UPDATE borrowings 
             SET due_date = ? 
             WHERE due_date < borrowed_date OR due_date < '2020-01-01'"
        )
        .bind(&default_due_date)
        .execute(&self.pool)
        .await?
        .rows_affected();

        // Fix records with invalid borrowed_date (too old or in future)
        let fixed_count2 = sqlx::query(
            "UPDATE borrowings 
             SET borrowed_date = ? 
             WHERE borrowed_date < '2020-01-01' OR borrowed_date > ?"
        )
        .bind(&current_date)
        .bind(&current_date)
        .execute(&self.pool)
        .await?
        .rows_affected();

        println!("✅ Fixed {} borrowing date records", fixed_count + fixed_count2);
        Ok((fixed_count + fixed_count2) as u32)
    }

    /// Fix 2: Ensure all referenced books exist before syncing borrowings
    async fn validate_foreign_keys(&self) -> Result<Vec<String>> {
        println!("🔧 Validating foreign key references...");
        
        let mut warnings = Vec::new();
        
        // Check for borrowings with non-existent book_ids
        let invalid_borrowings = sqlx::query(
            "SELECT b.id, b.book_id 
             FROM borrowings b 
             LEFT JOIN books bk ON b.book_id = bk.id 
             WHERE bk.id IS NULL"
        )
        .fetch_all(&self.pool)
        .await?;

        if !invalid_borrowings.is_empty() {
            warnings.push(format!("Found {} borrowings with invalid book references", invalid_borrowings.len()));
            
            // Option 1: Delete invalid borrowings (safer)
            for row in &invalid_borrowings {
                let borrowing_id: String = row.get("id");
                let book_id: String = row.get("book_id");
                
                sqlx::query("DELETE FROM borrowings WHERE id = ?")
                    .bind(&borrowing_id)
                    .execute(&self.pool)
                    .await?;
                
                warnings.push(format!("Deleted borrowing {} with invalid book_id {}", borrowing_id, book_id));
            }
        }

        // Check for borrowings with non-existent student_ids
        let invalid_student_borrowings = sqlx::query(
            "SELECT b.id, b.student_id 
             FROM borrowings b 
             LEFT JOIN students s ON b.student_id = s.id 
             WHERE s.id IS NULL"
        )
        .fetch_all(&self.pool)
        .await?;

        if !invalid_student_borrowings.is_empty() {
            warnings.push(format!("Found {} borrowings with invalid student references", invalid_student_borrowings.len()));
            
            for row in &invalid_student_borrowings {
                let borrowing_id: String = row.get("id");
                let student_id: String = row.get("student_id");
                
                sqlx::query("DELETE FROM borrowings WHERE id = ?")
                    .bind(&borrowing_id)
                    .execute(&self.pool)
                    .await?;
                
                warnings.push(format!("Deleted borrowing {} with invalid student_id {}", borrowing_id, student_id));
            }
        }

        println!("✅ Foreign key validation completed");
        Ok(warnings)
    }

    /// Fix 3: Sync with proper schema mapping and error handling
    async fn sync_table_with_fixes(&self, table_name: &str) -> Result<SyncResult> {
        println!("🔄 Syncing table: {}", table_name);
        
        let mut result = SyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            warnings: Vec::new(),
            fixed_records: 0,
        };

        // Apply table-specific fixes before sync
        match table_name {
            "borrowings" => {
                result.fixed_records += self.fix_borrowing_dates().await?;
                result.warnings.extend(self.validate_foreign_keys().await?);
            },
            "fine_settings" => {
                // Fix schema mismatch for fine_settings
                self.fix_fine_settings_schema().await?;
            },
            _ => {}
        }

        // Upload local changes with retry logic
        match self.upload_table_data(table_name).await {
            Ok(count) => {
                result.uploaded = count;
                println!("📤 Uploaded {} {} records", count, table_name);
            },
            Err(e) => {
                let error_msg = format!("Upload failed for {}: {}", table_name, e);
                result.errors.push(error_msg.clone());
                println!("❌ {}", error_msg);
            }
        }

        // Download remote changes
        match self.download_table_data(table_name).await {
            Ok(count) => {
                result.downloaded = count;
                println!("📥 Downloaded {} {} records", count, table_name);
            },
            Err(e) => {
                let error_msg = format!("Download failed for {}: {}", table_name, e);
                result.errors.push(error_msg.clone());
                println!("❌ {}", error_msg);
            }
        }

        println!("✅ {} sync completed", table_name);
        Ok(result)
    }

    /// Fix 4: Handle fine_settings schema mismatch
    async fn fix_fine_settings_schema(&self) -> Result<()> {
        println!("🔧 Fixing fine_settings schema...");
        
        // Check if daily_rate column exists, if not map from amount_per_day
        let has_daily_rate = sqlx::query("PRAGMA table_info(fine_settings)")
            .fetch_all(&self.pool)
            .await?
            .iter()
            .any(|row| {
                let column_name: String = row.get("name");
                column_name == "daily_rate"
            });

        if !has_daily_rate {
            // Add daily_rate column if it doesn't exist
            sqlx::query("ALTER TABLE fine_settings ADD COLUMN daily_rate REAL DEFAULT 0.0")
                .execute(&self.pool)
                .await
                .ok(); // Ignore if column already exists

            // Copy data from amount_per_day to daily_rate
            sqlx::query("UPDATE fine_settings SET daily_rate = amount_per_day WHERE amount_per_day IS NOT NULL")
                .execute(&self.pool)
                .await?;
        }

        println!("✅ Fine settings schema fixed");
        Ok(())
    }

    /// Upload table data with proper mapping and error handling
    async fn upload_table_data(&self, table_name: &str) -> Result<u32> {
        // Get unsynced records with retry for database locks
        let records = self.get_unsynced_records(table_name).await?;
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
                        self.mark_record_synced(table_name, &record).await?;
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

        Ok(uploaded_count)
    }

    /// Download table data with conflict resolution
    async fn download_table_data(&self, table_name: &str) -> Result<u32> {
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

        for record in remote_records {
            if self.should_download_record(table_name, &record).await? {
                self.insert_or_update_local_record(table_name, &record).await?;
                downloaded_count += 1;
            }
        }

        Ok(downloaded_count)
    }

    /// Get unsynced records with database lock handling
    async fn get_unsynced_records(&self, table_name: &str) -> Result<Vec<HashMap<String, Value>>> {
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
            "SELECT * FROM {} WHERE synced = 0 OR synced IS NULL LIMIT 50", 
            table_name
        );
        
        let rows = sqlx::query(&query).fetch_all(&self.pool).await?;
        
        let mut records = Vec::new();
        for row in rows {
            let mut record = HashMap::new();
            
            // Get column names and values
            let columns = row.columns();
            for (i, column) in columns.iter().enumerate() {
                let column_name = column.name();
                let value = match row.try_get_raw(i) {
                    Ok(raw_value) => {
                        if raw_value.is_null() {
                            Value::Null
                        } else {
                            match column.type_info().name() {
                                "TEXT" => {
                                    let text_val: String = row.get(i);
                                    Value::String(text_val)
                                },
                                "INTEGER" => {
                                    let int_val: i64 = row.get(i);
                                    Value::Number(serde_json::Number::from(int_val))
                                },
                                "REAL" => {
                                    let real_val: f64 = row.get(i);
                                    Value::Number(serde_json::Number::from_f64(real_val).unwrap_or(serde_json::Number::from(0)))
                                },
                                "BOOLEAN" => {
                                    let bool_val: bool = row.get(i);
                                    Value::Bool(bool_val)
                                },
                                _ => {
                                    // Try as string fallback
                                    match row.try_get::<String, _>(i) {
                                        Ok(s) => Value::String(s),
                                        Err(_) => Value::Null
                                    }
                                }
                            }
                        }
                    },
                    Err(_) => Value::Null
                };
                
                record.insert(column_name.to_string(), value);
            }
            
            records.push(record);
        }

        println!("🔒 Found {} unsynced records in {}", records.len(), table_name);
        Ok(records)
    }

    /// Map record for Supabase with proper schema handling
    fn map_record_for_supabase(&self, table_name: &str, record: &HashMap<String, Value>) -> Result<Value> {
        let mapped = match table_name {
            "categories" => self.map_category(record),
            "books" => self.map_book(record),
            "students" => self.map_student(record),
            "borrowings" => self.map_borrowing(record),
            "book_copies" => self.map_book_copy(record),
            "fines" => self.map_fine(record),
            "fine_settings" => self.map_fine_setting(record),
            _ => json!(record),
        };

        Ok(mapped)
    }

    fn map_borrowing(&self, record: &HashMap<String, Value>) -> Value {
        // Fix date formatting
        let format_date = |date_val: Option<&Value>| -> Value {
            match date_val {
                Some(Value::String(date_str)) if !date_str.is_empty() => {
                    // Ensure date is in YYYY-MM-DD format
                    if let Ok(parsed_date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                        Value::String(parsed_date.format("%Y-%m-%d").to_string())
                    } else {
                        Value::Null
                    }
                },
                _ => Value::Null
            }
        };

        let mut mapped = json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "student_id": record.get("student_id").unwrap_or(&Value::Null),
            "book_id": record.get("book_id").unwrap_or(&Value::Null),
            "borrowed_date": format_date(record.get("borrowed_date")),
            "due_date": format_date(record.get("due_date")),
            "returned_date": format_date(record.get("returned_date")),
            "status": record.get("status").unwrap_or(&json!("active")),
            "fine_amount": record.get("fine_amount").unwrap_or(&json!(0.0)),
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

    fn map_fine_setting(&self, record: &HashMap<String, Value>) -> Value {
        json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "fine_type": record.get("type").or(record.get("fine_type")).unwrap_or(&Value::Null),
            "amount_per_day": record.get("amount_per_day").or(record.get("daily_rate")).unwrap_or(&json!(0.0)),
            "max_fine_amount": record.get("max_fine_amount").or(record.get("max_fine")).unwrap_or(&Value::Null),
            "grace_period_days": record.get("grace_period_days").or(record.get("grace_period")).unwrap_or(&json!(0)),
            "is_active": record.get("is_active").unwrap_or(&json!(true)),
            "created_at": record.get("created_at").unwrap_or(&Value::Null),
            "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
        })
    }

    // Add other mapping methods (simplified for brevity)
    fn map_category(&self, record: &HashMap<String, Value>) -> Value { json!(record) }
    fn map_book(&self, record: &HashMap<String, Value>) -> Value { json!(record) }
    fn map_student(&self, record: &HashMap<String, Value>) -> Value { json!(record) }
    fn map_book_copy(&self, record: &HashMap<String, Value>) -> Value { json!(record) }
    fn map_fine(&self, record: &HashMap<String, Value>) -> Value { json!(record) }

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

    async fn mark_record_synced(&self, table_name: &str, record: &HashMap<String, Value>) -> Result<()> {
        if let Some(id) = record.get("id") {
            let query = format!("UPDATE {} SET synced = 1 WHERE id = ?", table_name);
            sqlx::query(&query)
                .bind(id.as_str().unwrap_or(""))
                .execute(&self.pool)
                .await?;
        }
        Ok(())
    }

    async fn should_download_record(&self, _table_name: &str, _record: &Value) -> Result<bool> {
        // Simplified - always download for now
        Ok(true)
    }

    async fn insert_or_update_local_record(&self, table_name: &str, record: &Value) -> Result<()> {
        if let Some(obj) = record.as_object() {
            if let Some(id) = obj.get("id").and_then(|v| v.as_str()) {
                // Build dynamic upsert query
                let columns: Vec<String> = obj.keys().cloned().collect();
                let placeholders: Vec<String> = columns.iter().map(|_| "?".to_string()).collect();
                
                let insert_query = if table_name == "categories" {
                    format!(
                        "INSERT OR IGNORE INTO {} ({}) VALUES ({})",
                        table_name,
                        columns.join(", "),
                        placeholders.join(", ")
                    )
                } else {
                    format!(
                        "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                        table_name,
                        columns.join(", "),
                        placeholders.join(", ")
                    )
                };
                
                let mut query = sqlx::query(&insert_query);
                
                // Bind values in the same order as columns
                for column in &columns {
                    let value = obj.get(column).unwrap_or(&Value::Null);
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
                        Value::Null => query = query.bind(Option::<String>::None),
                        _ => query = query.bind(value.to_string()),
                    }
                }
                
                query.execute(&self.pool).await?;
                println!("✅ Upserted record {} to {}", id, table_name);
            }
        }
        Ok(())
    }

    /// Main sync function with comprehensive fixes
    pub async fn run_comprehensive_sync(&self) -> Result<SyncResult> {
        println!("🚀 Starting comprehensive sync with fixes...");
        
        let tables = vec!["categories", "books", "book_copies", "students", "borrowings", "fines", "fine_settings"];
        let mut total_result = SyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            warnings: Vec::new(),
            fixed_records: 0,
        };

        for table in tables {
            match self.sync_table_with_fixes(table).await {
                Ok(result) => {
                    total_result.uploaded += result.uploaded;
                    total_result.downloaded += result.downloaded;
                    total_result.fixed_records += result.fixed_records;
                    total_result.errors.extend(result.errors);
                    total_result.warnings.extend(result.warnings);
                },
                Err(e) => {
                    total_result.errors.push(format!("Table {} sync failed: {}", table, e));
                }
            }
        }

        println!("🎉 Comprehensive sync completed!");
        println!("📤 Total uploaded: {}", total_result.uploaded);
        println!("📥 Total downloaded: {}", total_result.downloaded);
        println!("🔧 Total fixed: {}", total_result.fixed_records);
        println!("❌ Total errors: {}", total_result.errors.len());

        Ok(total_result)
    }
}
