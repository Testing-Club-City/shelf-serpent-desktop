use async_trait::async_trait;
use serde_json::{json, Value};

use crate::sync::{
    error::{SyncError, SyncResult},
    traits::{ConflictResolutionStrategy, ConflictResolver, SyncConflict},
};

pub struct DefaultConflictResolver;

#[async_trait]
impl ConflictResolver for DefaultConflictResolver {
    async fn resolve(
        &self,
        conflict: &SyncConflict,
        strategy: ConflictResolutionStrategy,
    ) -> SyncResult<Value> {
        match strategy {
            ConflictResolutionStrategy::LocalWins => Ok(conflict.local.clone()),
            ConflictResolutionStrategy::RemoteWins => Ok(conflict.remote.clone()),
            ConflictResolutionStrategy::NewestWins => {
                if conflict.local_metadata.updated_at > conflict.remote_metadata.updated_at {
                    Ok(conflict.local.clone())
                } else {
                    Ok(conflict.remote.clone())
                }
            }
            ConflictResolutionStrategy::Merge => self.merge_values(conflict).await,
            ConflictResolutionStrategy::Manual => {
                Err(SyncError::Conflict("Manual resolution required".to_string()))
            }
        }
    }
}

impl DefaultConflictResolver {
    async fn merge_values(&self, conflict: &SyncConflict) -> SyncResult<Value> {
        let mut merged = json!({});
        
        // Get all fields from both local and remote
        let local_obj = conflict.local.as_object()
            .ok_or_else(|| SyncError::InvalidData("Local data must be an object".to_string()))?;
        let remote_obj = conflict.remote.as_object()
            .ok_or_else(|| SyncError::InvalidData("Remote data must be an object".to_string()))?;

        // Collect all unique keys
        let all_keys: std::collections::HashSet<_> = local_obj
            .keys()
            .chain(remote_obj.keys())
            .collect();

        for key in all_keys {
            let local_val = local_obj.get(key);
            let remote_val = remote_obj.get(key);

            match (local_val, remote_val) {
                (Some(local), Some(remote)) => {
                    // Both have the field - use smart merging
                    merged[key] = self.merge_field(local, remote, &conflict.local_metadata, &conflict.remote_metadata)?;
                }
                (Some(local), None) => {
                    // Only local has the field
                    merged[key] = local.clone();
                }
                (None, Some(remote)) => {
                    // Only remote has the field
                    merged[key] = remote.clone();
                }
                (None, None) => {
                    // Shouldn't happen, but handle gracefully
                    continue;
                }
            }
        }

        Ok(merged)
    }

    fn merge_field(
        &self,
        local: &Value,
        remote: &Value,
        local_meta: &crate::sync::traits::SyncMetadata,
        remote_meta: &crate::sync::traits::SyncMetadata,
    ) -> SyncResult<Value> {
        // For simple values, prefer the newer one
        if local == remote {
            return Ok(local.clone());
        }

        // For primitive types, use the newer timestamp
        if local.is_null() {
            return Ok(remote.clone());
        }
        if remote.is_null() {
            return Ok(local.clone());
        }

        // For arrays, concatenate and deduplicate
        if let (Some(local_arr), Some(remote_arr)) = (local.as_array(), remote.as_array()) {
            let mut combined = local_arr.clone();
            combined.extend_from_slice(remote_arr);
            
            // Simple deduplication for primitive values
            let mut seen = std::collections::HashSet::new();
            let deduped: Vec<Value> = combined
                .into_iter()
                .filter(|v| seen.insert(v.to_string()))
                .collect();
            
            return Ok(Value::Array(deduped));
        }

        // For objects, recursively merge
        if let (Some(local_obj), Some(remote_obj)) = (local.as_object(), remote.as_object()) {
            let mut merged = json!({});
            
            for key in local_obj.keys().chain(remote_obj.keys()) {
                match (local_obj.get(key), remote_obj.get(key)) {
                    (Some(local_val), Some(remote_val)) => {
                        merged[key] = self.merge_field(local_val, remote_val, local_meta, remote_meta)?;
                    }
                    (Some(local_val), None) => {
                        merged[key] = local_val.clone();
                    }
                    (None, Some(remote_val)) => {
                        merged[key] = remote_val.clone();
                    }
                    (None, None) => continue,
                }
            }
            
            return Ok(merged);
        }

        // For other types, prefer the newer timestamp
        if remote_meta.updated_at > local_meta.updated_at {
            Ok(remote.clone())
        } else {
            Ok(local.clone())
        }
    }
}

pub struct TimestampConflictResolver;

#[async_trait]
impl ConflictResolver for TimestampConflictResolver {
    async fn resolve(
        &self,
        conflict: &SyncConflict,
        _strategy: ConflictResolutionStrategy,
    ) -> SyncResult<Value> {
        // Always prefer the most recent update regardless of strategy
        if conflict.remote_metadata.updated_at > conflict.local_metadata.updated_at {
            Ok(conflict.remote.clone())
        } else {
            Ok(conflict.local.clone())
        }
    }
}

pub struct FieldLevelConflictResolver {
    pub field_strategies: std::collections::HashMap<String, ConflictResolutionStrategy>,
}

#[async_trait]
impl ConflictResolver for FieldLevelConflictResolver {
    async fn resolve(
        &self,
        conflict: &SyncConflict,
        default_strategy: ConflictResolutionStrategy,
    ) -> SyncResult<Value> {
        let mut resolved = json!({});
        
        let local_obj = conflict.local.as_object()
            .ok_or_else(|| SyncError::InvalidData("Local data must be an object".to_string()))?;
        let remote_obj = conflict.remote.as_object()
            .ok_or_else(|| SyncError::InvalidData("Remote data must be an object".to_string()))?;

        let all_keys: std::collections::HashSet<_> = local_obj
            .keys()
            .chain(remote_obj.keys())
            .collect();

        for key in all_keys {
            let strategy = self.field_strategies
                .get(key.as_str())
                .unwrap_or(&default_strategy);

            let local_val = local_obj.get(key);
            let remote_val = remote_obj.get(key);

            match (local_val, remote_val) {
                (Some(local), Some(remote)) => {
                    // Create a field-level conflict
                    let field_conflict = SyncConflict {
                        local: local.clone(),
                        remote: remote.clone(),
                        local_metadata: conflict.local_metadata.clone(),
                        remote_metadata: conflict.remote_metadata.clone(),
                    };
                    
                    let field_resolver = DefaultConflictResolver;
                    resolved[key] = field_resolver.resolve(&field_conflict, *strategy).await?;
                }
                (Some(local), None) => {
                    resolved[key] = local.clone();
                }
                (None, Some(remote)) => {
                    resolved[key] = remote.clone();
                }
                (None, None) => continue,
            }
        }

        Ok(resolved)
    }
}
