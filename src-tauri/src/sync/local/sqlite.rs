use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{Pool, Sqlite};

use crate::sync::{
    error::{SyncError, SyncResult},
    traits::{ConflictResolutionStrategy, LocalDataStore, SyncConflict, SyncMetadata, SyncOperation},
};

pub struct SqliteLocalDataStore {
    pool: Pool<Sqlite>,
}

impl SqliteLocalDataStore {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    async fn ensure_sync_table_exists(&self) -> SyncResult<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sync_metadata (
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                last_sync_at DATETIME,
                local_version INTEGER DEFAULT 1,
                remote_version INTEGER DEFAULT 1,
                is_deleted BOOLEAN DEFAULT FALSE,
                PRIMARY KEY (table_name, record_id)
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| SyncError::Database(e))?;

        Ok(())
    }
}

#[async_trait]
impl LocalDataStore for SqliteLocalDataStore {
    async fn get_changes(
        &self,
        table_name: &str,
        since: Option<DateTime<Utc>>,
    ) -> SyncResult<Vec<SyncOperation>> {
        self.ensure_sync_table_exists().await?;

        let query = match since {
            Some(_since_time) => format!(
                r#"
                SELECT sm.record_id, sm.local_version, sm.remote_version, sm.is_deleted,
                       t.*
                FROM sync_metadata sm
                JOIN {} t ON t.id = sm.record_id
                WHERE sm.table_name = ? AND sm.last_sync_at > ?
                ORDER BY sm.last_sync_at ASC
                "#,
                table_name
            ),
            None => format!(
                r#"
                SELECT sm.record_id, sm.local_version, sm.remote_version, sm.is_deleted,
                       t.*
                FROM sync_metadata sm
                JOIN {} t ON t.id = sm.record_id
                WHERE sm.table_name = ? AND sm.local_version > sm.remote_version
                ORDER BY sm.last_sync_at ASC
                "#,
                table_name
            ),
        };

        let rows = match since {
            Some(since_time) => {
                sqlx::query_as::<_, (String, i64, i64, bool, Value)>(&query)
                    .bind(table_name)
                    .bind(since_time)
                    .fetch_all(&self.pool)
                    .await
            }
            None => {
                sqlx::query_as::<_, (String, i64, i64, bool, Value)>(&query)
                    .bind(table_name)
                    .fetch_all(&self.pool)
                    .await
            }
        }
        .map_err(|e| SyncError::Database(e))?;

        let mut changes = Vec::new();
        for (record_id, local_version, remote_version, is_deleted, data) in rows {
            let metadata = SyncMetadata {
                id: record_id.clone(),
                created_at: data["created_at"]
                    .as_str()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(Utc::now),
                updated_at: data["updated_at"]
                    .as_str()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(Utc::now),
                deleted_at: if is_deleted {
                    Some(Utc::now())
                } else {
                    None
                },
                version: local_version,
            };

            let operation = if is_deleted {
                SyncOperation::Delete {
                    id: record_id,
                    metadata,
                }
            } else if remote_version == 0 {
                SyncOperation::Create { data, metadata }
            } else {
                SyncOperation::Update { data, metadata }
            };

            changes.push(operation);
        }

        Ok(changes)
    }

    async fn apply_changes(
        &self,
        table_name: &str,
        changes: &[SyncOperation],
    ) -> SyncResult<()> {
        self.ensure_sync_table_exists().await?;

        for change in changes {
            match change {
                SyncOperation::Create { data, metadata } => {
                    let id = &metadata.id;
                    
                    // Insert into main table
                    let columns: Vec<String> = data
                        .as_object()
                        .ok_or_else(|| SyncError::InvalidData("Invalid data format".to_string()))?
                        .keys()
                        .cloned()
                        .collect();
                    
                    let placeholders: Vec<String> = columns.iter()
                        .map(|_| "?".to_string())
                        .collect();
                    
                    let query = format!(
                        "INSERT INTO {} ({}) VALUES ({})",
                        table_name,
                        columns.join(", "),
                        placeholders.join(", ")
                    );

                    let mut query = sqlx::query(&query);
                    for column in &columns {
                        if let Some(value) = data.get(column) {
                            query = query.bind(value.to_string());
                        }
                    }

                    query.execute(&self.pool).await.map_err(|e| SyncError::Database(e))?;

                    // Update sync metadata
                    sqlx::query(
                        r#"
                        INSERT OR REPLACE INTO sync_metadata (table_name, record_id, last_sync_at, remote_version, local_version)
                        VALUES (?, ?, ?, ?, ?)
                        "#,
                    )
                    .bind(table_name)
                    .bind(id)
                    .bind(metadata.updated_at)
                    .bind(metadata.version)
                    .bind(metadata.version)
                    .execute(&self.pool)
                    .await
                    .map_err(|e| SyncError::Database(e))?;
                }
                SyncOperation::Update { data, metadata } => {
                    let id = &metadata.id;
                    
                    // Update main table
                    let columns: Vec<String> = data
                        .as_object()
                        .ok_or_else(|| SyncError::InvalidData("Invalid data format".to_string()))?
                        .keys()
                        .filter(|k| *k != "id")
                        .cloned()
                        .collect();
                    
                    let set_clause: Vec<String> = columns.iter()
                        .map(|c| format!("{} = ?", c))
                        .collect();
                    
                    let query = format!(
                        "UPDATE {} SET {} WHERE id = ?",
                        table_name,
                        set_clause.join(", ")
                    );

                    let mut query = sqlx::query(&query);
                    for column in &columns {
                        if let Some(value) = data.get(column) {
                            query = query.bind(value.to_string());
                        }
                    }
                    query = query.bind(id);

                    query.execute(&self.pool).await.map_err(|e| SyncError::Database(e))?;

                    // Update sync metadata
                    sqlx::query(
                        r#"
                        UPDATE sync_metadata 
                        SET last_sync_at = ?, remote_version = ?
                        WHERE table_name = ? AND record_id = ?
                        "#,
                    )
                    .bind(metadata.updated_at)
                    .bind(metadata.version)
                    .bind(table_name)
                    .bind(id)
                    .execute(&self.pool)
                    .await
                    .map_err(|e| SyncError::Database(e))?;
                }
                SyncOperation::Delete { id, metadata } => {
                    // Soft delete from main table
                    sqlx::query(&format!("UPDATE {} SET deleted_at = ? WHERE id = ?", table_name))
                        .bind(metadata.deleted_at)
                        .bind(id)
                        .execute(&self.pool)
                        .await
                        .map_err(|e| SyncError::Database(e))?;

                    // Update sync metadata
                    sqlx::query(
                        r#"
                        UPDATE sync_metadata 
                        SET last_sync_at = ?, is_deleted = TRUE
                        WHERE table_name = ? AND record_id = ?
                        "#,
                    )
                    .bind(metadata.deleted_at)
                    .bind(table_name)
                    .bind(id)
                    .execute(&self.pool)
                    .await
                    .map_err(|e| SyncError::Database(e))?;
                }
            }
        }

        Ok(())
    }

    async fn get_last_sync_time(&self, table_name: &str) -> SyncResult<Option<DateTime<Utc>>> {
        self.ensure_sync_table_exists().await?;

        let result = sqlx::query_scalar::<_, Option<String>>(
            "SELECT MAX(last_sync_at) FROM sync_metadata WHERE table_name = ?",
        )
        .bind(table_name)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| SyncError::Database(e))?;

        match result {
            Some(timestamp) => DateTime::parse_from_rfc3339(&timestamp)
                .map(|dt| Some(dt.with_timezone(&Utc)))
                .map_err(|e| SyncError::InvalidData(e.to_string())),
            None => Ok(None),
        }
    }

    async fn set_last_sync_time(
        &self,
        table_name: &str,
        time: DateTime<Utc>,
    ) -> SyncResult<()> {
        self.ensure_sync_table_exists().await?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO sync_metadata (table_name, record_id, last_sync_at)
            VALUES (?, '_sync_marker_', ?)
            "#,
        )
        .bind(table_name)
        .bind(time)
        .execute(&self.pool)
        .await
        .map_err(|e| SyncError::Database(e))?;

        Ok(())
    }

    async fn resolve_conflicts(
        &self,
        conflicts: &[SyncConflict],
        strategy: ConflictResolutionStrategy,
    ) -> SyncResult<Vec<Value>> {
        let mut resolved = Vec::new();

        for conflict in conflicts {
            let resolved_data = match strategy {
                ConflictResolutionStrategy::LocalWins => conflict.local.clone(),
                ConflictResolutionStrategy::RemoteWins => conflict.remote.clone(),
                ConflictResolutionStrategy::NewestWins => {
                    if conflict.local_metadata.updated_at > conflict.remote_metadata.updated_at {
                        conflict.local.clone()
                    } else {
                        conflict.remote.clone()
                    }
                }
                ConflictResolutionStrategy::Merge => {
                    // Simple merge strategy: prefer remote for non-null fields
                    let mut merged = conflict.local.clone();
                    if let Some(remote_obj) = conflict.remote.as_object() {
                        for (key, value) in remote_obj {
                            if !value.is_null() {
                                merged[key] = value.clone();
                            }
                        }
                    }
                    merged
                }
                ConflictResolutionStrategy::Manual => {
                    return Err(SyncError::Conflict(
                        "Manual conflict resolution required".to_string(),
                    ))
                }
            };

            resolved.push(resolved_data);
        }

        Ok(resolved)
    }
}
