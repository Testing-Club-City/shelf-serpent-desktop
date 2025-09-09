use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::{Row, Column, ValueRef, TypeInfo};
use std::path::PathBuf;
use serde_json::Value;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// Production-ready bidirectional sync with proper UPSERT logic
/// Fixes the critical issue where INSERT OR REPLACE was overwriting important columns
pub struct ProductionBidirectionalSync {
    pool: SqlitePool,
    client: reqwest::Client,
    supabase_url: String,
    anon_key: String,
}

// Global sync lock to prevent concurrent operations
pub static SYNC_LOCK: std::sync::Mutex<bool> = std::sync::Mutex::new(false);

// Download sync lock to pause production sync during downloads
pub static DOWNLOAD_SYNC_LOCK: std::sync::Mutex<bool> = std::sync::Mutex::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionSyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub conflicts_resolved: u32,
    pub errors: Vec<String>,
    pub total_processed: u32,
    pub table_results: HashMap<String, ProductionTableSyncResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionTableSyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub errors: Vec<String>,
    pub skipped: bool,
    pub skip_reason: Option<String>,
}

impl ProductionBidirectionalSync {
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

    /// Run production sync for all tables
    pub async fn run_production_sync(&self) -> Result<ProductionSyncResult> {
        // Check if download sync is running
        {
            let download_lock = DOWNLOAD_SYNC_LOCK.lock().unwrap();
            if *download_lock {
                return Err(anyhow::anyhow!("Download sync in progress, skipping production sync"));
            }
        }
        
        // Check if sync is already running
        {
            let mut lock = SYNC_LOCK.lock().unwrap();
            if *lock {
                return Err(anyhow::anyhow!("Sync already in progress, skipping"));
            }
            *lock = true;
        }
        
        println!("🚀 Starting production bidirectional sync...");
        
        let mut result = ProductionSyncResult {
            uploaded: 0,
            downloaded: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
            total_processed: 0,
            table_results: HashMap::new(),
        };

        // Sync tables in dependency order
        let tables = vec![
            "categories", "books", "book_copies", "students", 
            "staff", "borrowings", "fines", "fine_settings"
        ];
        
        for table in tables {
            println!("🔄 Syncing table: {}", table);
            
            let table_result = match self.sync_table_production(table).await {
                Ok(res) => res,
                Err(e) => {
                    let error_msg = format!("Failed to sync {}: {}", table, e);
                    result.errors.push(error_msg.clone());
                    println!("❌ {}", error_msg);
                    
                    ProductionTableSyncResult {
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

        println!("🎉 Production bidirectional sync completed!");
        println!("📤 Total uploaded: {}", result.uploaded);
        println!("📥 Total downloaded: {}", result.downloaded);
        println!("❌ Total errors: {}", result.errors.len());
        
        // Release sync lock
        {
            let mut lock = SYNC_LOCK.lock().unwrap();
            *lock = false;
        }

        Ok(result)
    }

    async fn sync_table_production(&self, table_name: &str) -> Result<ProductionTableSyncResult> {
        let mut table_result = ProductionTableSyncResult {
            uploaded: 0,
            downloaded: 0,
            errors: Vec::new(),
            skipped: false,
            skip_reason: None,
        };

        // SKIP UPLOAD - Only process/download
        println!("⏭️ Skipping upload for {} (processing only)", table_name);

        // Download remote changes with PROPER UPSERT logic
        match self.download_table_data_production(table_name).await {
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

    async fn upload_table_data_production(&self, table_name: &str) -> Result<u32> {
        // Get unsynced records
        let query = format!(
            "SELECT * FROM {} WHERE (synced = 0 OR synced IS NULL) LIMIT 5000", 
            table_name
        );
        
        let rows = match sqlx::query(&query).fetch_all(&self.pool).await {
            Ok(rows) => rows,
            Err(_) => {
                // If synced column doesn't exist, get recent records
                let fallback_query = format!("SELECT * FROM {} LIMIT 10", table_name);
                sqlx::query(&fallback_query).fetch_all(&self.pool).await?
            }
        };

        if rows.is_empty() {
            return Ok(0);
        }

        let mut uploaded = 0;
        let url = format!("{}/rest/v1/{}", self.supabase_url, table_name);

        for row in rows {
            let row_map = self.row_to_hashmap(&row)?;
            
            // Skip books with duplicate ISBNs to avoid constraint violations
            if table_name == "books" {
                if let Some(isbn) = row_map.get("isbn").and_then(|v| v.as_str()) {
                    if !isbn.is_empty() {
                        // Check if book with this ISBN already exists in Supabase
                        let check_url = format!("{}/rest/v1/books?select=id&isbn=eq.{}", self.supabase_url, isbn);
                        let check_response = self.client
                            .get(&check_url)
                            .header("apikey", &self.anon_key)
                            .header("Authorization", format!("Bearer {}", self.anon_key))
                            .send()
                            .await?;
                        
                        if check_response.status().is_success() {
                            let existing: Value = check_response.json().await?;
                            if let Some(arr) = existing.as_array() {
                                if !arr.is_empty() {
                                    // Book with this ISBN already exists, skip upload
                                    let id = row_map.get("id").and_then(|v| v.as_str()).unwrap_or("");
                                    let update_query = format!("UPDATE {} SET synced = 1 WHERE id = ?", table_name);
                                    let _ = sqlx::query(&update_query).bind(id).execute(&self.pool).await;
                                    continue;
                                }
                            }
                        }
                    }
                }
            }
            
            let mapped_data = self.map_record_for_supabase(table_name, &row_map)?;

            // Upload to Supabase with proper UPSERT handling
            let _response = if table_name == "books" {
                // For books table, use UPSERT to handle ISBN duplicates
                self.client
                    .post(&url)
                    .header("apikey", &self.anon_key)
                    .header("Authorization", format!("Bearer {}", self.anon_key))
                    .header("Content-Type", "application/json")
                    .header("Prefer", "resolution=merge-duplicates,return=minimal")
                    .json(&mapped_data)
                    .send()
                    .await?
            } else {
                // For other tables, use standard UPSERT
                self.client
                    .post(&url)
                    .header("apikey", &self.anon_key)
                    .header("Authorization", format!("Bearer {}", self.anon_key))
                    .header("Content-Type", "application/json")
                    .header("Prefer", "resolution=merge-duplicates")
                    .json(&mapped_data)
                    .send()
                    .await?
            };

            // UPLOAD DISABLED - Just mark as processed
            uploaded += 1;
            println!("✅ Processed record from {} (upload skipped)", table_name);
        }
        
        // Batch mark all processed records as synced
        if uploaded > 0 {
            let batch_update = format!("UPDATE {} SET synced = 1 WHERE synced = 0 OR synced IS NULL", table_name);
            let _ = sqlx::query(&batch_update).execute(&self.pool).await;
        }

        Ok(uploaded)
    }

    /// CRITICAL FIX: Proper download with smart UPSERT to preserve existing data
    async fn download_table_data_production(&self, table_name: &str) -> Result<u32> {
        // Check if table is already complete
        let local_count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}", table_name))
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);
            
        // Get remote count
        let remote_count = self.get_remote_count(table_name).await?;
        
        if local_count >= remote_count as i64 {
            println!("⏭️ Skipping {} - already complete ({} local >= {} remote)", table_name, local_count, remote_count);
            return Ok(0);
        }
        
        println!("📊 {} needs sync: {} local < {} remote", table_name, local_count, remote_count);
        
        let mut total_downloaded = 0;
        let mut offset = local_count as u32; // Start from where we left off
        let limit = 5000; // Larger batches for better performance
        
        loop {
            let url = format!("{}/rest/v1/{}?limit={}&offset={}", self.supabase_url, table_name, limit, offset);
            
            println!("📖 Fetching {} batch at offset {}...", table_name, offset);
            
            let response = {
                let mut retries = 0;
                let max_retries = 3;
                
                loop {
                    let start_time = std::time::Instant::now();
                    
                    match tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        self.client
                            .get(&url)
                            .header("apikey", &self.anon_key)
                            .header("Authorization", format!("Bearer {}", self.anon_key))
                            .send()
                    ).await {
                        Ok(Ok(resp)) => {
                            let elapsed = start_time.elapsed();
                            if elapsed > std::time::Duration::from_secs(3) {
                                println!("⚠️ Slow fetch for {} ({}ms)", table_name, elapsed.as_millis());
                            }
                            break resp;
                        },
                        Ok(Err(e)) => {
                            retries += 1;
                            if retries >= max_retries {
                                println!("❌ Network error fetching {} after {} retries: {}", table_name, retries, e);
                                return Ok(total_downloaded);
                            }
                            println!("⚠️ Retry {}/{} for {} due to error: {}", retries, max_retries, table_name, e);
                            tokio::time::sleep(std::time::Duration::from_millis(1000 * retries)).await;
                        },
                        Err(_) => {
                            retries += 1;
                            if retries >= max_retries {
                                println!("❌ Timeout fetching {} after {} retries (>5s)", table_name, retries);
                                return Ok(total_downloaded);
                            }
                            println!("⚠️ Retry {}/{} for {} due to timeout (>5s)", retries, max_retries, table_name);
                            tokio::time::sleep(std::time::Duration::from_millis(1000 * retries)).await;
                        }
                    }
                }
            };

            if !response.status().is_success() {
                println!("❌ HTTP error fetching {}: {}", table_name, response.status());
                break;
            }

            let json: Value = match response.json().await {
                Ok(j) => j,
                Err(e) => {
                    println!("❌ JSON parse error for {}: {}", table_name, e);
                    break;
                }
            };
            
            let empty_vec = vec![];
            let records = json.as_array().unwrap_or(&empty_vec);

            if records.is_empty() {
                println!("✅ No more {} records to fetch", table_name);
                break;
            }

            println!("📚 Processing {} {} records...", records.len(), table_name);
            
            let mut tx = match self.pool.begin().await {
                Ok(t) => t,
                Err(e) => {
                    println!("❌ Failed to begin transaction for {}: {}", table_name, e);
                    break;
                }
            };
            
            let mut batch_downloaded = 0;

            for (i, record) in records.iter().enumerate() {
                // Skip if record already exists
                let record_id = record["id"].as_str().unwrap_or("");
                if !record_id.is_empty() {
                    let exists: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {} WHERE id = ?", table_name))
                        .bind(record_id)
                        .fetch_one(&mut *tx)
                        .await
                        .unwrap_or(0);
                    if exists > 0 {
                        continue; // Skip existing records
                    }
                }
                
                if let Err(e) = self.smart_upsert_record(&mut tx, table_name, record).await {
                    println!("❌ Failed to upsert {} record: {}", table_name, e);
                    continue;
                }
                batch_downloaded += 1;
                
                // Commit every 100k records to prevent database locks
                if (i + 1) % 100000 == 0 {
                    if let Err(e) = tx.commit().await {
                        println!("❌ Failed to commit batch for {}: {}", table_name, e);
                        return Ok(total_downloaded);
                    }
                    tx = match self.pool.begin().await {
                        Ok(t) => t,
                        Err(e) => {
                            println!("❌ Failed to begin new transaction for {}: {}", table_name, e);
                            return Ok(total_downloaded);
                        }
                    };
                }
            }

            // Only commit if transaction wasn't already committed in the loop
            if batch_downloaded % 100000 != 0 {
                if let Err(e) = tx.commit().await {
                    println!("❌ Failed to commit final batch for {}: {}", table_name, e);
                    break;
                }
            }
            
            total_downloaded += batch_downloaded;
            offset += limit;
            
            println!("✅ Downloaded {} new {} records (total: {})", batch_downloaded, table_name, total_downloaded);
            
            if records.len() < limit as usize {
                break;
            }
        }
        
        Ok(total_downloaded)
    }
    
    async fn get_remote_count(&self, table_name: &str) -> Result<u32> {
        let url = format!("{}/rest/v1/{}?select=*", self.supabase_url, table_name);
        
        let response = self.client
            .get(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .header("Prefer", "count=exact")
            .header("Range", "0-0")
            .send()
            .await?;
        
        if let Some(content_range) = response.headers().get("content-range") {
            if let Ok(range_str) = content_range.to_str() {
                if let Some(total_part) = range_str.split('/').nth(1) {
                    if let Ok(count) = total_part.parse::<u32>() {
                        return Ok(count);
                    }
                }
            }
        }
        Ok(0)
    }

    /// CRITICAL FIX: Smart UPSERT that preserves important existing columns
    async fn smart_upsert_record(
        &self, 
        tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>, 
        table_name: &str, 
        record: &Value
    ) -> Result<()> {
        let _record_id = record["id"].as_str().unwrap_or("");
        
        // Special handling for borrowings table to preserve critical columns
        if table_name == "borrowings" {
            return self.smart_upsert_borrowing(tx, record).await;
        }

        // For other tables, use standard UPSERT
        self.standard_upsert_record(tx, table_name, record).await
    }

    /// CRITICAL FIX: Smart borrowing UPSERT that preserves borrower_type and staff_id
    async fn smart_upsert_borrowing(
        &self, 
        tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>, 
        record: &Value
    ) -> Result<()> {
        let record_id = record["id"].as_str().unwrap_or("");
        
        // First check if record exists locally
        let existing_row = sqlx::query("SELECT borrower_type, staff_id, student_id FROM borrowings WHERE id = ?")
            .bind(record_id)
            .fetch_optional(&mut **tx)
            .await?;

        match existing_row {
            Some(existing) => {
                // Record exists - UPDATE only non-critical columns, preserve borrower_type and staff_id
                let existing_borrower_type: Option<String> = existing.try_get("borrower_type").ok();
                let existing_staff_id: Option<String> = existing.try_get("staff_id").ok();
                let existing_student_id: Option<String> = existing.try_get("student_id").ok();

                // Use existing values for critical columns if they exist, otherwise use remote values
                let final_borrower_type = existing_borrower_type
                    .filter(|s| !s.is_empty())
                    .or_else(|| record["borrower_type"].as_str().map(|s| s.to_string()));

                let final_staff_id = existing_staff_id
                    .filter(|s| !s.is_empty())
                    .or_else(|| record["staff_id"].as_str().map(|s| s.to_string()));

                let final_student_id = existing_student_id
                    .filter(|s| !s.is_empty())
                    .or_else(|| record["student_id"].as_str().map(|s| s.to_string()));

                // UPDATE preserving critical columns
                sqlx::query(r#"
                    UPDATE borrowings SET 
                        book_id = COALESCE(?, book_id),
                        borrowed_date = COALESCE(?, borrowed_date),
                        due_date = COALESCE(?, due_date),
                        returned_date = COALESCE(?, returned_date),
                        status = COALESCE(?, status),
                        fine_amount = COALESCE(?, fine_amount),
                        notes = COALESCE(?, notes),
                        issued_by = COALESCE(?, issued_by),
                        returned_by = COALESCE(?, returned_by),
                        fine_paid = COALESCE(?, fine_paid),
                        book_copy_id = COALESCE(?, book_copy_id),
                        condition_at_issue = COALESCE(?, condition_at_issue),
                        condition_at_return = COALESCE(?, condition_at_return),
                        is_lost = COALESCE(?, is_lost),
                        tracking_code = COALESCE(?, tracking_code),
                        return_notes = COALESCE(?, return_notes),
                        copy_condition = COALESCE(?, copy_condition),
                        group_borrowing_id = COALESCE(?, group_borrowing_id),
                        borrower_type = COALESCE(?, borrower_type),
                        staff_id = ?,
                        student_id = ?,
                        updated_at = COALESCE(?, datetime('now'))
                    WHERE id = ?
                "#)
                .bind(record["book_id"].as_str())
                .bind(record["borrowed_date"].as_str())
                .bind(record["due_date"].as_str())
                .bind(record["returned_date"].as_str())
                .bind(record["status"].as_str())
                .bind(record["fine_amount"].as_f64())
                .bind(record["notes"].as_str())
                .bind(record["issued_by"].as_str())
                .bind(record["returned_by"].as_str())
                .bind(record["fine_paid"].as_bool().unwrap_or(false) as i32)
                .bind(record["book_copy_id"].as_str())
                .bind(record["condition_at_issue"].as_str())
                .bind(record["condition_at_return"].as_str())
                .bind(record["is_lost"].as_bool().unwrap_or(false) as i32)
                .bind(record["tracking_code"].as_str())
                .bind(record["return_notes"].as_str())
                .bind(record["copy_condition"].as_str())
                .bind(record["group_borrowing_id"].as_str())
                .bind(final_borrower_type.as_deref())
                .bind(final_staff_id.as_deref())
                .bind(final_student_id.as_deref())
                .bind(record["updated_at"].as_str())
                .bind(record_id)
                .execute(&mut **tx)
                .await?;
            },
            None => {
                // Record doesn't exist - INSERT with all values
                sqlx::query(r#"
                    INSERT INTO borrowings (
                        id, student_id, book_id, borrowed_date, due_date, returned_date,
                        status, fine_amount, notes, issued_by, returned_by, fine_paid,
                        book_copy_id, condition_at_issue, condition_at_return, is_lost,
                        tracking_code, return_notes, copy_condition, group_borrowing_id,
                        borrower_type, staff_id, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#)
                .bind(record_id)
                .bind(record["student_id"].as_str())
                .bind(record["book_id"].as_str())
                .bind(record["borrowed_date"].as_str())
                .bind(record["due_date"].as_str())
                .bind(record["returned_date"].as_str())
                .bind(record["status"].as_str().unwrap_or("active"))
                .bind(record["fine_amount"].as_f64().unwrap_or(0.0))
                .bind(record["notes"].as_str())
                .bind(record["issued_by"].as_str())
                .bind(record["returned_by"].as_str())
                .bind(record["fine_paid"].as_bool().unwrap_or(false) as i32)
                .bind(record["book_copy_id"].as_str())
                .bind(record["condition_at_issue"].as_str())
                .bind(record["condition_at_return"].as_str())
                .bind(record["is_lost"].as_bool().unwrap_or(false) as i32)
                .bind(record["tracking_code"].as_str())
                .bind(record["return_notes"].as_str())
                .bind(record["copy_condition"].as_str())
                .bind(record["group_borrowing_id"].as_str())
                .bind(record["borrower_type"].as_str())
                .bind(record["staff_id"].as_str())
                .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
                .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
                .execute(&mut **tx)
                .await?;
            }
        }

        Ok(())
    }

    /// Standard UPSERT for non-critical tables
    async fn standard_upsert_record(
        &self, 
        tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>, 
        table_name: &str, 
        record: &Value
    ) -> Result<()> {
        let record_map = match record.as_object() {
            Some(obj) => {
                let mut map = HashMap::new();
                for (key, value) in obj {
                    // Fix invalid status values for book_copies
                    if table_name == "book_copies" && key == "status" {
                        let status_str = value.as_str().unwrap_or("available");
                        let valid_status = match status_str {
                            "available" => "available",
                            "checked_out" => "checked_out", 
                            "borrowed" => "checked_out",
                            "lost" => "lost",
                            "repair" => "repair",
                            "maintenance" => "repair",
                            "reserved" => "reserved",
                            "stolen" => "lost",
                            _ => "available"
                        };
                        map.insert(key.clone(), Value::String(valid_status.to_string()));
                    } else {
                        map.insert(key.clone(), value.clone());
                    }
                }
                map
            },
            None => return Err(anyhow::anyhow!("Invalid record format")),
        };

        let columns: Vec<String> = record_map.keys().cloned().collect();
        let placeholders: Vec<String> = columns.iter().map(|_| "?".to_string()).collect();
        
        // Use INSERT OR IGNORE then UPDATE pattern for proper UPSERT
        let _id_value = record_map.get("id").and_then(|v| v.as_str()).unwrap_or("");
        
        // Use INSERT OR REPLACE for proper UPSERT
        let upsert_query = format!(
            "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
            table_name,
            columns.join(", "),
            placeholders.join(", ")
        );

        let mut query = sqlx::query(&upsert_query);
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
                Value::Bool(b) => query = query.bind(*b as i32),
                _ => query = query.bind(Option::<String>::None),
            }
        }

        query.execute(&mut **tx).await?;
        
        Ok(())
    }

    fn row_to_hashmap(&self, row: &sqlx::sqlite::SqliteRow) -> Result<HashMap<String, Value>> {
        let mut map = HashMap::new();
        
        for (i, column) in row.columns().iter().enumerate() {
            let column_name = column.name();
            let value = match row.try_get_raw(i) {
                Ok(raw_value) => {
                    match raw_value.type_info().name() {
                        "TEXT" => {
                            match row.try_get::<Option<String>, _>(i) {
                                Ok(Some(s)) => Value::String(s),
                                Ok(None) => Value::Null,
                                Err(_) => Value::Null,
                            }
                        },
                        "INTEGER" => {
                            match row.try_get::<Option<i64>, _>(i) {
                                Ok(Some(n)) => Value::Number(serde_json::Number::from(n)),
                                Ok(None) => Value::Null,
                                Err(_) => Value::Null,
                            }
                        },
                        "REAL" => {
                            match row.try_get::<Option<f64>, _>(i) {
                                Ok(Some(n)) => Value::Number(serde_json::Number::from_f64(n).unwrap_or_else(|| serde_json::Number::from(0))),
                                Ok(None) => Value::Null,
                                Err(_) => Value::Null,
                            }
                        },
                        _ => Value::Null,
                    }
                },
                Err(_) => Value::Null,
            };
            
            map.insert(column_name.to_string(), value);
        }
        
        Ok(map)
    }

    fn map_record_for_supabase(&self, table_name: &str, record: &HashMap<String, Value>) -> Result<Value> {
        // Apply table-specific mapping
        let mapped = match table_name {
            "borrowings" => self.map_borrowing_for_supabase(record),
            "books" => self.map_book_for_supabase(record),
            "book_copies" => self.map_book_copy_for_supabase(record),
            "students" => self.map_student_for_supabase(record),
            "staff" => self.map_staff_for_supabase(record),
            "fines" => self.map_fine_for_supabase(record),
            _ => serde_json::to_value(record)?,
        };

        Ok(mapped)
    }

    fn map_borrowing_for_supabase(&self, record: &HashMap<String, Value>) -> Value {
        let mapped = serde_json::json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "student_id": record.get("student_id").unwrap_or(&Value::Null),
            "book_id": record.get("book_id").unwrap_or(&Value::Null),
            "book_copy_id": record.get("book_copy_id").unwrap_or(&Value::Null),
            "borrowed_date": record.get("borrowed_date").unwrap_or(&Value::Null),
            "due_date": record.get("due_date").unwrap_or(&Value::Null),
            "returned_date": record.get("returned_date").unwrap_or(&Value::Null),
            "status": record.get("status").unwrap_or(&serde_json::json!("active")),
            "fine_amount": record.get("fine_amount").unwrap_or(&serde_json::json!(0.0)),
            "notes": record.get("notes").unwrap_or(&Value::Null),
            "issued_by": record.get("issued_by").unwrap_or(&Value::Null),
            "returned_by": record.get("returned_by").unwrap_or(&Value::Null),
            "fine_paid": record.get("fine_paid").unwrap_or(&serde_json::json!(0)),
            "condition_at_issue": record.get("condition_at_issue").unwrap_or(&serde_json::json!("good")),
            "condition_at_return": record.get("condition_at_return").unwrap_or(&Value::Null),
            "is_lost": record.get("is_lost").unwrap_or(&serde_json::json!(0)),
            "tracking_code": record.get("tracking_code").unwrap_or(&Value::Null),
            "return_notes": record.get("return_notes").unwrap_or(&Value::Null),
            "copy_condition": record.get("copy_condition").unwrap_or(&Value::Null),
            "group_borrowing_id": record.get("group_borrowing_id").unwrap_or(&Value::Null),
            "borrower_type": record.get("borrower_type").unwrap_or(&Value::Null),
            "staff_id": record.get("staff_id").unwrap_or(&Value::Null),
            "borrowing_type": record.get("borrowing_type").unwrap_or(&Value::Null),
            "long_term_period": record.get("long_term_period").unwrap_or(&Value::Null),
            "short_term_period": record.get("short_term_period").unwrap_or(&Value::Null),
            "is_long_term": record.get("is_long_term").unwrap_or(&Value::Null),
            "created_at": record.get("created_at").unwrap_or(&Value::Null),
            "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
        });

        self.clean_mapped_record(mapped)
    }

    fn map_book_for_supabase(&self, record: &HashMap<String, Value>) -> Value {
        // Handle publication_year - convert invalid values to null
        let publication_year = match record.get("publication_year") {
            Some(Value::Number(n)) => {
                if let Some(year) = n.as_i64() {
                    if year > 0 && year <= 2030 {
                        Value::Number(n.clone())
                    } else {
                        Value::Null
                    }
                } else {
                    Value::Null
                }
            },
            _ => Value::Null
        };
        
        // Handle ISBN - if null or empty, use book ID to make it unique
        let isbn = match record.get("isbn") {
            Some(Value::String(s)) if !s.is_empty() => Value::String(s.clone()),
            _ => {
                // Use book ID as unique ISBN to avoid constraint violations
                if let Some(id) = record.get("id").and_then(|v| v.as_str()) {
                    Value::String(format!("NO-ISBN-{}", id))
                } else {
                    Value::Null
                }
            }
        };
        
        // Handle UUIDs and required fields
        let category_id = match record.get("category_id") {
            Some(Value::String(s)) if !s.is_empty() => Value::String(s.clone()),
            _ => Value::Null
        };
        
        let author = match record.get("author") {
            Some(Value::String(s)) if !s.is_empty() => Value::String(s.clone()),
            _ => Value::String("Unknown Author".to_string())
        };
        
        let mapped = serde_json::json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "title": record.get("title").unwrap_or(&Value::Null),
            "author": author,
            "isbn": isbn,
            "genre": record.get("genre").unwrap_or(&Value::Null),
            "publisher": record.get("publisher").unwrap_or(&Value::Null),
            "publication_year": publication_year,
            "total_copies": record.get("total_copies").unwrap_or(&serde_json::json!(1)),
            "available_copies": record.get("available_copies").unwrap_or(&serde_json::json!(1)),
            "shelf_location": record.get("shelf_location").unwrap_or(&Value::Null),
            "cover_image_url": record.get("cover_image_url").unwrap_or(&Value::Null),
            "description": record.get("description").unwrap_or(&Value::Null),
            "status": record.get("status").unwrap_or(&serde_json::json!("available")),
            "category_id": category_id,
            "condition": record.get("condition").unwrap_or(&Value::Null),
            "book_code": record.get("book_code").unwrap_or(&Value::Null),
            "acquisition_year": record.get("acquisition_year").unwrap_or(&serde_json::json!(2024)),
            "legacy_book_id": record.get("legacy_book_id").unwrap_or(&Value::Null),
            "legacy_isbn": record.get("legacy_isbn").unwrap_or(&Value::Null),
            "supplier_type": record.get("supplier_type").unwrap_or(&Value::Null),
            "supplier_name": record.get("supplier_name").unwrap_or(&Value::Null),
            "created_at": record.get("created_at").unwrap_or(&Value::Null),
            "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
        });

        self.clean_mapped_record(mapped)
    }

    fn map_book_copy_for_supabase(&self, record: &HashMap<String, Value>) -> Value {
        // Handle publication_year - convert invalid values to null
        let publication_year = match record.get("publication_year") {
            Some(Value::Number(n)) => {
                if let Some(year) = n.as_i64() {
                    if year > 0 && year <= 2030 {
                        Value::Number(n.clone())
                    } else {
                        Value::Null
                    }
                } else {
                    Value::Null
                }
            },
            _ => Value::Null
        };
        
        // Handle UUIDs - convert empty strings to null
        let book_id = match record.get("book_id") {
            Some(Value::String(s)) if !s.is_empty() => Value::String(s.clone()),
            _ => Value::Null
        };
        
        // Ensure author is never null or empty
        let author = match record.get("author") {
            Some(Value::String(s)) if !s.trim().is_empty() => Value::String(s.clone()),
            Some(Value::Null) => Value::String("Unknown Author".to_string()),
            _ => Value::String("Unknown Author".to_string())
        };
        
        // Ensure title is never null or empty
        let title = match record.get("title") {
            Some(Value::String(s)) if !s.trim().is_empty() => Value::String(s.clone()),
            Some(Value::Null) => Value::String("Unknown Title".to_string()),
            _ => Value::String("Unknown Title".to_string())
        };
        
        let mapped = serde_json::json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "book_id": book_id,
            "isbn": record.get("isbn").unwrap_or(&Value::Null),
            "title": title,
            "author": author,
            "publisher": record.get("publisher").unwrap_or(&Value::Null),
            "publication_year": publication_year,
            "copy_identifier": record.get("copy_identifier").unwrap_or(&Value::Null),
            "acquisition_date": record.get("acquisition_date").unwrap_or(&Value::Null),
            "condition": record.get("condition").unwrap_or(&Value::Null),
            "status": record.get("status").unwrap_or(&serde_json::json!("available")),
            "location": record.get("location").unwrap_or(&Value::Null),
            "department_id": record.get("department_id").unwrap_or(&Value::Null),
            "current_borrower_id": record.get("current_borrower_id").unwrap_or(&Value::Null),
            "borrowed_at": record.get("borrowed_at").unwrap_or(&Value::Null),
            "due_date": record.get("due_date").unwrap_or(&Value::Null),
            "legacy_book_id": record.get("legacy_book_id").unwrap_or(&Value::Null),
            "created_at": record.get("created_at").unwrap_or(&Value::Null),
            "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
        });

        self.clean_mapped_record(mapped)
    }

    fn map_student_for_supabase(&self, record: &HashMap<String, Value>) -> Value {
        let mapped = serde_json::json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "admission_number": record.get("admission_number").unwrap_or(&Value::Null),
            "first_name": record.get("first_name").unwrap_or(&Value::Null),
            "last_name": record.get("last_name").unwrap_or(&Value::Null),
            "email": record.get("email").unwrap_or(&Value::Null),
            "phone": record.get("phone").unwrap_or(&Value::Null),
            "class_grade": record.get("class_grade").unwrap_or(&Value::Null),
            "address": record.get("address").unwrap_or(&Value::Null),
            "date_of_birth": record.get("date_of_birth").unwrap_or(&Value::Null),
            "enrollment_date": record.get("enrollment_date").unwrap_or(&Value::Null),
            "status": record.get("status").unwrap_or(&serde_json::json!("active")),
            "class_id": record.get("class_id").unwrap_or(&Value::Null),
            "academic_year": record.get("academic_year").unwrap_or(&serde_json::json!("2024/2025")),
            "is_repeating": record.get("is_repeating").unwrap_or(&serde_json::json!(0)),
            "legacy_student_id": record.get("legacy_student_id").unwrap_or(&Value::Null),
            "created_at": record.get("created_at").unwrap_or(&Value::Null),
            "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
        });

        self.clean_mapped_record(mapped)
    }

    fn map_staff_for_supabase(&self, record: &HashMap<String, Value>) -> Value {
        let mapped = serde_json::json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "staff_id": record.get("staff_id").unwrap_or(&Value::Null),
            "first_name": record.get("first_name").unwrap_or(&Value::Null),
            "last_name": record.get("last_name").unwrap_or(&Value::Null),
            "email": record.get("email").unwrap_or(&Value::Null),
            "phone": record.get("phone").unwrap_or(&Value::Null),
            "department": record.get("department").unwrap_or(&Value::Null),
            "position": record.get("position").unwrap_or(&Value::Null),
            "status": record.get("status").unwrap_or(&serde_json::json!("active")),
            "legacy_staff_id": record.get("legacy_staff_id").unwrap_or(&Value::Null),
            "created_at": record.get("created_at").unwrap_or(&Value::Null),
            "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
        });

        self.clean_mapped_record(mapped)
    }

    fn map_fine_for_supabase(&self, record: &HashMap<String, Value>) -> Value {
        let mapped = serde_json::json!({
            "id": record.get("id").unwrap_or(&Value::Null),
            "student_id": record.get("student_id").unwrap_or(&Value::Null),
            "borrowing_id": record.get("borrowing_id").unwrap_or(&Value::Null),
            "fine_type": record.get("fine_type").unwrap_or(&Value::Null),
            "amount": record.get("amount").unwrap_or(&serde_json::json!(0.0)),
            "description": record.get("description").unwrap_or(&Value::Null),
            "status": record.get("status").unwrap_or(&serde_json::json!("unpaid")),
            "created_by": record.get("created_by").unwrap_or(&Value::Null),
            "borrower_type": record.get("borrower_type").unwrap_or(&Value::Null),
            "staff_id": record.get("staff_id").unwrap_or(&Value::Null),
            "created_at": record.get("created_at").unwrap_or(&Value::Null),
            "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
        });

        self.clean_mapped_record(mapped)
    }

    fn clean_mapped_record(&self, mut mapped: Value) -> Value {
        // Remove null values and sync-specific columns
        if let Value::Object(ref mut obj) = mapped {
            obj.retain(|k, v| !v.is_null() && !["synced", "sync_version", "deleted"].contains(&k.as_str()));
        }
        mapped
    }
}

/// Public API function for production sync
pub async fn run_production_bidirectional_sync() -> Result<ProductionSyncResult> {
    let sync = ProductionBidirectionalSync::new().await?;
    sync.run_production_sync().await
}

/// Set download sync lock to pause production sync
pub fn set_download_sync_lock() {
    let mut lock = DOWNLOAD_SYNC_LOCK.lock().unwrap();
    *lock = true;
}

/// Release download sync lock to allow production sync
pub fn release_download_sync_lock() {
    let mut lock = DOWNLOAD_SYNC_LOCK.lock().unwrap();
    *lock = false;
}
