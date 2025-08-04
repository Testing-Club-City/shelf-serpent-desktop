pub mod error;
pub mod traits;
pub mod engine;
pub mod conflict;
pub mod strategy;
pub mod remote;
pub mod local;

// These imports are used in the commented-out code below
// use chrono::{DateTime, Utc};
// use tokio::time::Duration;
// use tracing::{info, warn, debug, error};

pub use engine::{SyncEngine, SyncEngineBuilder};
pub use traits::SyncStatus;
pub use conflict::DefaultConflictResolver;
pub use remote::supabase::{SupabaseConfig, SupabaseRemoteDataSource};
pub use local::sqlite::SqliteLocalDataStore;

// Additional SyncEngine methods for the library management system - disabled for build
/*
impl SyncEngine {
    pub async fn start_sync_service(&self) -> Result<()> {
        info!("Starting sync service for offline-first backend");
        
        let mut status = self.status.write().await;
        status.database_initialized = true;
        drop(status);
        
        info!("Performing quick connectivity check...");
        // Quick single attempt with shorter timeout
        let is_connected = self.check_connectivity_quick().await;
        
        let mut status = self.status.write().await;
        status.is_online = is_connected;
        drop(status);
        
        if is_connected {
            info!("Connectivity detected - starting background sync");
            // Start initial data pull in background without blocking
            let engine = self.clone();
            tokio::spawn(async move {
                if let Err(e) = engine.initial_data_pull().await {
                    warn!("Initial data pull failed, continuing in offline mode: {}", e);
                }
            });
        } else {
            info!("No connectivity detected - starting in full offline mode");
        }
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
        
        // 1. Fetch books from Supabase
        match self.fetch_books_from_supabase().await {
            Ok(books) => {
                info!("Fetched {} books from Supabase", books.len());
                for book in books {
                    if let Err(e) = self.db.create_book(&book).await {
                        warn!("Failed to insert book {}: {}", book.title, e);
                    }
                }
            }
            Err(e) => warn!("Failed to fetch books from Supabase: {}", e),
        }
        
        // 2. Fetch categories from Supabase
        match self.fetch_categories_from_supabase().await {
            Ok(categories) => {
                info!("Fetched {} categories from Supabase", categories.len());
                for category in categories {
                    if let Err(e) = self.db.create_category(&category).await {
                        warn!("Failed to insert category {}: {}", category.name, e);
                    }
                }
            }
            Err(e) => warn!("Failed to fetch categories from Supabase: {}", e),
        }
        
        // 3. Fetch students from Supabase
        match self.fetch_students_from_supabase().await {
            Ok(students) => {
                info!("Fetched {} students from Supabase", students.len());
                for student in students {
                    if let Err(e) = self.db.create_student(&student).await {
                        warn!("Failed to insert student {} {}: {}", student.first_name, student.last_name, e);
                    }
                }
            }
            Err(e) => warn!("Failed to fetch students from Supabase: {}", e),
        }
        
        // 4. Fetch staff from Supabase
        match self.fetch_staff_from_supabase().await {
            Ok(staff_list) => {
                info!("Fetched {} staff from Supabase", staff_list.len());
                for staff in staff_list {
                    if let Err(e) = self.db.create_staff(&staff).await {
                        warn!("Failed to insert staff {} {}: {}", staff.first_name, staff.last_name, e);
                    }
                }
            }
            Err(e) => warn!("Failed to fetch staff from Supabase: {}", e),
        }
        
        // Fetch book copies from Supabase
        match self.fetch_book_copies_from_supabase().await {
            Ok(book_copies) => {
                info!("Fetched {} book copies from Supabase", book_copies.len());
                for book_copy in book_copies {
                    if let Err(e) = self.db.create_book_copy(&book_copy).await {
                        warn!("Failed to insert book copy {}: {}", book_copy.book_code, e);
                    }
                }
            }
            Err(e) => warn!("Failed to fetch book copies from Supabase: {}", e),
        }

        // Fetch borrowings from Supabase
        match self.fetch_borrowings_from_supabase().await {
            Ok(borrowings) => {
                info!("Fetched {} borrowings from Supabase", borrowings.len());
                for borrowing in borrowings {
                    if let Err(e) = self.db.create_borrowing(&borrowing).await {
                        warn!("Failed to insert borrowing {}: {}", borrowing.id, e);
                    }
                }
            }
            Err(e) => warn!("Failed to fetch borrowings from Supabase: {}", e),
        }

        // Fetch fines from Supabase
        match self.fetch_fines_from_supabase().await {
            Ok(fines) => {
                info!("Fetched {} fines from Supabase", fines.len());
                for fine in fines {
                    if let Err(e) = self.db.create_fine(&fine).await {
                        warn!("Failed to insert fine {}: {}", fine.id, e);
                    }
                }
            }
            Err(e) => warn!("Failed to fetch fines from Supabase: {}", e),
        }

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
        
        // Sync all tables including missing ones
        let tables = [
            "categories", "books", "book_copies", "classes", "students", 
            "staff", "borrowings", "group_borrowings", "fines", 
            "fine_settings", "theft_reports", "user_sessions"
        ];
        
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

    /// Quick connectivity check for faster startup
    pub async fn check_connectivity_quick(&self) -> bool {
        // Single quick check with short timeout for startup
        let quick_check = self.client
            .get("https://httpbin.org/get")
            .timeout(Duration::from_secs(2)) // Shorter timeout for quick startup
            .send()
            .await;
            
        if quick_check.is_ok() {
            let mut status = self.status.write().await;
            status.is_online = true;
            info!("Quick connectivity check passed");
            return true;
        }
        
        // Quick fallback to Google DNS
        let fallback_check = self.client
            .get("https://dns.google/")
            .timeout(Duration::from_secs(1)) // Very short timeout
            .send()
            .await;
            
        let is_online = fallback_check.is_ok();
        let mut status = self.status.write().await;
        status.is_online = is_online;
        info!("Quick connectivity check result: {}", is_online);
        is_online
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
        
        let start_time = std::time::Instant::now();
        
        // 1. Get last sync timestamp for this table
        let last_sync = self.get_last_sync_timestamp(table_name).await?;
        
        // 2. Pull changes from Supabase since last sync
        let remote_changes = self.pull_supabase_changes(table_name, last_sync).await?;
        
        // 3. Apply changes to local SQLite with conflict resolution
        self.apply_remote_changes(table_name, &remote_changes).await?;
        
        // 4. Push local changes to Supabase
        let local_changes = self.get_local_changes(table_name, last_sync).await?;
        self.push_local_changes(table_name, &local_changes).await?;
        
        // 5. Update sync timestamps
        self.update_sync_timestamp(table_name).await?;
        
        let duration = start_time.elapsed();
        info!("Successfully synced table: {} in {:?}", table_name, duration);
        Ok(())
    }

    // Helper methods for sync operations
    async fn get_last_sync_timestamp(&self, table_name: &str) -> Result<Option<DateTime<Utc>>> {
        let conn = self.db.conn.lock().await;
        let query = "SELECT last_sync FROM sync_state WHERE table_name = ?";
        
        let mut stmt = conn.prepare(query)?;
        let result: Result<String, _> = stmt.query_row([table_name], |row| row.get(0));
        
        match result {
            Ok(timestamp_str) => {
                let datetime = DateTime::parse_from_rfc3339(&timestamp_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .ok();
                Ok(datetime)
            }
            Err(_) => Ok(None),
        }
    }

    async fn pull_supabase_changes(&self, table_name: &str, since: Option<DateTime<Utc>>) -> Result<Vec<serde_json::Value>> {
        let supabase_client = self.supabase_client.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Supabase client not initialized"))?;

        let mut query = supabase_client
            .from(table_name)
            .select("*");

        // Add timestamp filter if provided
        if let Some(since_time) = since {
            query = query.gt("updated_at", since_time.to_rfc3339());
        }

        let response = query.execute().await?;
        let data: Vec<serde_json::Value> = response.json().await?;
        
        Ok(data)
    }

    async fn apply_remote_changes(&self, table_name: &str, changes: &[serde_json::Value]) -> Result<()> {
        let conn = self.db.conn.lock().await;
        
        for mut change in changes {
            let mut normalized_change = change.clone();
            self.normalize_data_for_sync(&mut normalized_change)?;
            
            if let Some(id) = normalized_change.get("id").and_then(|v| v.as_str()) {
                // Check if record exists locally
                let exists: bool = conn.query_row(
                    &format!("SELECT COUNT(*) FROM {} WHERE id = ?", table_name),
                    [id],
                    |row| row.get(0)
                )?;

                if exists {
                    // Update existing record
                    self.update_local_record(table_name, id, &normalized_change).await?;
                } else {
                    // Insert new record
                    self.insert_local_record(table_name, &normalized_change).await?;
                }
            }
        }
        
        Ok(())
    }

    async fn get_local_changes(&self, table_name: &str, since: Option<DateTime<Utc>>) -> Result<Vec<serde_json::Value>> {
        let conn = self.db.conn.lock().await;
        
        let mut query = format!("SELECT * FROM {} WHERE synced = 0", table_name);
        
        if let Some(since_time) = since {
            query = format!("{} AND updated_at > '{}'", query, since_time.to_rfc3339());
        }

        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map([], |row| {
            let mut map = serde_json::Map::new();
            
            // Get column count and names
            let column_count = row.column_count();
            for i in 0..column_count {
                let column_name = row.column_name(i)?;
                let value = row.get_ref(i)?;
                
                // Convert SQLite value to JSON value
                let json_value = match value {
                    rusqlite::types::ValueRef::Text(text) => {
                        serde_json::Value::String(String::from_utf8_lossy(text).to_string())
                    }
                    rusqlite::types::ValueRef::Integer(i) => {
                        serde_json::Value::Number(serde_json::Number::from(i))
                    }
                    rusqlite::types::ValueRef::Real(f) => {
                        serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(0.0))
                    }
                    rusqlite::types::ValueRef::Null => {
                        serde_json::Value::Null
                    }
                    rusqlite::types::ValueRef::Blob(blob) => {
                        serde_json::Value::String(String::from_utf8_lossy(blob).to_string())
                    }
                };
                
                map.insert(column_name.to_string(), json_value);
            }
            
            Ok(serde_json::Value::Object(map))
        })?;

        let changes: Vec<serde_json::Value> = rows.collect::<Result<Vec<_>, _>>()?;
        Ok(changes)
    }

    async fn push_local_changes(&self, table_name: &str, changes: &[serde_json::Value]) -> Result<()> {
        let supabase_client = self.supabase_client.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Supabase client not initialized"))?;

        for change in changes {
            let mut normalized_change = change.clone();
            
            // For pushing to Supabase, we need to convert TEXT format back to UUID format
            if let Some(obj) = normalized_change.as_object_mut() {
                let uuid_fields = vec!["id", "book_id", "student_id", "staff_id", "category_id", 
                                      "class_id", "borrowing_id", "fine_id", "user_id"];
                
                for field in uuid_fields {
                    if let Some(value) = obj.get_mut(field) {
                        if let Some(uuid_str) = value.as_str() {
                            let uuid_str = self.convert_text_to_uuid(uuid_str);
                            *value = serde_json::Value::String(uuid_str);
                        }
                    }
                }
            }
            
            if let Some(id) = normalized_change.get("id").and_then(|v| v.as_str()) {
                // Check if record exists remotely
                let response = supabase_client
                    .from(table_name)
                    .select("id")
                    .eq("id", id)
                    .execute()
                    .await?;

                let exists: Vec<serde_json::Value> = response.json().await?;

                if exists.is_empty() {
                    // Insert new record
                    supabase_client
                        .from(table_name)
                        .insert(normalized_change.clone())
                        .execute()
                        .await?;
                } else {
                    // Update existing record
                    supabase_client
                        .from(table_name)
                        .update(normalized_change.clone())
                        .eq("id", id)
                        .execute()
                        .await?;
                }
            }
        }
        
        Ok(())
    }

    async fn update_local_record(&self, table_name: &str, id: &str, data: &serde_json::Value) -> Result<()> {
        let conn = self.db.conn.lock().await;
        
        // Build dynamic update query based on the JSON data
        let mut columns = Vec::new();
        let mut values = Vec::new();
        
        if let Some(obj) = data.as_object() {
            for (key, value) in obj {
                if key != "id" { // Skip ID as it's used in WHERE clause
                    columns.push(key.clone());
                    values.push(value.clone());
                }
            }
        }
        
        if columns.is_empty() {
            return Ok(());
        }
        
        // Build SET clause
        let set_clause = columns.iter()
            .map(|col| format!("{} = ?", col))
            .collect::<Vec<_>>()
            .join(", ");
        
        let query = format!("UPDATE {} SET {} WHERE id = ?", table_name, set_clause);
        
        // Convert JSON values to SQLite parameters
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        for value in values {
            let param = match value {
                serde_json::Value::String(s) => Box::new(s) as Box<dyn rusqlite::ToSql>,
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Box::new(i) as Box<dyn rusqlite::ToSql>
                    } else if let Some(f) = n.as_f64() {
                        Box::new(f) as Box<dyn rusqlite::ToSql>
                    } else {
                        Box::new(n.to_string()) as Box<dyn rusqlite::ToSql>
                    }
                }
                serde_json::Value::Bool(b) => Box::new(b) as Box<dyn rusqlite::ToSql>,
                serde_json::Value::Null => Box::new("") as Box<dyn rusqlite::ToSql>,
                _ => Box::new(value.to_string()) as Box<dyn rusqlite::ToSql>,
            };
            params.push(param);
        }
        
        // Add ID parameter
        params.push(Box::new(id.to_string()));
        
        // Execute query with dynamic parameters
        let mut stmt = conn.prepare(&query)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        stmt.execute(rusqlite::params_from_iter(param_refs))?;
        
        Ok(())
    }

    async fn insert_local_record(&self, table_name: &str, data: &serde_json::Value) -> Result<()> {
        let conn = self.db.conn.lock().await;
        
        if let Some(obj) = data.as_object() {
            let columns: Vec<String> = obj.keys().cloned().collect();
            let values: Vec<serde_json::Value> = obj.values().cloned().collect();
            
            if columns.is_empty() {
                return Ok(());
            }
            
            let column_list = columns.join(", ");
            let placeholder_list = columns.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
            
            let query = format!("INSERT OR REPLACE INTO {} ({}) VALUES ({})", table_name, column_list, placeholder_list);
            
            // Convert JSON values to SQLite parameters
            let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
            for value in values {
                let param = match value {
                    serde_json::Value::String(s) => Box::new(s) as Box<dyn rusqlite::ToSql>,
                    serde_json::Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            Box::new(i) as Box<dyn rusqlite::ToSql>
                        } else if let Some(f) = n.as_f64() {
                            Box::new(f) as Box<dyn rusqlite::ToSql>
                        } else {
                            Box::new(n.to_string()) as Box<dyn rusqlite::ToSql>
                        }
                    }
                    serde_json::Value::Bool(b) => Box::new(b) as Box<dyn rusqlite::ToSql>,
                    serde_json::Value::Null => Box::new("") as Box<dyn rusqlite::ToSql>,
                    _ => Box::new(value.to_string()) as Box<dyn rusqlite::ToSql>,
                };
                params.push(param);
            }
            
            let mut stmt = conn.prepare(&query)?;
            let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
            stmt.execute(rusqlite::params_from_iter(param_refs))?;
        }
        
        Ok(())
    }

    async fn update_sync_timestamp(&self, table_name: &str) -> Result<()> {
        let conn = self.db.conn.lock().await;
        
        let timestamp = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO sync_state (table_name, last_sync) VALUES (?, ?)",
            [table_name, &timestamp]
        )?;
        
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

    // Utility methods for handling type conversions
    fn convert_uuid_to_text(&self, uuid: &str) -> String {
        // Convert UUID format (with hyphens) to simple text format
        uuid.replace("-", "")
    }

    fn convert_text_to_uuid(&self, text: &str) -> String {
        // Convert simple text format to UUID format (with hyphens)
        if text.len() == 32 {
            format!("{}-{}-{}-{}-{}", 
                &text[0..8], &text[8..12], &text[12..16], &text[16..20], &text[20..32])
        } else {
            text.to_string()
        }
    }

    fn normalize_data_for_sync(&self, data: &mut serde_json::Value) -> Result<()> {
        // Normalize data types between SQLite and Supabase
        if let Some(obj) = data.as_object_mut() {
            // Handle UUID fields - convert to text format for SQLite
            let uuid_fields = vec!["id", "book_id", "student_id", "staff_id", "category_id", 
                                  "class_id", "borrowing_id", "fine_id", "user_id"];
            
            for field in uuid_fields {
                if let Some(value) = obj.get_mut(field) {
                    if let Some(uuid_str) = value.as_str() {
                        *value = serde_json::Value::String(self.convert_uuid_to_text(uuid_str));
                    }
                }
            }
            
            // Handle enum fields - ensure consistent string representation
            let enum_fields = vec!["status", "condition", "type", "role", "gender", "academic_year"];
            
            for field in enum_fields {
                if let Some(value) = obj.get_mut(field) {
                    if let Some(enum_str) = value.as_str() {
                        *value = serde_json::Value::String(enum_str.to_lowercase());
                    }
                }
            }
        }
        
        Ok(())
    }

// Supabase fetch methods
    async fn fetch_book_copies_from_supabase(&self) -> Result<Vec<crate::models::BookCopy>> {
        use crate::models::{BookCopy, BookCondition, CopyStatus};
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        
        let mut book_copies = Vec::new();
        let mut offset = 0;
        let limit = 1000;
        loop {
            let url = format!("{}/rest/v1/book_copies?select=*&limit={}&offset={}&eq=", self.config.url, limit, offset);
            let response = self.client
                .get(&url)
                .header("apikey", &self.config.anon_key)
                .header("Authorization", format!("Bearer {}", self.config.anon_key))
                .timeout(Duration::from_secs(30))
                .send()
                .await?;
            if !response.status().is_success() {
                return Err(anyhow::anyhow!("Failed to fetch book copies: HTTP {}", response.status()));
            }
            let json: serde_json::Value = response.json().await?;
            if let Some(array) = json.as_array() {
                for item in array {
                    let book_copy = BookCopy {
                        id: Uuid::parse_str(item["id"].as_str().unwrap_or_default()).unwrap_or_else(|_| Uuid::new_v4()),
                        book_id: item["book_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        copy_number: item["copy_number"].as_i64().unwrap_or(1) as i32,
                        book_code: item["book_code"].as_str().unwrap_or("").to_string(),
                        condition: item["condition"].as_str().and_then(|s| match s {
                            "excellent" => Some(BookCondition::Excellent),
                            "good" => Some(BookCondition::Good),
                            "fair" => Some(BookCondition::Fair),
                            "poor" => Some(BookCondition::Poor),
                            "damaged" => Some(BookCondition::Damaged),
                            "lost" => Some(BookCondition::Lost),
                            "stolen" => Some(BookCondition::Stolen),
                            _ => Some(BookCondition::Good),
                        }).unwrap_or(BookCondition::Good),
                        status: item["status"].as_str().and_then(|s| match s {
                            "available" => Some(CopyStatus::Available),
                            "borrowed" => Some(CopyStatus::Borrowed),
                            "maintenance" => Some(CopyStatus::Maintenance),
                            "lost" => Some(CopyStatus::Lost),
                            "stolen" => Some(CopyStatus::Stolen),
                            _ => Some(CopyStatus::Available),
                        }).unwrap_or(CopyStatus::Available),
                        created_at: item["created_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        updated_at: item["updated_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        tracking_code: item["tracking_code"].as_str().map(|s| s.to_string()),
                        notes: item["notes"].as_str().map(|s| s.to_string()),
                        legacy_book_id: item["legacy_book_id"].as_i64().map(|i| i as i32),
                    };
                    book_copies.push(book_copy);
                }
                if array.is_empty() {
                    break;
                }
                offset += limit;
            } else {
                break;
            }
        }
        Ok(book_copies)
    }

    async fn fetch_borrowings_from_supabase(&self) -> Result<Vec<crate::models::Borrowing>> {
        use crate::models::{Borrowing, BorrowingStatus, BorrowerType};
        use uuid::Uuid;
        use chrono::{DateTime, Utc, NaiveDate};
        
        let mut borrowings = Vec::new();
        let mut offset = 0;
        let limit = 1000;
        loop {
            let url = format!("{}/rest/v1/borrowings?select=*&limit={}&offset={}&eq=", self.config.url, limit, offset);
            let response = self.client
                .get(&url)
                .header("apikey", &self.config.anon_key)
                .header("Authorization", format!("Bearer {}", self.config.anon_key))
                .timeout(Duration::from_secs(30))
                .send()
                .await?;
            if !response.status().is_success() {
                return Err(anyhow::anyhow!("Failed to fetch borrowings: HTTP {}", response.status()));
            }
            let json: serde_json::Value = response.json().await?;
            if let Some(array) = json.as_array() {
                for item in array {
                    let borrowing = Borrowing {
                        id: Uuid::parse_str(item["id"].as_str().unwrap_or_default()).unwrap_or_else(|_| Uuid::new_v4()),
                        student_id: item["student_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        book_id: item["book_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        borrowed_date: item["borrowed_date"].as_str()
                            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
                            .unwrap_or_else(|| NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()),
                        due_date: item["due_date"].as_str()
                            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
                            .unwrap_or_else(|| NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()),
                        returned_date: item["returned_date"].as_str().and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()),
                        status: item["status"].as_str().and_then(|s| match s {
                            "active" => Some(BorrowingStatus::Active),
                            "returned" => Some(BorrowingStatus::Returned),
                            "overdue" => Some(BorrowingStatus::Overdue),
                            "lost" => Some(BorrowingStatus::Lost),
                            _ => Some(BorrowingStatus::Active),
                        }).unwrap_or(BorrowingStatus::Active),
                        fine_amount: item["fine_amount"].as_f64().unwrap_or(0.0),
                        notes: item["notes"].as_str().map(|s| s.to_string()),
                        issued_by: item["issued_by"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        returned_by: item["returned_by"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        created_at: item["created_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        updated_at: item["updated_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        fine_paid: item["fine_paid"].as_bool().unwrap_or(false),
                        book_copy_id: item["book_copy_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        condition_at_issue: item["condition_at_issue"].as_str().unwrap_or("").to_string(),
                        condition_at_return: item["condition_at_return"].as_str().map(|s| s.to_string()),
                        is_lost: item["is_lost"].as_bool().unwrap_or(false),
                        tracking_code: item["tracking_code"].as_str().map(|s| s.to_string()),
                        return_notes: item["return_notes"].as_str().map(|s| s.to_string()),
                        copy_condition: item["copy_condition"].as_str().map(|s| s.to_string()),
                        group_borrowing_id: item["group_borrowing_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        borrower_type: item["borrower_type"].as_str().and_then(|s| match s {
                            "student" => Some(BorrowerType::Student),
                            "staff" => Some(BorrowerType::Staff),
                            _ => Some(BorrowerType::Student),
                        }).unwrap_or(BorrowerType::Student),
                        staff_id: item["staff_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                    };
                    borrowings.push(borrowing);
                }
                if array.len() < limit {
                    break;
                }
            } else {
                break;
            }
            offset += limit;
        }
        Ok(borrowings)
    }

    async fn fetch_fines_from_supabase(&self) -> Result<Vec<crate::models::Fine>> {
        use crate::models::{Fine, FineType, FineStatus, BorrowerType};
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        
        let mut fines = Vec::new();
        let mut offset = 0;
        let limit = 1000;
        loop {
            let url = format!("{}/rest/v1/fines?select=*&limit={}&offset={}&eq=", self.config.url, limit, offset);
            let response = self.client
                .get(&url)
                .header("apikey", &self.config.anon_key)
                .header("Authorization", format!("Bearer {}", self.config.anon_key))
                .timeout(Duration::from_secs(30))
                .send()
                .await?;
            if !response.status().is_success() {
                return Err(anyhow::anyhow!("Failed to fetch fines: HTTP {}", response.status()));
            }
            let json: serde_json::Value = response.json().await?;
            if let Some(array) = json.as_array() {
                for item in array {
                    let fine = Fine {
                        id: Uuid::parse_str(item["id"].as_str().unwrap_or_default()).unwrap_or_else(|_| Uuid::new_v4()),
                        student_id: item["student_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        borrowing_id: item["borrowing_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        fine_type: item["fine_type"].as_str().and_then(|s| match s {
                            "overdue" => Some(FineType::Overdue),
                            "damaged" => Some(FineType::Damaged),
                            "lost" => Some(FineType::Lost),
                            _ => Some(FineType::Overdue),
                        }).unwrap_or(FineType::Overdue),
                        amount: item["amount"].as_f64().unwrap_or(0.0),
                        description: item["description"].as_str().map(|s| s.to_string()),
                        status: item["status"].as_str().and_then(|s| match s {
                            "unpaid" => Some(FineStatus::Unpaid),
                            "paid" => Some(FineStatus::Paid),
                            "waived" => Some(FineStatus::Waived),
                            _ => Some(FineStatus::Unpaid),
                        }).unwrap_or(FineStatus::Unpaid),
                        created_at: item["created_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        updated_at: item["updated_at"].as_str()
                            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                            .map(|dt| dt.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now),
                        created_by: item["created_by"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                        borrower_type: item["borrower_type"].as_str().and_then(|s| match s {
                            "student" => Some(BorrowerType::Student),
                            "staff" => Some(BorrowerType::Staff),
                            _ => Some(BorrowerType::Student),
                        }).unwrap_or(BorrowerType::Student),
                        staff_id: item["staff_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()),
                    };
                    fines.push(fine);
                }
                if array.len() < limit {
                    break;
                }
            } else {
                break;
            }
            offset += limit;
        }
        Ok(fines)
    }

    async fn fetch_books_from_supabase(&self) -> Result<Vec<crate::models::Book>> {
        use crate::models::{Book, BookStatus};
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        
        let mut books = Vec::new();
        let mut offset = 0;
        let limit = 1000; // Supabase's max limit
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
                    // Parse each book from Supabase format
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
                        status: BookStatus::Available, // Default status
                        condition: item["condition"].as_str().and_then(|s| match s {
                            "excellent" => Some(crate::models::BookCondition::Excellent),
                            "good" => Some(crate::models::BookCondition::Good),
                            "fair" => Some(crate::models::BookCondition::Fair),
                            "poor" => Some(crate::models::BookCondition::Poor),
                            "damaged" => Some(crate::models::BookCondition::Damaged),
                            "lost" => Some(crate::models::BookCondition::Lost),
                            "stolen" => Some(crate::models::BookCondition::Stolen),
                            _ => None,
                        }),
                        book_code: item["book_code"].as_str().map(|s| s.to_string()),
                        acquisition_year: item["acquisition_year"].as_i64().map(|y| y as i32),
                        legacy_book_id: item["legacy_book_id"].as_i64().map(|i| i as i32),
                        legacy_isbn: item["legacy_isbn"].as_str().map(|s| s.to_string()),
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

async fn fetch_categories_from_supabase(&self) -> Result<Vec<crate::models::Category>> {
        use crate::models::Category;
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        
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

async fn fetch_students_from_supabase(&self) -> Result<Vec<crate::models::Student>> {
        use crate::models::Student;
        use uuid::Uuid;
        use chrono::{DateTime, Utc, NaiveDate};
        
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
                        first_name: item["first_name"].as_str().unwrap_or("Unknown").to_string(),
                        last_name: item["last_name"].as_str().unwrap_or("Unknown").to_string(),
                        email: item["email"].as_str().map(|s| s.to_string()),
                        phone: item["phone"].as_str().map(|s| s.to_string()),
                        class_grade: item["class_grade"].as_str().unwrap_or("Unknown").to_string(),
                        address: item["address"].as_str().map(|s| s.to_string()),
                        date_of_birth: item["date_of_birth"].as_str()
                            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d ").ok()),
                        enrollment_date: item["enrollment_date"].as_str()
                            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d ").ok())
                            .unwrap_or_else(|| NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()),
                        status: item["status"].as_str().unwrap_or("Active").to_string(),
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

async fn fetch_staff_from_supabase(&self) -> Result<Vec<crate::models::Staff>> {
        use crate::models::Staff;
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        
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
                        first_name: item["first_name"].as_str().unwrap_or("Unknown").to_string(),
                        last_name: item["last_name"].as_str().unwrap_or("Unknown").to_string(),
                        email: item["email"].as_str().map(|s| s.to_string()),
                        phone: item["phone"].as_str().map(|s| s.to_string()),
                        department: item["department"].as_str().map(|s| s.to_string()),
                        position: item["position"].as_str().map(|s| s.to_string()),
                        status: item["status"].as_str().unwrap_or("Active").to_string(),
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
}

// Make SyncEngine cloneable for background tasks
impl Clone for SyncEngine {
    fn clone(&self) -> Self {
        Self {
            db: Arc::clone(&self.db),
            config: self.config.clone(),
            client: self.client.clone(),
            status: Arc::clone(&self.status),
            supabase_client: self.supabase_client.clone(),
        }
    }
}
*/
