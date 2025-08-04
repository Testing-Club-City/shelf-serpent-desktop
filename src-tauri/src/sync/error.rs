use thiserror::Error;

#[derive(Error, Debug)]
pub enum SyncError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[allow(dead_code)]
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("Conflict resolution failed: {0}")]
    Conflict(String),
    
    #[error("Invalid data: {0}")]
    InvalidData(String),
    
    #[allow(dead_code)]
    #[error("Rate limit exceeded")]
    RateLimit,
    
    #[allow(dead_code)]
    #[error("Operation timeout")]
    Timeout,
    
    #[error("Sync already in progress")]
    #[allow(dead_code)]
    SyncInProgress,
    
    #[error("Configuration error: {0}")]
    Config(String),
}

pub type SyncResult<T> = Result<T, SyncError>;
