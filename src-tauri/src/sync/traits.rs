use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;


use crate::sync::error::SyncResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMetadata {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncOperation {
    Create { data: Value, metadata: SyncMetadata },
    Update { data: Value, metadata: SyncMetadata },
    Delete { id: String, metadata: SyncMetadata },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConflict {
    pub local: Value,
    pub remote: Value,
    pub local_metadata: SyncMetadata,
    pub remote_metadata: SyncMetadata,
}



#[async_trait]
pub trait RemoteDataSource: Send + Sync {
    async fn fetch_changes(
        &self,
        table_name: &str,
        since: Option<DateTime<Utc>>,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> SyncResult<Vec<(Value, SyncMetadata)>>;
    
    async fn push_changes(
        &self,
        table_name: &str,
        changes: &[SyncOperation],
    ) -> SyncResult<Vec<SyncMetadata>>;
    
    async fn check_connectivity(&self) -> bool;
}

#[async_trait]
#[allow(dead_code)]
pub trait Syncable: Serialize + for<'de> Deserialize<'de> + Send + Sync {
    fn table_name() -> &'static str;
    fn primary_key() -> &'static str;
    fn sync_metadata(&self) -> SyncMetadata;
    fn from_value(value: Value) -> SyncResult<Self>;
    fn to_value(&self) -> SyncResult<Value>;
}

#[async_trait]
pub trait LocalDataStore: Send + Sync {
    async fn get_changes(&self, table_name: &str, since: Option<DateTime<Utc>>) -> SyncResult<Vec<SyncOperation>>;
    
    async fn apply_changes(&self, table_name: &str, changes: &[SyncOperation]) -> SyncResult<()>;
    
    async fn get_last_sync_time(&self, table_name: &str) -> SyncResult<Option<DateTime<Utc>>>;
    
    async fn set_last_sync_time(
        &self,
        table_name: &str,
        time: DateTime<Utc>,
    ) -> SyncResult<()>;

    #[allow(dead_code)]
    async fn resolve_conflicts(
        &self,
        conflicts: &[SyncConflict],
        strategy: ConflictResolutionStrategy,
    ) -> SyncResult<Vec<Value>>;
}

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub enum ConflictResolutionStrategy {
    #[allow(dead_code)]
    LocalWins,
    #[allow(dead_code)]
    RemoteWins,
    #[allow(dead_code)]
    NewestWins,
    #[allow(dead_code)]
    Merge,
    #[allow(dead_code)]
    Manual,
}

#[async_trait]
pub trait ConflictResolver: Send + Sync {
    async fn resolve(
        &self,
        conflict: &SyncConflict,
        strategy: ConflictResolutionStrategy,
    ) -> SyncResult<Value>;
}

#[async_trait]
pub trait SyncStrategy: Send + Sync {
    #[allow(dead_code)]
    async fn sync_table(
        &self,
        table_name: &str,
        remote: &dyn RemoteDataSource,
        local: &dyn LocalDataStore,
        conflict_resolver: &dyn ConflictResolver,
    ) -> SyncResult<SyncSummary>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncSummary {
    pub table_name: String,
    pub remote_changes: usize,
    pub local_changes: usize,
    pub conflicts: usize,
    pub resolved: usize,
    pub errors: Vec<String>,
    pub sync_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_online: bool,
    pub is_syncing: bool,
    pub last_sync: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub database_initialized: bool,
    pub initial_sync_completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OperationType {
    Create,
    Update,
    Delete,
}
