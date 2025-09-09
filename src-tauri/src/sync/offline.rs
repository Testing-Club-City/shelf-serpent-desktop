use super::traits::RemoteDataSource;
use crate::sync::error::SyncError;
use crate::sync::traits::{SyncMetadata, SyncOperation};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value;

/// A remote data source that simulates an offline environment.
#[derive(Debug)]
pub struct OfflineRemoteDataSource;

impl OfflineRemoteDataSource {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl RemoteDataSource for OfflineRemoteDataSource {
    async fn check_connectivity(&self) -> bool {
        false
    }

    async fn fetch_changes(
        &self,
        _table_name: &str,
        _since: Option<DateTime<Utc>>,
        _limit: Option<usize>,
        _offset: Option<usize>,
    ) -> Result<Vec<(Value, SyncMetadata)>, SyncError> {
        // Simulate being offline by returning an empty vector.
        Ok(vec![])
    }

    async fn push_changes(
        &self,
        _table_name: &str,
        _changes: &[SyncOperation],
    ) -> Result<Vec<SyncMetadata>, SyncError> {
        // Simulate being offline by returning an empty vector.
        Ok(vec![])
    }
}
