use async_trait::async_trait;
use chrono::Utc;
use std::time::Instant;

use crate::sync::{
    error::SyncResult,
    traits::{ConflictResolver, LocalDataStore, RemoteDataSource, SyncStrategy, SyncSummary, SyncOperation},
};

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub enum SyncDirection {
    LocalToRemote,
    RemoteToLocal,
}

pub struct TwoWaySyncStrategy;

#[async_trait]
impl SyncStrategy for TwoWaySyncStrategy {
    async fn sync_table(
        &self,
        table_name: &str,
        remote: &dyn RemoteDataSource,
        local: &dyn LocalDataStore,
        _conflict_resolver: &dyn ConflictResolver,
    ) -> SyncResult<SyncSummary> {
        let start_time = Instant::now();
        
        let last_sync = local.get_last_sync_time(table_name).await?;
        
        // Get changes since last sync
        let local_changes = local.get_changes(table_name, last_sync).await?;
        let remote_changes = remote.fetch_changes(table_name, last_sync, None, None).await?;
        
        // Process changes incrementally
        let mut conflicts = Vec::new();
        let mut processed = 0;
        
        // Handle remote changes first
        if !remote_changes.is_empty() {
            let operations: Vec<SyncOperation> = remote_changes.into_iter()
                .map(|(data, metadata)| SyncOperation::Update { data, metadata })
                .collect();
            local.apply_changes(table_name, &operations).await?;
            processed += operations.len();
        }
        
        // Handle local changes
        if !local_changes.is_empty() {
            // Check for conflicts with latest remote state
            let latest_remote = remote.fetch_changes(table_name, Some(Utc::now()), None, None).await?;
            
            let mut safe_local_changes = Vec::new();
            for local_change in local_changes {
                let id = match &local_change {
                    crate::sync::traits::SyncOperation::Create { metadata, .. } => &metadata.id,
                    crate::sync::traits::SyncOperation::Update { metadata, .. } => &metadata.id,
                    crate::sync::traits::SyncOperation::Delete { id, .. } => id,
                };
                
                // Simple conflict detection - if remote has changes for same ID
                let has_remote_conflict = latest_remote.iter().any(|(_, meta)| meta.id == *id);
                
                if has_remote_conflict {
                    conflicts.push(local_change);
                } else {
                    safe_local_changes.push(local_change);
                }
            }
            
            if !safe_local_changes.is_empty() {
                remote.push_changes(table_name, &safe_local_changes).await?;
                processed += safe_local_changes.len();
            }
        }
        
        // Update last sync time
        let now = Utc::now();
        local.set_last_sync_time(table_name, now).await?;
        
        Ok(SyncSummary {
            table_name: table_name.to_string(),
            remote_changes: 0,
            local_changes: processed,
            conflicts: conflicts.len(),
            resolved: 0,
            errors: Vec::new(),
            sync_duration_ms: start_time.elapsed().as_millis() as u64,
        })
    }
}

pub struct OneWaySyncStrategy {
    #[allow(dead_code)]
    pub direction: SyncDirection,
}



#[async_trait]
impl SyncStrategy for OneWaySyncStrategy {
    async fn sync_table(
        &self,
        table_name: &str,
        remote: &dyn RemoteDataSource,
        local: &dyn LocalDataStore,
        _conflict_resolver: &dyn ConflictResolver,
    ) -> SyncResult<SyncSummary> {
        let start_time = Instant::now();
        
        let last_sync = local.get_last_sync_time(table_name).await?;

        match self.direction {
            SyncDirection::LocalToRemote => {
                let local_changes = local.get_changes(table_name, last_sync).await?;
                if !local_changes.is_empty() {
                    remote.push_changes(table_name, &local_changes).await?;
                }
                
                Ok(SyncSummary {
                    table_name: table_name.to_string(),
                    remote_changes: 0,
                    local_changes: local_changes.len(),
                    conflicts: 0,
                    resolved: 0,
                    errors: Vec::new(),
                    sync_duration_ms: start_time.elapsed().as_millis() as u64,
                })
            }
            SyncDirection::RemoteToLocal => {
                let remote_changes = remote.fetch_changes(table_name, last_sync, None, None).await?;
                let remote_changes_count = remote_changes.len();
                if !remote_changes.is_empty() {
                    let operations: Vec<SyncOperation> = remote_changes.into_iter()
                        .map(|(data, metadata)| SyncOperation::Update { data, metadata })
                        .collect();
                    local.apply_changes(table_name, &operations).await?;
                }
                
                Ok(SyncSummary {
                    table_name: table_name.to_string(),
                    remote_changes: remote_changes_count,
                    local_changes: 0,
                    conflicts: 0,
                    resolved: 0,
                    errors: Vec::new(),
                    sync_duration_ms: start_time.elapsed().as_millis() as u64,
                })
            }
        }
    }
}

pub struct IncrementalSyncStrategy {
    #[allow(dead_code)]
    pub batch_size: usize,
    #[allow(dead_code)]
    pub retry_count: u32,
}

#[async_trait]
impl SyncStrategy for IncrementalSyncStrategy {
    async fn sync_table(
        &self,
        table_name: &str,
        remote: &dyn RemoteDataSource,
        local: &dyn LocalDataStore,
        _conflict_resolver: &dyn ConflictResolver,
    ) -> SyncResult<SyncSummary> {
        let start_time = Instant::now();
        let mut total_summary = SyncSummary {
            table_name: table_name.to_string(),
            remote_changes: 0,
            local_changes: 0,
            conflicts: 0,
            resolved: 0,
            errors: Vec::new(),
            sync_duration_ms: 0,
        };
        
        let last_sync = local.get_last_sync_time(table_name).await?;
        
        // Process remote changes in batches
        let mut offset = 0;
        loop {
            let batch_changes = remote.fetch_changes(table_name, last_sync, Some(self.batch_size), Some(offset)).await?;
            
            if batch_changes.is_empty() {
                break;
            }
            
            let operations: Vec<crate::sync::traits::SyncOperation> = batch_changes
                .into_iter()
                .map(|(entity, metadata)| crate::sync::traits::SyncOperation::Create {
                    data: entity,
                    metadata,
                })
                .collect();

            // Apply batch with retry
            let mut retry_count = 0;
            loop {
                match local.apply_changes(table_name, &operations).await {
                    Ok(_) => {
                        total_summary.remote_changes += operations.len();
                        break;
                    }
                    Err(_e) if retry_count < self.retry_count => {
                        retry_count += 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(100 * retry_count as u64)).await;
                        continue;
                    }
                    Err(e) => {
                        total_summary.errors.push(e.to_string());
                        break;
                    }
                }
            }
            
            offset += self.batch_size;
        }
        
        let duration = start_time.elapsed();
        total_summary.sync_duration_ms = duration.as_millis() as u64;
        
        Ok(total_summary)
    }
}
