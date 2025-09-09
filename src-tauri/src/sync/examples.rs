use std::sync::Arc;
use sqlx::SqlitePool;

use crate::sync::{
    SyncEngineBuilder, SupabaseConfig, SupabaseRemoteDataSource, 
    SqliteLocalDataStore, DefaultConflictResolver, TwoWaySyncStrategy
};

// Example: Setting up the new sync architecture
pub async fn setup_sync_engine() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Create database connection
    let database_url = "sqlite:./data.db";
    let pool = SqlitePool::connect(database_url).await?;
    
    // 2. Create remote data source
    let supabase_config = SupabaseConfig {
        url: "https://your-project.supabase.co".to_string(),
        anon_key: "your-anon-key".to_string(),
        batch_size: 100,
    };
    let remote = Arc::new(SupabaseRemoteDataSource::new(supabase_config)?);
    
    // 3. Create local data store
    let local = Arc::new(SqliteLocalDataStore::new(pool));
    
    // 4. Create conflict resolver
    let conflict_resolver = Arc::new(DefaultConflictResolver);
    
    // 5. Build sync engine
    let engine = SyncEngineBuilder::new()
        .with_remote(remote)
        .with_local(local)
        .with_conflict_resolver(conflict_resolver)
        .with_strategy("books".to_string(), Arc::new(TwoWaySyncStrategy))
        .with_strategy("students".to_string(), Arc::new(TwoWaySyncStrategy))
        .with_strategy("borrowings".to_string(), Arc::new(TwoWaySyncStrategy))
        .build()?;
    
    // 6. Initialize the engine
    engine.initialize().await?;
    
    // 7. Start background sync
    engine.start_background_sync(300).await?; // Sync every 5 minutes
    
    // 8. Perform initial sync
    let summaries = engine.sync_all_tables().await?;
    
    for summary in summaries {
        println!("Table: {}", summary.table_name);
        println!("  Remote changes: {}", summary.remote_changes);
        println!("  Local changes: {}", summary.local_changes);
        println!("  Conflicts: {}", summary.conflicts);
        println!("  Resolved: {}", summary.resolved);
        println!("  Duration: {}ms", summary.sync_duration_ms);
        
        if !summary.errors.is_empty() {
            println!("  Errors: {:?}", summary.errors);
        }
    }
    
    Ok(())
}

// Example: Making a model syncable
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: String,
    pub isbn: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

use crate::sync::traits::{Syncable, SyncMetadata, SyncResult};
use async_trait::async_trait;

#[async_trait]
impl Syncable for Book {
    fn table_name() -> &'static str {
        "books"
    }
    
    fn primary_key() -> &'static str {
        "id"
    }
    
    fn sync_metadata(&self) -> SyncMetadata {
        SyncMetadata {
            id: self.id.clone(),
            created_at: self.created_at,
            updated_at: self.updated_at,
            deleted_at: None,
            version: 1,
        }
    }
    
    fn from_value(value: serde_json::Value) -> SyncResult<Self> {
        serde_json::from_value(value).map_err(|e| crate::sync::error::SyncError::Serialization(e))
    }
    
    fn to_value(&self) -> SyncResult<serde_json::Value> {
        serde_json::to_value(self).map_err(|e| crate::sync::error::SyncError::Serialization(e))
    }
}

// Example: Using the sync engine in your application
pub async fn sync_books_example() -> Result<(), Box<dyn std::error::Error>> {
    let engine = setup_sync_engine().await?;
    
    // Sync a specific table
    let book_summary = engine.sync_table("books").await?;
    println!("Books sync completed: {:?}", book_summary);
    
    // Get current sync status
    let status = engine.get_status().await;
    println!("Sync status: {:?}", status);
    
    Ok(())
}
