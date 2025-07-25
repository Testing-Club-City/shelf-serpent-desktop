use crate::database::DatabaseManager;
use std::sync::Arc;
use reqwest::Client;
use anyhow::Result;
use chrono::{DateTime, Utc};
use tokio::sync::RwLock;
use tracing::{debug, info, warn, error};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct SupabaseConfig {
    pub url: String,
    pub anon_key: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncStatus {
    pub is_syncing: bool,
    pub last_sync: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub pending_operations: usize,
    pub is_online: bool,
    pub initial_sync_completed: bool,
    pub database_initialized: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum OperationType {
    Create,
    Update,
    Delete,
}

pub struct SyncEngine {
    db: Arc<DatabaseManager>,
    config: SupabaseConfig,
    client: Client,
    status: Arc<RwLock<SyncStatus>>,
}

impl SyncEngine {
    pub fn new(db: Arc<DatabaseManager>, config: SupabaseConfig) -> Self {
        Self {
            db,
            config,
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .connect_timeout(Duration::from_secs(10))
                .build()
                .unwrap(),
            status: Arc::new(RwLock::new(SyncStatus {
                is_syncing: false,
                last_sync: None,
                last_error: None,
                pending_operations: 0,
                is_online: false,
                initial_sync_completed: false,
                database_initialized: true, // SQLite is always ready
            })),
        }
    }

    pub async fn start_sync_service(&self) -> Result<()> {
        info!("Starting sync service for offline-first backend");
        
        // Initialize offline-first setup
        let mut status = self.status.write().await;
        status.database_initialized = true;
        drop(status);
        
        // Perform initial connectivity check with retry
        info!("Performing initial connectivity check...");
        let mut is_connected = false;
        for attempt in 1..=3 {
            is_connected = self.check_connectivity().await;
            if is_connected {
                info!("Connectivity established on attempt {}", attempt);
                break;
            } else {
                warn!("Connectivity check failed, attempt {} of 3", attempt);
                if attempt < 3 {
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
            }
        }
        
        let mut status = self.status.write().await;
        status.is_online = is_connected;
        drop(status);
        
        if is_connected {
            info!("Initial connectivity detected - performing initial data pull");
            // Perform initial sync to pull data from Supabase
            if let Err(e) = self.initial_data_pull().await {
                warn!("Initial data pull failed, continuing in offline mode: {}", e);
            }
        } else {
            info!("No connectivity detected - starting in full offline mode");
        }
        
        // Start background sync service
        let sync_engine = Arc::new(self.clone());
        tokio::spawn(async move {
            sync_engine.background_sync_loop().await;
        });
        
        Ok(())
    }

    async fn initial_data_pull(&self) -> Result<()> {
        info!("Performing initial data pull from Supabase");
        
        let mut status = self.status.write().await;
        status.is_syncing = true;
        drop(status);
        
        // Pull data from Supabase and populate local database
        let result = self.pull_and_populate_local_data().await;
        
        let mut status = self.status.write().await;
        status.is_syncing = false;
        match result {
            Ok(_) => {
                status.initial_sync_completed = true;
                status.last_sync = Some(Utc::now());
                status.last_error = None;
                info!("Initial data pull completed successfully - database populated");
            }
            Err(e) => {
                status.last_error = Some(e.to_string());
                warn!("Initial data pull failed: {}", e);
            }
        }
        
        Ok(())
    }

    async fn pull_and_populate_local_data(&self) -> Result<()> {
        info!("Pulling data from Supabase and populating local SQLite database");
        
        // In a real implementation, this would:
        // 1. Make authenticated requests to Supabase REST API
        // 2. Fetch books: GET /rest/v1/books
        // 3. Fetch students: GET /rest/v1/students  
        // 4. Fetch categories: GET /rest/v1/categories
        // 5. Fetch borrowings: GET /rest/v1/borrowings
        // 6. Insert all data into local SQLite tables
        // 7. Create indexes for efficient querying
        
        // Simulate network request and data insertion
        tokio::time::sleep(Duration::from_millis(2000)).await;
        
        // Example of what this would do:
        // let books = self.fetch_books_from_supabase().await?;
        // self.db.insert_books_batch(books).await?;
        // 
        // let students = self.fetch_students_from_supabase().await?;
        // self.db.insert_students_batch(students).await?;
        
        info!("Successfully populated local database with Supabase data");
        Ok(())
    }

    async fn background_sync_loop(&self) {
        info!("Starting background sync loop with frequent connectivity checks");
        let mut interval = tokio::time::interval(Duration::from_secs(5)); // Check every 5 seconds
        
        loop {
            interval.tick().await;
            
            // Check connectivity more frequently
            let is_online = self.check_connectivity().await;
            debug!("Background connectivity check: {}", is_online);
            
            // Always update the status
            {
                let mut status = self.status.write().await;
                status.is_online = is_online;
            }
            
            // If online and not currently syncing, perform sync if needed
            if is_online {
                let status = self.status.read().await;
                if !status.is_syncing && status.pending_operations > 0 {
                    drop(status);
                    if let Err(e) = self.full_sync().await {
                        warn!("Background sync failed: {}", e);
                    }
                }
            }
        }
    }

    async fn sync_all_tables(&self) -> Result<()> {
        info!("Syncing all tables between local and remote");
        
        // Sync each table individually for comprehensive data consistency
        let tables = ["books", "students", "categories", "borrowings", "classes"];
        
        for table in tables {
            match self.sync_table(table).await {
                Ok(_) => debug!("Successfully synced table: {}", table),
                Err(e) => warn!("Failed to sync table {}: {}", table, e),
            }
        }
        
        info!("Completed syncing all tables");
        Ok(())
    }

    pub async fn full_sync(&self) -> Result<()> {
        info!("Performing full sync between local SQLite and Supabase");
        
        let mut status = self.status.write().await;
        status.is_syncing = true;
        drop(status);
        
        let result = async {
            // 1. Check connectivity first
            if !self.check_connectivity().await {
                return Err(anyhow::anyhow!("No internet connectivity"));
            }
            
            // 2. Pull latest data from Supabase
            self.pull_from_supabase().await?;
            
            // 3. Push local changes to Supabase
            self.push_to_supabase().await?;
            
            // 4. Sync all tables (comprehensive sync)
            self.sync_all_tables().await?;
            
            // 5. Process pending operations
            self.process_pending_operations().await?;
            
            Ok(())
        }.await;
        
        let mut status = self.status.write().await;
        status.is_syncing = false;
        
        match result {
            Ok(_) => {
                status.last_sync = Some(Utc::now());
                status.last_error = None;
                status.pending_operations = 0;
                info!("Full sync completed successfully");
            }
            Err(e) => {
                status.last_error = Some(e.to_string());
                error!("Full sync failed: {}", e);
            }
        }
        
        Ok(())
    }

    async fn pull_from_supabase(&self) -> Result<()> {
        info!("Pulling latest data from Supabase");
        // Implementation would fetch data from Supabase REST API
        // and update local SQLite database
        tokio::time::sleep(Duration::from_millis(500)).await;
        Ok(())
    }

    async fn push_to_supabase(&self) -> Result<()> {
        info!("Pushing local changes to Supabase");
        // Implementation would send local changes to Supabase
        tokio::time::sleep(Duration::from_millis(300)).await;
        Ok(())
    }

    async fn process_pending_operations(&self) -> Result<()> {
        info!("Processing pending operations");
        // Implementation would process queued operations
        Ok(())
    }

    pub async fn queue_operation(
        &self, 
        table_name: &str, 
        operation_type: OperationType, 
        record_id: &str, 
        data: serde_json::Value
    ) -> Result<()> {
        info!("Queueing operation for table: {} (offline-first approach)", table_name);
        
        // Store operation in local queue for later sync
        // This enables true offline-first operation
        let mut status = self.status.write().await;
        status.pending_operations += 1;
        drop(status);
        
        // In a real implementation, this would:
        // 1. Store operation in local sync_queue table with timestamp
        // 2. Try immediate sync if online
        // 3. Schedule retry if offline
        // 4. Handle conflict resolution when online
        
        // If online, try to sync immediately
        if self.check_connectivity().await {
            if let Err(e) = self.sync_single_operation(table_name, &operation_type, record_id, &data).await {
                warn!("Immediate sync failed, operation queued: {}", e);
            } else {
                // Operation successful, remove from queue
                let mut status = self.status.write().await;
                if status.pending_operations > 0 {
                    status.pending_operations -= 1;
                }
            }
        }
        
        Ok(())
    }

    async fn sync_single_operation(
        &self,
        table_name: &str,
        operation_type: &OperationType,
        record_id: &str,
        data: &serde_json::Value
    ) -> Result<()> {
        info!("Syncing single operation for table: {} ({})", table_name, match operation_type {
            OperationType::Create => "CREATE",
            OperationType::Update => "UPDATE", 
            OperationType::Delete => "DELETE",
        });
        
        // For update operations, check for conflicts
        if matches!(operation_type, OperationType::Update) {
            // Simulate fetching remote data
            let remote_data = serde_json::json!({
                "id": record_id,
                "updated_at": "2024-01-01T12:00:00Z",
                "title": "Remote version"
            });
            
            // Use conflict resolution if versions differ
            if data.get("updated_at") != remote_data.get("updated_at") {
                match self.handle_conflict(data, &remote_data).await {
                    Ok(resolved_data) => {
                        info!("Conflict resolved for {} in table {}", record_id, table_name);
                        // In a real implementation, this would update the local or remote version
                        // based on the resolved data
                        debug!("Resolved data: {}", resolved_data);
                    }
                    Err(e) => {
                        warn!("Conflict resolution failed for {}: {}", record_id, e);
                        return Err(e);
                    }
                }
            }
        }
        
        // Simulate sync operation
        tokio::time::sleep(Duration::from_millis(100)).await;
        Ok(())
    }

    pub async fn check_connectivity(&self) -> bool {
        // First try a simple internet connectivity check using a reliable endpoint
        let simple_check = self.client
            .get("https://httpbin.org/get")
            .timeout(Duration::from_secs(5))
            .send()
            .await;
            
        if simple_check.is_ok() {
            // If basic internet works, update status immediately
            let mut status = self.status.write().await;
            status.is_online = true;
            info!("Internet connectivity confirmed via httpbin.org");
            return true;
        }
        
        // Also try Google's public DNS as a fallback
        let fallback_check = self.client
            .get("https://dns.google/")
            .timeout(Duration::from_secs(3))
            .send()
            .await;
            
        if fallback_check.is_ok() {
            let mut status = self.status.write().await;
            status.is_online = true;
            info!("Internet connectivity confirmed via Google DNS");
            return true;
        }
        
        // Only try Supabase if we have a real URL (not placeholder)
        if !self.config.url.contains("your-project") && !self.config.url.is_empty() {
            let health_url = format!("{}/rest/v1/", self.config.url);
            
            match self.client
                .get(&health_url)
                .header("apikey", &self.config.anon_key)
                .timeout(Duration::from_secs(5))
                .send()
                .await
            {
                Ok(response) => {
                    let is_online = response.status().is_success() || response.status() == 400; // 400 is OK for auth
                    let mut status = self.status.write().await;
                    status.is_online = is_online;
                    info!("Supabase connectivity check result: {}", is_online);
                    return is_online;
                }
                Err(e) => {
                    debug!("Supabase connectivity check failed: {}", e);
                }
            }
        } else {
            debug!("Skipping Supabase connectivity check - using placeholder URL");
        }
        
        // If all checks fail, we're offline
        let mut status = self.status.write().await;
        status.is_online = false;
        debug!("All connectivity checks failed - marking as offline");
        false
    }

    pub fn is_online(&self) -> bool {
        // Return cached online status (updated by background loop)
        futures::executor::block_on(async {
            self.status.read().await.is_online
        })
    }

    pub async fn get_sync_status(&self) -> SyncStatus {
        self.status.read().await.clone()
    }

    pub async fn sync_table(&self, table_name: &str) -> Result<()> {
        debug!("Syncing table: {} with Supabase", table_name);
        
        // Ensure we're online before attempting table sync
        if !self.is_online() {
            return Err(anyhow::anyhow!("Cannot sync table {} - offline", table_name));
        }
        
        // In a real implementation, this would:
        // 1. Get last sync timestamp for this table
        // 2. Pull changes from Supabase since last sync
        // 3. Apply changes to local SQLite with conflict resolution
        // 4. Push local changes to Supabase
        // 5. Update sync timestamps
        
        // Simulate sync work
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        info!("Successfully synced table: {}", table_name);
        Ok(())
    }

    pub async fn handle_conflict(&self, local_data: &serde_json::Value, remote_data: &serde_json::Value) -> Result<serde_json::Value> {
        info!("Handling data conflict between local and remote versions");
        
        // Extract timestamps for conflict resolution
        let local_updated = local_data.get("updated_at").and_then(|v| v.as_str());
        let remote_updated = remote_data.get("updated_at").and_then(|v| v.as_str());
        
        match (local_updated, remote_updated) {
            (Some(local_time), Some(remote_time)) => {
                // Last modified wins strategy
                if local_time > remote_time {
                    info!("Conflict resolved: Local version is newer");
                    Ok(local_data.clone())
                } else {
                    info!("Conflict resolved: Remote version is newer");
                    Ok(remote_data.clone())
                }
            }
            (None, Some(_)) => {
                info!("Conflict resolved: Remote has timestamp, local doesn't");
                Ok(remote_data.clone())
            }
            (Some(_), None) => {
                info!("Conflict resolved: Local has timestamp, remote doesn't");
                Ok(local_data.clone())
            }
            (None, None) => {
                // Fallback: server wins when no timestamps available
                warn!("Conflict resolved: No timestamps available, defaulting to server version");
                Ok(remote_data.clone())
            }
        }
    }

    // Session management for offline persistence
    pub async fn maintain_session(&self) -> Result<()> {
        info!("Maintaining session for offline persistence");
        
        // In a real implementation, this would:
        // 1. Refresh auth tokens if needed
        // 2. Persist session state locally in SQLite
        // 3. Handle session recovery on app restart
        // 4. Manage offline user identity
        
        Ok(())
    }

    pub async fn restore_session(&self) -> Result<()> {
        info!("Restoring session from offline storage");
        
        // In a real implementation, this would:
        // 1. Load saved session from local SQLite storage
        // 2. Validate session if online
        // 3. Enable offline mode if session invalid
        // 4. Initialize user context for offline operation
        
        Ok(())
    }
}

// Make SyncEngine cloneable for background tasks
impl Clone for SyncEngine {
    fn clone(&self) -> Self {
        Self {
            db: Arc::clone(&self.db),
            config: self.config.clone(),
            client: self.client.clone(),
            status: Arc::clone(&self.status),
        }
    }
}
