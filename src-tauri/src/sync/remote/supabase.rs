use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::{Client, header};
use serde_json::Value;

use crate::sync::{
    error::{SyncError, SyncResult},
    traits::{RemoteDataSource, SyncMetadata, SyncOperation},
};

#[derive(Debug, Clone)]
pub struct SupabaseConfig {
    pub url: String,
    pub anon_key: String,
    pub batch_size: usize,
}

pub struct SupabaseRemoteDataSource {
    client: Client,
    config: SupabaseConfig,
}

impl SupabaseRemoteDataSource {
    pub fn new(config: SupabaseConfig) -> SyncResult<Self> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .connect_timeout(std::time::Duration::from_secs(10))
            .default_headers({
                let mut headers = header::HeaderMap::new();
                headers.insert(header::AUTHORIZATION, format!("Bearer {}", config.anon_key).parse().unwrap());
                headers.insert(header::ACCEPT, "application/json".parse().unwrap());
                headers.insert(header::CONTENT_TYPE, "application/json".parse().unwrap());
                headers
            })
            .build()
            .map_err(|e| SyncError::Network(e))?;

        Ok(Self { client, config })
    }


}

#[async_trait]
impl RemoteDataSource for SupabaseRemoteDataSource {
    async fn fetch_changes(
        &self,
        table_name: &str,
        since: Option<DateTime<Utc>>,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> SyncResult<Vec<(Value, SyncMetadata)>> {
        let limit_val = limit.unwrap_or(self.config.batch_size);
        let mut url = if let Some(since) = since {
            format!("{}/rest/v1/{}?select=*&order=updated_at.asc&updated_at=gte.{}&limit={}", 
                self.config.url, table_name, since.to_rfc3339(), limit_val)
        } else {
            format!("{}/rest/v1/{}?select=*&order=updated_at.asc&limit={}", 
                self.config.url, table_name, limit_val)
        };
        
        if let Some(offset_val) = offset {
            url = format!("{}&offset={}", url, offset_val);
        };

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| SyncError::Network(e))?;

        if !response.status().is_success() {
            return Err(SyncError::InvalidData(format!("Failed to fetch changes: {}", response.status())));
        }

        let data: Vec<Value> = response
            .json()
            .await
            .map_err(|e| SyncError::Network(e))?;

        let mut results = Vec::new();
        for item in data {
            let metadata = SyncMetadata {
                id: item.get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or_else(|| item.get("uuid")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown"))
                    .to_string(),
                created_at: item.get("created_at")
                    .and_then(|v| v.as_str())
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(Utc::now),
                updated_at: item.get("updated_at")
                    .and_then(|v| v.as_str())
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(Utc::now),
                deleted_at: item.get("deleted_at")
                    .and_then(|v| v.as_str())
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc)),
                version: item.get("version")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(1),
            };

            results.push((item, metadata));
        }

        Ok(results)
    }

    async fn push_changes(
        &self,
        table_name: &str,
        changes: &[SyncOperation],
    ) -> SyncResult<Vec<SyncMetadata>> {
        let mut results = Vec::new();

        for change in changes {
            let (data, metadata) = match change {
                SyncOperation::Create { data, metadata } => (data, metadata),
                SyncOperation::Update { data, metadata } => (data, metadata),
                SyncOperation::Delete { id, metadata } => {
                    // Handle deletion
                    let url = format!("{}/rest/v1/{}?id=eq.{}", 
                        self.config.url, table_name, id);
                    
                    let response = self.client
                        .delete(&url)
                        .send()
                        .await
                        .map_err(|e| SyncError::Network(e))?;

                    if response.status().is_success() {
                        results.push(metadata.clone());
                    }
                    continue;
                }
            };

            let url = format!("{}/rest/v1/{}?on_conflict=id", 
                self.config.url, table_name);

            let response = self.client
                .post(&url)
                .json(data)
                .send()
                .await
                .map_err(|e| SyncError::Network(e))?;

            if response.status().is_success() {
                results.push(metadata.clone());
            }
        }

        Ok(results)
    }

    async fn check_connectivity(&self) -> bool {
        let url = format!("{}/rest/v1/", self.config.url);
        match self.client.head(&url).send().await {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }
}
