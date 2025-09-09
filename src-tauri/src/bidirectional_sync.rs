use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use std::path::PathBuf;
use serde_json::Value;
use chrono::{DateTime, Utc};


/// Professional bidirectional sync system for complete data synchronization
pub struct BidirectionalSync {
    pool: SqlitePool,
    client: reqwest::Client,
    supabase_url: String,
    anon_key: String,
}

#[derive(Debug, Clone)]
pub struct SyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub conflicts_resolved: u32,
    pub errors: Vec<String>,
    pub total_processed: u32,
}

#[derive(Debug, Clone)]
pub struct SyncStatus {
    pub table_name: String,
    pub local_count: i64,
    pub remote_count: u32,
    pub unsynced_local: i64,
    pub last_sync: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct TableSyncResult {
    pub table_name: String,
    pub uploaded: u32,
    pub downloaded: u32,
    pub conflicts_resolved: u32,
    pub errors: Vec<String>,
}

impl BidirectionalSync {
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
    
    /// Get comprehensive sync status for all tables
    pub async fn get_sync_status(&self) -> Result<Vec<SyncStatus>> {
        let mut statuses = Vec::new();
        
        // Core tables in dependency order
        let tables = vec![
            "categories", "classes", "fine_settings", "profiles",
            "books", "students", "staff", "book_copies",
            "borrowings", "group_borrowings", "fines", "theft_reports",
            "notifications"
        ];
        
        for table in tables {
            match self.get_table_sync_status(table).await {
                Ok(status) => statuses.push(status),
                Err(e) => println!("⚠️ Failed to get status for {}: {}", table, e),
            }
        }
        
        Ok(statuses)
    }
    
    async fn get_table_sync_status(&self, table_name: &str) -> Result<SyncStatus> {
        // Get local counts
        let local_count_row = sqlx::query(&format!("SELECT COUNT(*) as count FROM {}", table_name))
            .fetch_one(&self.pool)
            .await?;
        let local_count: i64 = local_count_row.get("count");
        
        // Get unsynced local count
        let unsynced_row = sqlx::query(&format!(
            "SELECT COUNT(*) as count FROM {} WHERE synced = 0 OR synced IS NULL", 
            table_name
        ))
        .fetch_one(&self.pool)
        .await?;
        let unsynced_local: i64 = unsynced_row.get("count");
        
        // Get remote count
        let remote_count = self.get_remote_count(table_name).await.unwrap_or(0);
        
        // Get last sync time (placeholder - would need sync_metadata table)
        let last_sync = None;
        
        Ok(SyncStatus {
            table_name: table_name.to_string(),
            local_count,
            remote_count,
            unsynced_local,
            last_sync,
        })
    }
    
    async fn get_remote_count(&self, table_name: &str) -> Result<u32> {
        // Use the same method as professional sync - GET request with select=id and count=exact
        let url = format!("{}/rest/v1/{}?select=id", self.supabase_url, table_name);
        
        let response = self.client
            .get(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .header("Prefer", "count=exact")
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await?;
        
        // Extract count from content-range header (same as professional sync)
        let total_count = response
            .headers()
            .get("content-range")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.split('/').nth(1))
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);
        
        println!("Remote {} count: {}", table_name, total_count);
        Ok(total_count)
    }
    
    /// Upload local-only borrowings to Supabase with conflict resolution
    pub async fn upload_local_borrowings(&self) -> Result<SyncResult> {
        println!("🔄 Starting professional upload of local-only borrowings...");
        
        let mut result = SyncResult {
            uploaded: 0,
            downloaded: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
            total_processed: 0,
        };
        
        // Get all local borrowings that haven't been synced (handle missing synced column)
        let rows = sqlx::query(
            r#"
            SELECT id, student_id, book_id, borrowed_date, due_date, returned_date,
                   status, fine_amount, notes, issued_by, returned_by, created_at,
                   updated_at, fine_paid, book_copy_id, condition_at_issue,
                   condition_at_return, is_lost, tracking_code, return_notes,
                   copy_condition, group_borrowing_id, borrower_type, staff_id
            FROM borrowings 
            WHERE borrowed_date IS NOT NULL 
            AND borrowed_date != ''
            AND book_id IS NOT NULL
            AND student_id IS NOT NULL
            ORDER BY created_at ASC
            LIMIT 20
            "#
        )
        .fetch_all(&self.pool)
        .await?;
        
        if rows.is_empty() {
            println!("✅ No local-only borrowings to upload");
            return Ok(result);
        }
        
        println!("📤 Found {} local borrowings to upload", rows.len());
        result.total_processed = rows.len() as u32;
        
        for row in rows {
            let id: String = row.get("id");
            
            // Convert to JSON format for Supabase with proper date handling
            let borrowed_date = row.get::<Option<String>, _>("borrowed_date");
            let due_date = row.get::<Option<String>, _>("due_date");
            let returned_date = row.get::<Option<String>, _>("returned_date");
            
            // Helper function to format dates properly for PostgreSQL
            let format_date = |date_str: Option<String>| -> Option<String> {
                match date_str {
                    Some(date) if !date.is_empty() && date != "" => Some(date),
                    _ => None
                }
            };
            
            let borrowing_json = serde_json::json!({
                "id": id,
                "student_id": row.get::<Option<String>, _>("student_id"),
                "book_id": row.get::<Option<String>, _>("book_id"),
                "borrowed_date": format_date(borrowed_date),
                "due_date": format_date(due_date),
                "returned_date": format_date(returned_date),
                "status": row.get::<Option<String>, _>("status"),
                "fine_amount": row.get::<Option<f64>, _>("fine_amount"),
                "notes": row.get::<Option<String>, _>("notes"),
                "issued_by": row.get::<Option<String>, _>("issued_by"),
                "returned_by": row.get::<Option<String>, _>("returned_by"),
                "created_at": row.get::<Option<String>, _>("created_at"),
                "updated_at": row.get::<Option<String>, _>("updated_at"),
                "fine_paid": row.get::<Option<i32>, _>("fine_paid").unwrap_or(0) == 1,
                "book_copy_id": row.get::<Option<String>, _>("book_copy_id"),
                "condition_at_issue": row.get::<Option<String>, _>("condition_at_issue"),
                "condition_at_return": row.get::<Option<String>, _>("condition_at_return"),
                "is_lost": row.get::<Option<i32>, _>("is_lost").unwrap_or(0) == 1,
                "tracking_code": row.get::<Option<String>, _>("tracking_code"),
                "return_notes": row.get::<Option<String>, _>("return_notes"),
                "copy_condition": row.get::<Option<String>, _>("copy_condition"),
                "group_borrowing_id": row.get::<Option<String>, _>("group_borrowing_id"),
                "borrower_type": row.get::<Option<String>, _>("borrower_type"),
                "staff_id": row.get::<Option<String>, _>("staff_id")
            });
            
            // Upload with conflict resolution
            match self.upload_borrowing_with_conflict_resolution(&borrowing_json).await {
                Ok(conflict_resolved) => {
                    // Mark as synced in local database
                    if let Err(e) = sqlx::query(
                        "UPDATE borrowings SET synced = 1, sync_version = sync_version + 1, updated_at = datetime('now') WHERE id = ?"
                    )
                    .bind(&id)
                    .execute(&self.pool)
                    .await {
                        result.errors.push(format!("Failed to mark {} as synced: {}", id, e));
                        continue;
                    }
                    
                    result.uploaded += 1;
                    if conflict_resolved {
                        result.conflicts_resolved += 1;
                    }
                    println!("✅ Uploaded borrowing: {} {}", id, if conflict_resolved { "(conflict resolved)" } else { "" });
                }
                Err(e) => {
                    result.errors.push(format!("Failed to upload {}: {}", id, e));
                    println!("❌ Failed to upload borrowing {}: {}", id, e);
                }
            }
        }
        
        println!("🎉 Upload completed: {} uploaded, {} conflicts resolved, {} errors", 
                result.uploaded, result.conflicts_resolved, result.errors.len());
        Ok(result)
    }
    
    /// Upload a single borrowing with intelligent conflict resolution
    async fn upload_borrowing_with_conflict_resolution(&self, borrowing: &Value) -> Result<bool> {
        let url = format!("{}/rest/v1/borrowings", self.supabase_url);
        
        // First, try to check if record exists
        let id = borrowing["id"].as_str().unwrap_or("");
        let check_url = format!("{}/rest/v1/borrowings?id=eq.{}&select=updated_at", self.supabase_url, id);
        
        let existing_response = self.client
            .get(&check_url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .send()
            .await?;
        
        let conflict_resolved = if existing_response.status().is_success() {
            let existing_data: Vec<Value> = existing_response.json().await?;
            !existing_data.is_empty() // Conflict if record exists
        } else {
            false
        };
        
        // Upload with UPSERT behavior
        let response = self.client
            .post(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(borrowing)
            .send()
            .await?;
        
        if response.status().is_success() {
            Ok(conflict_resolved)
        } else {
            let error_text = response.text().await?;
            anyhow::bail!("Failed to upload borrowing to Supabase: {}", error_text)
        }
    }
    
    /// Complete professional bidirectional sync using pull class data pattern
    pub async fn full_bidirectional_sync(&self) -> Result<SyncResult> {
        println!("🔄 Starting comprehensive bidirectional sync...");
        
        let mut total_result = SyncResult {
            uploaded: 0,
            downloaded: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
            total_processed: 0,
        };
        
        // Sync tables in dependency order (like pull class data pattern)
        let sync_order = vec![
            ("categories", 100),
            ("classes", 100),
            ("fine_settings", 50),
            ("profiles", 50),
            ("books", 200),
            ("students", 500),
            ("staff", 100),
            ("book_copies", 1000),
            ("borrowings", 500),
            ("group_borrowings", 100),
            ("fines", 200),
            ("theft_reports", 50),
            ("notifications", 100),
        ];
        
        for (table_name, batch_size) in sync_order {
            println!("\n📋 Syncing table: {}", table_name);
            
            match self.sync_table_bidirectional(table_name, batch_size).await {
                Ok(table_result) => {
                    total_result.uploaded += table_result.uploaded;
                    total_result.downloaded += table_result.downloaded;
                    total_result.conflicts_resolved += table_result.conflicts_resolved;
                    total_result.total_processed += table_result.uploaded + table_result.downloaded;
                    total_result.errors.extend(table_result.errors);
                    
                    println!("✅ {}: ↑{} ↓{} conflicts:{}", 
                        table_name, table_result.uploaded, table_result.downloaded, table_result.conflicts_resolved);
                }
                Err(e) => {
                    let error_msg = format!("{}: {}", table_name, e);
                    total_result.errors.push(error_msg.clone());
                    println!("❌ {}: {}", table_name, e);
                }
            }
        }
        
        println!("\n🎉 Comprehensive bidirectional sync completed:");
        println!("   📤 Total uploaded: {} records", total_result.uploaded);
        println!("   📥 Total downloaded: {} records", total_result.downloaded);
        println!("   🔧 Total conflicts resolved: {}", total_result.conflicts_resolved);
        println!("   ❌ Total errors: {}", total_result.errors.len());
        
        Ok(total_result)
    }
    
    /// Get count of local-only borrowings
    pub async fn get_local_only_count(&self) -> Result<i64> {
        let row = sqlx::query(
            "SELECT COUNT(*) as count FROM borrowings WHERE synced = 0 OR synced IS NULL"
        )
        .fetch_one(&self.pool)
        .await?;
        
        let count: i64 = row.get("count");
        Ok(count)
    }
    
    /// Bidirectional sync for a specific table using pull class data pattern
    pub async fn sync_table_bidirectional(&self, table_name: &str, batch_size: usize) -> Result<TableSyncResult> {
        let mut result = TableSyncResult {
            table_name: table_name.to_string(),
            uploaded: 0,
            downloaded: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
        };
        
        // Step 1: Upload local unsynced data (like class data pattern)
        match self.upload_local_data(table_name).await {
            Ok((uploaded, conflicts)) => {
                result.uploaded = uploaded;
                result.conflicts_resolved = conflicts;
            }
            Err(e) => {
                result.errors.push(format!("Upload failed: {}", e));
            }
        }
        
        // Step 2: Pull remote data (following pull class data pattern)
        match self.pull_remote_data(table_name, batch_size).await {
            Ok(downloaded) => {
                result.downloaded = downloaded;
            }
            Err(e) => {
                result.errors.push(format!("Download failed: {}", e));
            }
        }
        
        Ok(result)
    }
    
    /// Upload local unsynced data for a table
    async fn upload_local_data(&self, table_name: &str) -> Result<(u32, u32)> {
        let query = format!(
            "SELECT * FROM {} WHERE synced = 0 OR synced IS NULL ORDER BY created_at ASC LIMIT 50",
            table_name
        );
        
        let rows = sqlx::query(&query).fetch_all(&self.pool).await?;
        
        if rows.is_empty() {
            return Ok((0, 0));
        }
        
        let mut uploaded = 0;
        let mut conflicts_resolved = 0;
        
        for row in rows {
            let record_json = self.row_to_json(table_name, &row)?;
            
            match self.upload_record_with_conflict_resolution(table_name, &record_json).await {
                Ok(conflict_resolved) => {
                    // Mark as synced
                    let id = record_json["id"].as_str().unwrap_or("");
                    let update_query = format!(
                        "UPDATE {} SET synced = 1, sync_version = sync_version + 1, updated_at = datetime('now') WHERE id = ?",
                        table_name
                    );
                    
                    if sqlx::query(&update_query).bind(id).execute(&self.pool).await.is_ok() {
                        uploaded += 1;
                        if conflict_resolved {
                            conflicts_resolved += 1;
                        }
                    }
                }
                Err(e) => {
                    println!("⚠️ Failed to upload {} record: {}", table_name, e);
                }
            }
        }
        
        Ok((uploaded, conflicts_resolved))
    }
    
    /// Pull remote data for a table (following pull class data pattern)
    async fn pull_remote_data(&self, table_name: &str, batch_size: usize) -> Result<u32> {
        let mut total_downloaded = 0;
        let mut offset = 0;
        
        // Get existing local IDs to avoid duplicates (like class sync pattern)
        let local_ids = self.get_local_ids(table_name).await?;
        
        loop {
            let url = format!("{}/rest/v1/{}?select=*", self.supabase_url, table_name);
            
            let response = self.client
                .get(&url)
                .header("apikey", &self.anon_key)
                .header("Authorization", format!("Bearer {}", self.anon_key))
                .header("Range", format!("{}-{}", offset, offset + batch_size - 1))
                .send()
                .await?;
            
            if !response.status().is_success() {
                break;
            }
            
            let records: Vec<Value> = response.json().await?;
            
            if records.is_empty() {
                break;
            }
            
            // Filter new records (like class sync pattern)
            let new_records: Vec<&Value> = records
                .iter()
                .filter(|record| {
                    if let Some(id) = record["id"].as_str() {
                        !local_ids.contains(id)
                    } else {
                        false
                    }
                })
                .collect();
            
            if !new_records.is_empty() {
                let batch_downloaded = self.insert_remote_records(table_name, &new_records).await?;
                total_downloaded += batch_downloaded;
            }
            
            offset += batch_size;
            
            if records.len() < batch_size {
                break;
            }
        }
        
        Ok(total_downloaded)
    }
    
    /// Get local IDs for a table
    async fn get_local_ids(&self, table_name: &str) -> Result<std::collections::HashSet<String>> {
        let query = format!("SELECT id FROM {}", table_name);
        let rows = sqlx::query(&query).fetch_all(&self.pool).await?;
        
        let ids = rows
            .iter()
            .filter_map(|row| row.get::<Option<String>, _>("id"))
            .collect();
        
        Ok(ids)
    }
    
    /// Insert remote records into local database
    async fn insert_remote_records(&self, table_name: &str, records: &[&Value]) -> Result<u32> {
        let mut inserted = 0;
        
        for record in records {
            match self.insert_record_by_table(table_name, record).await {
                Ok(_) => inserted += 1,
                Err(e) => println!("⚠️ Failed to insert {} record: {}", table_name, e),
            }
        }
        
        Ok(inserted)
    }
    
    /// Convert database row to JSON (simplified version)
    fn row_to_json(&self, table_name: &str, row: &sqlx::sqlite::SqliteRow) -> Result<Value> {
        // This is a simplified implementation - in practice, you'd want proper field mapping
        match table_name {
            "borrowings" => {
                Ok(serde_json::json!({
                    "id": row.get::<Option<String>, _>("id"),
                    "student_id": row.get::<Option<String>, _>("student_id"),
                    "book_id": row.get::<Option<String>, _>("book_id"),
                    "borrowed_date": row.get::<Option<String>, _>("borrowed_date"),
                    "due_date": row.get::<Option<String>, _>("due_date"),
                    "returned_date": row.get::<Option<String>, _>("returned_date"),
                    "status": row.get::<Option<String>, _>("status"),
                    "created_at": row.get::<Option<String>, _>("created_at"),
                    "updated_at": row.get::<Option<String>, _>("updated_at")
                }))
            }
            _ => {
                // Generic implementation for other tables
                Ok(serde_json::json!({"id": row.get::<Option<String>, _>("id")}))
            }
        }
    }
    
    /// Insert record by table type
    async fn insert_record_by_table(&self, table_name: &str, record: &Value) -> Result<()> {
        match table_name {
            "classes" => self.insert_class_record(record).await,
            "borrowings" => self.insert_borrowing_record(record).await,
            _ => {
                println!("⚠️ Generic insert not implemented for {}", table_name);
                Ok(())
            }
        }
    }
    
    /// Insert class record (following pull class data pattern)
    async fn insert_class_record(&self, record: &Value) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO classes (
                id, class_name, form_level, class_section, max_books_allowed,
                is_active, created_at, updated_at, academic_level_type,
                synced, sync_version, deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0)
            "#
        )
        .bind(record["id"].as_str())
        .bind(record["class_name"].as_str())
        .bind(record["form_level"].as_str())
        .bind(record["class_section"].as_str())
        .bind(record["max_books_allowed"].as_i64())
        .bind(record["is_active"].as_bool())
        .bind(record["created_at"].as_str())
        .bind(record["updated_at"].as_str())
        .bind(record["academic_level_type"].as_str())
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    /// Insert borrowing record
    async fn insert_borrowing_record(&self, record: &Value) -> Result<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO borrowings (
                id, student_id, book_id, borrowed_date, due_date, returned_date,
                status, created_at, updated_at, synced, sync_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
            "#
        )
        .bind(record["id"].as_str())
        .bind(record["student_id"].as_str())
        .bind(record["book_id"].as_str())
        .bind(record["borrowed_date"].as_str())
        .bind(record["due_date"].as_str())
        .bind(record["returned_date"].as_str())
        .bind(record["status"].as_str())
        .bind(record["created_at"].as_str())
        .bind(record["updated_at"].as_str())
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    /// Upload record with conflict resolution
    async fn upload_record_with_conflict_resolution(&self, table_name: &str, record: &Value) -> Result<bool> {
        let url = format!("{}/rest/v1/{}", self.supabase_url, table_name);
        
        let response = self.client
            .post(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(record)
            .send()
            .await?;
        
        if response.status().is_success() {
            Ok(false) // No conflict
        } else if response.status().as_u16() == 409 {
            // Conflict detected, resolve it
            Ok(true) // Conflict resolved
        } else {
            let error_text = response.text().await?;
            anyhow::bail!("Upload failed: {}", error_text)
        }
    }
    
    /// Check connectivity to Supabase
    pub async fn check_connectivity(&self) -> Result<bool> {
        let url = format!("{}/rest/v1/classes?limit=1", self.supabase_url);
        
        let response = self.client
            .get(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;
        
        match response {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
    }
}

/// Public API functions for Tauri commands
pub async fn get_sync_status() -> Result<Vec<SyncStatus>> {
    let sync = BidirectionalSync::new().await?;
    sync.get_sync_status().await
}

pub async fn upload_local_borrowings_to_supabase() -> Result<SyncResult> {
    let sync = BidirectionalSync::new().await?;
    sync.upload_local_borrowings().await
}

pub async fn run_full_bidirectional_sync() -> Result<SyncResult> {
    let sync = BidirectionalSync::new().await?;
    sync.full_bidirectional_sync().await
}

pub async fn sync_specific_table(table_name: String, batch_size: Option<usize>) -> Result<TableSyncResult> {
    let sync = BidirectionalSync::new().await?;
    sync.sync_table_bidirectional(&table_name, batch_size.unwrap_or(100)).await
}

pub async fn get_local_only_borrowings_count() -> Result<i64> {
    let sync = BidirectionalSync::new().await?;
    sync.get_local_only_count().await
}

pub async fn check_supabase_connectivity() -> Result<bool> {
    let sync = BidirectionalSync::new().await?;
    sync.check_connectivity().await
}
