use anyhow::{anyhow, Result};
use reqwest::Client;
use rusqlite::params;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::{interval, Instant};
use crate::database::DatabaseManager;

pub struct SyncService {
    client: Client,
    supabase_url: String,
    supabase_key: String,
    db: Arc<DatabaseManager>,
    last_sync: Arc<RwLock<Option<Instant>>>,
}

impl SyncService {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            supabase_url: "https://ddlzenlqkofefdwdefzm.supabase.co".to_string(),
            supabase_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU".to_string(),
            db,
            last_sync: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn start_background_sync(&self) -> Result<()> {
        let mut interval = interval(Duration::from_secs(30)); // Sync every 30 seconds
        
        loop {
            interval.tick().await;
            
            // Check if we should sync (don't sync too frequently)
            {
                let last_sync = self.last_sync.read().await;
                if let Some(last) = *last_sync {
                    if last.elapsed() < Duration::from_secs(15) {
                        continue;
                    }
                }
            }

            if let Err(e) = self.sync_all_tables().await {
                log::error!("Sync failed: {}", e);
                // Continue trying even if sync fails
            } else {
                let mut last_sync = self.last_sync.write().await;
                *last_sync = Some(Instant::now());
                log::info!("Sync completed successfully");
            }
        }
    }

    async fn sync_all_tables(&self) -> Result<()> {
        // Sync in order: categories -> books -> students -> borrowings
        self.sync_table("categories", "categories").await?;
        self.sync_table("books", "books").await?;
        self.sync_table("students", "students").await?;
        self.sync_table("borrowings", "borrowings").await?;
        self.sync_table("book_copies", "book_copies").await?;
        
        Ok(())
    }

    async fn sync_table(&self, local_table: &str, remote_table: &str) -> Result<()> {
        // Pull new data from Supabase
        self.pull_from_supabase(local_table, remote_table).await?;
        
        // Push local changes to Supabase
        self.push_to_supabase(local_table, remote_table).await?;
        
        Ok(())
    }

    async fn pull_from_supabase(&self, local_table: &str, remote_table: &str) -> Result<()> {
        let url = format!("{}/rest/v1/{}", self.supabase_url, remote_table);
        
        let response = self.client
            .get(&url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .query(&[("select", "*"), ("limit", "1000")])
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch from Supabase: {}", response.status()));
        }

        let records: Vec<Value> = response.json().await?;
        
        // Insert or update records in local database
        for record in records {
            self.upsert_local_record(local_table, &record).await?;
        }

        Ok(())
    }

    async fn push_to_supabase(&self, local_table: &str, remote_table: &str) -> Result<()> {
        let unsynced = self.db.get_unsynced_records(local_table, 100).await?;
        
        for (sync_id, record_id, operation, data) in unsynced {
            match operation.as_str() {
                "INSERT" | "UPDATE" => {
                    let record: Value = serde_json::from_str(&data)?;
                    if let Err(e) = self.upsert_remote_record(remote_table, &record).await {
                        log::error!("Failed to sync record {}: {}", record_id, e);
                        continue;
                    }
                }
                "DELETE" => {
                    if let Err(e) = self.delete_remote_record(remote_table, &record_id).await {
                        log::error!("Failed to delete record {}: {}", record_id, e);
                        continue;
                    }
                }
                _ => {
                    log::warn!("Unknown operation: {}", operation);
                    continue;
                }
            }
            
            // Mark as synced
            self.db.mark_synced(&sync_id).await?;
        }

        Ok(())
    }

    async fn upsert_remote_record(&self, table: &str, record: &Value) -> Result<()> {
        let url = format!("{}/rest/v1/{}", self.supabase_url, table);
        
        let response = self.client
            .post(&url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(record)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow!("Failed to upsert to Supabase: {}", error_text));
        }

        Ok(())
    }

    async fn delete_remote_record(&self, table: &str, record_id: &str) -> Result<()> {
        let url = format!("{}/rest/v1/{}?id=eq.{}", self.supabase_url, table, record_id);
        
        let response = self.client
            .delete(&url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to delete from Supabase: {}", response.status()));
        }

        Ok(())
    }

    async fn upsert_local_record(&self, table: &str, record: &Value) -> Result<()> {
        // This is a simplified upsert - in a real implementation, you'd have specific
        // handling for each table type
        log::info!("Upserting record to table: {}", table);
        
        match table {
            "books" => {
                let id = record["id"].as_str().ok_or_else(|| anyhow!("Missing id"))?;
                let title = record["title"].as_str().ok_or_else(|| anyhow!("Missing title"))?;
                let author = record["author"].as_str().ok_or_else(|| anyhow!("Missing author"))?;
                
                // Use direct connection for this operation
                let conn = self.db.get_connection()?;
                conn.execute(
                    "INSERT OR REPLACE INTO books (id, title, author, synced) VALUES (?, ?, ?, 1)",
                    params![id, title, author]
                )?;
            }
            _ => {
                log::warn!("Unsupported table for upsert: {}", table);
            }
        }

        Ok(())
    }

    pub async fn force_sync(&self) -> Result<()> {
        self.sync_all_tables().await?;
        let mut last_sync = self.last_sync.write().await;
        *last_sync = Some(Instant::now());
        Ok(())
    }

    pub async fn get_sync_status(&self) -> Value {
        let last_sync = self.last_sync.read().await;
        let last_sync_time = match *last_sync {
            Some(instant) => Some(instant.elapsed().as_secs()),
            None => None,
        };

        json!({
            "last_sync_seconds_ago": last_sync_time,
            "is_online": self.check_connectivity().await
        })
    }

    async fn check_connectivity(&self) -> bool {
        let url = format!("{}/rest/v1/categories", self.supabase_url);
        
        match self.client
            .get(&url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .query(&[("select", "id"), ("limit", "1")])
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }
}
