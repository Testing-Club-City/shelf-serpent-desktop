use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use std::path::PathBuf;
use serde_json::Value;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// Complete bidirectional sync system that handles schema mapping between local SQLite and Supabase PostgreSQL
pub struct CompleteBidirectionalSync {
    pool: SqlitePool,
    client: reqwest::Client,
    supabase_url: String,
    anon_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub conflicts_resolved: u32,
    pub errors: Vec<String>,
    pub total_processed: u32,
}

impl CompleteBidirectionalSync {
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

    /// Sync categories bidirectionally
    pub async fn sync_categories_bidirectional(&self) -> Result<SyncResult> {
        println!("🔄 Starting bidirectional categories sync...");
        
        let mut result = SyncResult {
            uploaded: 0,
            downloaded: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
            total_processed: 0,
        };

        // Step 1: Upload local changes to Supabase
        match self.upload_local_categories().await {
            Ok(uploaded) => {
                result.uploaded = uploaded;
                println!("📤 Uploaded {} categories to Supabase", uploaded);
            },
            Err(e) => {
                let error_msg = format!("Failed to upload categories: {}", e);
                result.errors.push(error_msg.clone());
                println!("❌ {}", error_msg);
            }
        }

        // Step 2: Download remote changes from Supabase
        match self.download_remote_categories().await {
            Ok(downloaded) => {
                result.downloaded = downloaded;
                println!("📥 Downloaded {} categories from Supabase", downloaded);
            },
            Err(e) => {
                let error_msg = format!("Failed to download categories: {}", e);
                result.errors.push(error_msg.clone());
                println!("❌ {}", error_msg);
            }
        }

        result.total_processed = result.uploaded + result.downloaded;
        println!("🎉 Categories bidirectional sync completed: {} total processed", result.total_processed);
        
        Ok(result)
    }

    /// Upload local categories that haven't been synced
    async fn upload_local_categories(&self) -> Result<u32> {
        println!("📤 Uploading local categories to Supabase...");
        
        // Get unsynced local categories
        let rows = sqlx::query(
            "SELECT id, name, description, created_at, updated_at FROM categories WHERE synced = 0 OR synced IS NULL"
        )
        .fetch_all(&self.pool)
        .await?;

        if rows.is_empty() {
            println!("✅ No local categories to upload");
            return Ok(0);
        }

        println!("📋 Found {} local categories to upload", rows.len());
        let mut uploaded = 0;

        for row in rows {
            let id: String = row.get("id");
            let name: String = row.get("name");
            let description: Option<String> = row.get("description");
            let _created_at: Option<String> = row.get("created_at");
            let _updated_at: Option<String> = row.get("updated_at");

            // Create JSON for Supabase
            let category_json = serde_json::json!({
                "id": id,
                "name": name,
                "description": description,
                "created_at": _created_at,
                "updated_at": _updated_at
            });

            // Upload to Supabase
            let url = format!("{}/rest/v1/categories", self.supabase_url);
            
            let response = self.client
                .post(&url)
                .header("apikey", &self.anon_key)
                .header("Authorization", format!("Bearer {}", self.anon_key))
                .header("Content-Type", "application/json")
                .header("Prefer", "resolution=merge-duplicates")
                .json(&category_json)
                .send()
                .await?;

            if response.status().is_success() {
                // Mark as synced locally
                sqlx::query("UPDATE categories SET synced = 1, updated_at = datetime('now') WHERE id = ?")
                    .bind(&id)
                    .execute(&self.pool)
                    .await?;
                
                uploaded += 1;
                println!("✅ Uploaded category: {}", name);
            } else {
                let error_text = response.text().await?;
                println!("❌ Failed to upload category '{}': {}", name, error_text);
            }
        }

        Ok(uploaded)
    }

    /// Download remote categories from Supabase
    async fn download_remote_categories(&self) -> Result<u32> {
        println!("📥 Downloading categories from Supabase...");
        
        // Get categories from Supabase
        let url = format!("{}/rest/v1/categories?select=*", self.supabase_url);
        
        let response = self.client
            .get(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to fetch categories from Supabase: {}", response.status()));
        }

        let json: Value = response.json().await?;
        let empty_vec = vec![];
        let categories = json.as_array().unwrap_or(&empty_vec);

        if categories.is_empty() {
            println!("✅ No remote categories to download");
            return Ok(0);
        }

        println!("📋 Found {} remote categories", categories.len());
        let mut downloaded = 0;

        // Start transaction
        let mut tx = self.pool.begin().await?;

        for category in categories {
            let id = category["id"].as_str().unwrap_or_default();
            let name = category["name"].as_str().unwrap_or("Unknown Category");
            let description = category["description"].as_str();
            let created_at = category["created_at"].as_str();
            let updated_at = category["updated_at"].as_str();

            // Use proper UPSERT that handles both ID and name conflicts
            let query = r#"
                INSERT INTO categories (id, name, description, created_at, updated_at, synced)
                VALUES (?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')), 1)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    updated_at = excluded.updated_at,
                    synced = 1
                ON CONFLICT(name) DO UPDATE SET
                    id = excluded.id,
                    description = excluded.description,
                    updated_at = excluded.updated_at,
                    synced = 1
            "#;

            // Try the UPSERT, if it fails, use alternative approach
            match sqlx::query(query)
                .bind(id)
                .bind(name)
                .bind(description)
                .bind(created_at)
                .bind(updated_at)
                .execute(&mut *tx)
                .await
            {
                Ok(_) => {
                    downloaded += 1;
                    println!("✅ Downloaded category: {}", name);
                },
                Err(_) => {
                    // Alternative approach: update first, then insert if needed
                    let updated_rows = sqlx::query(
                        "UPDATE categories SET description = ?, updated_at = COALESCE(?, datetime('now')), synced = 1 WHERE name = ? OR id = ?"
                    )
                    .bind(description)
                    .bind(updated_at)
                    .bind(name)
                    .bind(id)
                    .execute(&mut *tx)
                    .await?
                    .rows_affected();

                    if updated_rows == 0 {
                        // Insert new record
                        match sqlx::query(
                            "INSERT OR IGNORE INTO categories (id, name, description, created_at, updated_at, synced) VALUES (?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')), 1)"
                        )
                        .bind(id)
                        .bind(name)
                        .bind(description)
                        .bind(created_at)
                        .bind(updated_at)
                        .execute(&mut *tx)
                        .await
                        {
                            Ok(result) => {
                                if result.rows_affected() > 0 {
                                    downloaded += 1;
                                    println!("✅ Downloaded category: {}", name);
                                }
                            },
                            Err(e) => {
                                println!("❌ Failed to insert category '{}': {}", name, e);
                            }
                        }
                    } else {
                        downloaded += 1;
                        println!("✅ Updated category: {}", name);
                    }
                }
            }
        }

        // Commit transaction
        tx.commit().await?;
        
        Ok(downloaded)
    }

    /// Sync classes with schema mapping (Local classes <-> Supabase courses/class_sections)
    pub async fn sync_classes_bidirectional(&self) -> Result<SyncResult> {
        println!("🔄 Starting bidirectional classes sync with schema mapping...");
        
        let mut result = SyncResult {
            uploaded: 0,
            downloaded: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
            total_processed: 0,
        };

        // Step 1: Upload local classes to Supabase (map to courses)
        match self.upload_local_classes_as_courses().await {
            Ok(uploaded) => {
                result.uploaded = uploaded;
                println!("📤 Uploaded {} classes as courses to Supabase", uploaded);
            },
            Err(e) => {
                let error_msg = format!("Failed to upload classes: {}", e);
                result.errors.push(error_msg.clone());
                println!("❌ {}", error_msg);
            }
        }

        // Step 2: Download remote courses as local classes
        match self.download_remote_courses_as_classes().await {
            Ok(downloaded) => {
                result.downloaded = downloaded;
                println!("📥 Downloaded {} classes from Supabase", downloaded);
            },
            Err(e) => {
                let error_msg = format!("Failed to download classes: {}", e);
                result.errors.push(error_msg.clone());
                println!("❌ {}", error_msg);
            }
        }

        result.total_processed = result.uploaded + result.downloaded;
        println!("🎉 Classes bidirectional sync completed: {} total processed", result.total_processed);
        
        Ok(result)
    }

    /// Upload local classes as courses to Supabase
    async fn upload_local_classes_as_courses(&self) -> Result<u32> {
        println!("📤 Uploading local classes as courses to Supabase...");
        
        // Get local classes (don't filter by synced column since it might not exist yet)
        let rows = sqlx::query(
            r#"
            SELECT id, class_name, form_level, class_section, max_books_allowed, 
                   is_active, created_at, updated_at 
            FROM classes 
            WHERE class_name IS NOT NULL
            LIMIT 5
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        if rows.is_empty() {
            println!("✅ No local classes to upload");
            return Ok(0);
        }

        println!("📋 Found {} local classes to upload as courses", rows.len());
        let mut uploaded = 0;

        for row in rows {
            let _id: String = row.get("id");
            let class_name: String = row.get("class_name");
            let form_level: i32 = row.get("form_level");
            let class_section: Option<String> = row.get("class_section");
            let is_active: i32 = row.get("is_active");
            let _created_at: Option<String> = row.get("created_at");
            let _updated_at: Option<String> = row.get("updated_at");

            // Map local class to Supabase course structure
            let course_json = serde_json::json!({
                "code": format!("FORM{}{}", form_level, class_section.as_deref().unwrap_or("A")),
                "name": class_name,
                "description": format!("Form {} Class {}", form_level, class_section.as_deref().unwrap_or("A")),
                "credit_hours": 3.0,
                "course_level": "undergraduate",
                "is_offered": is_active == 1,
                "frequency": "every_semester",
                "status": if is_active == 1 { "active" } else { "inactive" }
            });

            // Upload to Supabase classes table (was courses)
            let url = format!("{}/rest/v1/classes", self.supabase_url);
            
            let response = self.client
                .post(&url)
                .header("apikey", &self.anon_key)
                .header("Authorization", format!("Bearer {}", self.anon_key))
                .header("Content-Type", "application/json")
                .header("Prefer", "resolution=merge-duplicates")
                .json(&course_json)
                .send()
                .await;

            match response {
                Ok(resp) => {
                    if resp.status().is_success() {
                        uploaded += 1;
                        println!("✅ Uploaded class as course: {}", class_name);
                    } else {
                        let status = resp.status();
                        let error_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                        println!("❌ Failed to upload class '{}' ({}): {}", class_name, status, error_text);
                    }
                },
                Err(e) => {
                    println!("❌ Failed to upload class '{}': {}", class_name, e);
                }
            }
        }

        Ok(uploaded)
    }

    /// Download remote classes as local classes
    async fn download_remote_courses_as_classes(&self) -> Result<u32> {
        println!("📥 Downloading classes from Supabase...");
        
        // Get classes from Supabase (was courses)
        let url = format!("{}/rest/v1/classes?select=*", self.supabase_url);
        
        let response = self.client
            .get(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to fetch classes from Supabase: {}", response.status()));
        }

        let json: Value = response.json().await?;
        let empty_vec = vec![];
        let classes = json.as_array().unwrap_or(&empty_vec);

        if classes.is_empty() {
            println!("✅ No remote classes to download");
            return Ok(0);
        }

        println!("📋 Found {} remote classes", classes.len());
        let mut downloaded = 0;

        // Start transaction
        let mut tx = self.pool.begin().await?;

        for class in classes {
            let id = class["id"].as_str().unwrap_or_default();
            let name = class["name"].as_str().unwrap_or("Unknown Class");
            let code = class["code"].as_str().unwrap_or("");
            let _description = class["description"].as_str();
            let is_offered = class["is_offered"].as_bool().unwrap_or(true);
            let created_at = class["created_at"].as_str();
            let updated_at = class["updated_at"].as_str();

            // Extract form level from code (e.g., "FORM1-A" -> 1)
            let form_level = if code.starts_with("FORM") {
                code.chars().nth(4).and_then(|c| c.to_digit(10)).unwrap_or(1) as i32
            } else {
                1
            };

            // Extract section from code (e.g., "FORM1-A" -> "A")
            let class_section = if let Some(dash_pos) = code.find('-') {
                Some(code[dash_pos + 1..].to_string())
            } else {
                Some("A".to_string())
            };

            // Map Supabase course to local class structure
            let query = r#"
                INSERT INTO classes (
                    id, class_name, form_level, class_section, max_books_allowed, 
                    is_active, created_at, updated_at, synced
                )
                VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')), 1)
                ON CONFLICT(id) DO UPDATE SET
                    class_name = excluded.class_name,
                    form_level = excluded.form_level,
                    class_section = excluded.class_section,
                    max_books_allowed = excluded.max_books_allowed,
                    is_active = excluded.is_active,
                    updated_at = excluded.updated_at,
                    synced = 1
                ON CONFLICT(class_name) DO UPDATE SET
                    id = excluded.id,
                    form_level = excluded.form_level,
                    class_section = excluded.class_section,
                    max_books_allowed = excluded.max_books_allowed,
                    is_active = excluded.is_active,
                    updated_at = excluded.updated_at,
                    synced = 1
            "#;

            match sqlx::query(query)
                .bind(id)
                .bind(name)
                .bind(form_level)
                .bind(&class_section)
                .bind(2) // Default max_books_allowed
                .bind(if is_offered { 1 } else { 0 })
                .bind(created_at)
                .bind(updated_at)
                .execute(&mut *tx)
                .await
            {
                Ok(_) => {
                    downloaded += 1;
                    println!("✅ Downloaded course as class: {}", name);
                },
                Err(e) => {
                    println!("❌ Failed to insert course '{}' as class: {}", name, e);
                    
                    // Try alternative approach
                    let updated_rows = sqlx::query(
                        "UPDATE classes SET form_level = ?, class_section = ?, is_active = ?, updated_at = COALESCE(?, datetime('now')), synced = 1 WHERE class_name = ? OR id = ?"
                    )
                    .bind(form_level)
                    .bind(&class_section)
                    .bind(if is_offered { 1 } else { 0 })
                    .bind(updated_at)
                    .bind(name)
                    .bind(id)
                    .execute(&mut *tx)
                    .await?
                    .rows_affected();

                    if updated_rows == 0 {
                        // Insert new record with OR IGNORE
                        match sqlx::query(
                            "INSERT OR IGNORE INTO classes (id, class_name, form_level, class_section, max_books_allowed, is_active, created_at, updated_at, synced) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')), 1)"
                        )
                        .bind(id)
                        .bind(name)
                        .bind(form_level)
                        .bind(&class_section)
                        .bind(2)
                        .bind(if is_offered { 1 } else { 0 })
                        .bind(created_at)
                        .bind(updated_at)
                        .execute(&mut *tx)
                        .await
                        {
                            Ok(result) => {
                                if result.rows_affected() > 0 {
                                    downloaded += 1;
                                    println!("✅ Downloaded course as class: {}", name);
                                }
                            },
                            Err(e) => {
                                println!("❌ Failed to insert course '{}': {}", name, e);
                            }
                        }
                    } else {
                        downloaded += 1;
                        println!("✅ Updated class from course: {}", name);
                    }
                }
            }
        }

        // Commit transaction
        tx.commit().await?;
        
        Ok(downloaded)
    }

    /// Run complete bidirectional sync for all supported tables
    pub async fn run_complete_bidirectional_sync(&self) -> Result<HashMap<String, SyncResult>> {
        println!("🚀 Starting complete bidirectional sync...");
        
        let mut results = HashMap::new();
        
        // Sync categories
        println!("\n📁 Syncing Categories...");
        match self.sync_categories_bidirectional().await {
            Ok(result) => {
                results.insert("categories".to_string(), result);
            },
            Err(e) => {
                println!("❌ Categories sync failed: {}", e);
                results.insert("categories".to_string(), SyncResult {
                    uploaded: 0,
                    downloaded: 0,
                    conflicts_resolved: 0,
                    errors: vec![e.to_string()],
                    total_processed: 0,
                });
            }
        }
        
        // Sync classes
        println!("\n🏫 Syncing Classes...");
        match self.sync_classes_bidirectional().await {
            Ok(result) => {
                results.insert("classes".to_string(), result);
            },
            Err(e) => {
                println!("❌ Classes sync failed: {}", e);
                results.insert("classes".to_string(), SyncResult {
                    uploaded: 0,
                    downloaded: 0,
                    conflicts_resolved: 0,
                    errors: vec![e.to_string()],
                    total_processed: 0,
                });
            }
        }
        
        // Calculate totals
        let total_uploaded: u32 = results.values().map(|r| r.uploaded).sum();
        let total_downloaded: u32 = results.values().map(|r| r.downloaded).sum();
        let total_errors: usize = results.values().map(|r| r.errors.len()).sum();
        
        println!("\n🎉 Complete bidirectional sync finished!");
        println!("📤 Total uploaded: {}", total_uploaded);
        println!("📥 Total downloaded: {}", total_downloaded);
        println!("❌ Total errors: {}", total_errors);
        
        Ok(results)
    }
}

/// Public API functions for Tauri commands
pub async fn run_complete_bidirectional_sync() -> Result<HashMap<String, SyncResult>> {
    let sync = CompleteBidirectionalSync::new().await?;
    sync.run_complete_bidirectional_sync().await
}

pub async fn sync_categories_bidirectional() -> Result<SyncResult> {
    let sync = CompleteBidirectionalSync::new().await?;
    sync.sync_categories_bidirectional().await
}

pub async fn sync_classes_bidirectional() -> Result<SyncResult> {
    let sync = CompleteBidirectionalSync::new().await?;
    sync.sync_classes_bidirectional().await
}
