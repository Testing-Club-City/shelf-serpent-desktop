use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Log level for activity logs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    #[serde(rename = "trace")]
    Trace,
    #[serde(rename = "debug")]
    Debug,
    #[serde(rename = "info")]
    Info,
    #[serde(rename = "warn")]
    Warning,
    #[serde(rename = "error")]
    Error,
    #[serde(rename = "critical")]
    Critical,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Trace => write!(f, "TRACE"),
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Warning => write!(f, "WARN"),
            LogLevel::Error => write!(f, "ERROR"),
            LogLevel::Critical => write!(f, "CRITICAL"),
        }
    }
}

/// Activity log entry structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityLogEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub category: String,
    pub action: String,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub user_id: Option<String>,
    pub user_email: Option<String>,
    pub session_id: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub details: Option<serde_json::Value>,
    pub duration_ms: Option<u64>,
    pub error_message: Option<String>,
    pub stack_trace: Option<String>,
    pub source_file: Option<String>,
    pub source_line: Option<u32>,
}

impl ActivityLogEntry {
    /// Create a new activity log entry
    pub fn new(level: LogLevel, category: String, action: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            level,
            category,
            action,
            resource_type: None,
            resource_id: None,
            user_id: None,
            user_email: None,
            session_id: None,
            ip_address: None,
            user_agent: None,
            details: None,
            duration_ms: None,
            error_message: None,
            stack_trace: None,
            source_file: None,
            source_line: None,
        }
    }

    /// Builder pattern methods for setting optional fields
    #[allow(dead_code)]
    pub fn with_resource(mut self, resource_type: String, resource_id: Option<String>) -> Self {
        self.resource_type = Some(resource_type);
        self.resource_id = resource_id;
        self
    }

    #[allow(dead_code)]
    pub fn with_user(mut self, user_id: String, user_email: Option<String>) -> Self {
        self.user_id = Some(user_id);
        self.user_email = user_email;
        self
    }

    #[allow(dead_code)]
    pub fn with_session(mut self, session_id: String) -> Self {
        self.session_id = Some(session_id);
        self
    }

    #[allow(dead_code)]
    pub fn with_network_info(mut self, ip_address: Option<String>, user_agent: Option<String>) -> Self {
        self.ip_address = ip_address;
        self.user_agent = user_agent;
        self
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    pub fn with_error(mut self, error_message: String, stack_trace: Option<String>) -> Self {
        self.error_message = Some(error_message);
        self.stack_trace = stack_trace;
        self
    }

    #[allow(dead_code)]
    pub fn with_source_location(mut self, file: String, line: u32) -> Self {
        self.source_file = Some(file);
        self.source_line = Some(line);
        self
    }
}

/// Activity logger that writes to both console and file
pub struct ActivityLogger {
    pub log_file_path: PathBuf,
    file_mutex: Mutex<()>,
    max_file_size: u64,
    max_backup_files: u32,
}

impl ActivityLogger {
    /// Create a new activity logger
    pub fn new(log_directory: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        // Ensure log directory exists
        std::fs::create_dir_all(&log_directory)?;
        
        let log_file_path = log_directory.join("activity.log");
        
        Ok(Self {
            log_file_path,
            file_mutex: Mutex::new(()),
            max_file_size: 10 * 1024 * 1024, // 10MB
            max_backup_files: 5,
        })
    }

    /// Log an activity entry
    pub fn log(&self, entry: &ActivityLogEntry) {
        // Log to console/tracing first
        let formatted_message = self.format_log_entry(entry);
        
        match entry.level {
            LogLevel::Trace => tracing::trace!("{}", formatted_message),
            LogLevel::Debug => tracing::debug!("{}", formatted_message),
            LogLevel::Info => info!("{}", formatted_message),
            LogLevel::Warning => warn!("{}", formatted_message),
            LogLevel::Error | LogLevel::Critical => error!("{}", formatted_message),
        }

        // Write to file
        if let Err(e) = self.write_to_file(entry) {
            error!("Failed to write activity log to file: {}", e);
        }
    }

    /// Format log entry for human-readable output
    fn format_log_entry(&self, entry: &ActivityLogEntry) -> String {
        let mut parts = vec![
            format!("[{}]", entry.level),
            format!("[{}]", entry.category),
            entry.action.clone(),
        ];

        if let Some(resource_type) = &entry.resource_type {
            if let Some(resource_id) = &entry.resource_id {
                parts.push(format!("{}:{}", resource_type, resource_id));
            } else {
                parts.push(resource_type.clone());
            }
        }

        if let Some(user_email) = &entry.user_email {
            parts.push(format!("user:{}", user_email));
        } else if let Some(user_id) = &entry.user_id {
            parts.push(format!("user_id:{}", user_id));
        }

        if let Some(duration) = entry.duration_ms {
            parts.push(format!("{}ms", duration));
        }

        if let Some(error) = &entry.error_message {
            parts.push(format!("error:{}", error));
        }

        parts.join(" | ")
    }

    /// Write log entry to file as JSON
    fn write_to_file(&self, entry: &ActivityLogEntry) -> Result<(), Box<dyn std::error::Error>> {
        let _lock = self.file_mutex.lock().unwrap();

        // Check if file rotation is needed
        self.rotate_log_if_needed()?;

        // Open file in append mode
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_file_path)?;

        // Write JSON entry with newline
        let json_line = serde_json::to_string(entry)?;
        writeln!(file, "{}", json_line)?;
        file.flush()?;

        Ok(())
    }

    /// Rotate log file if it exceeds max size
    fn rotate_log_if_needed(&self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.log_file_path.exists() {
            return Ok(());
        }

        let metadata = std::fs::metadata(&self.log_file_path)?;
        if metadata.len() <= self.max_file_size {
            return Ok(());
        }

        // Rotate existing backup files
        for i in (1..self.max_backup_files).rev() {
            let old_backup = self.log_file_path.with_extension(format!("log.{}", i));
            let new_backup = self.log_file_path.with_extension(format!("log.{}", i + 1));
            
            if old_backup.exists() {
                if new_backup.exists() {
                    std::fs::remove_file(&new_backup)?;
                }
                std::fs::rename(&old_backup, &new_backup)?;
            }
        }

        // Move current log to .1 backup
        let first_backup = self.log_file_path.with_extension("log.1");
        if first_backup.exists() {
            std::fs::remove_file(&first_backup)?;
        }
        std::fs::rename(&self.log_file_path, &first_backup)?;

        info!("Rotated activity log file. New backup: {:?}", first_backup);
        Ok(())
    }

    /// Read log entries from file (for log viewer functionality)
    #[allow(dead_code)]
    pub fn read_logs(&self, limit: Option<usize>) -> Result<Vec<ActivityLogEntry>, Box<dyn std::error::Error>> {
        if !self.log_file_path.exists() {
            return Ok(vec![]);
        }

        let content = std::fs::read_to_string(&self.log_file_path)?;
        let mut entries = Vec::new();

        for line in content.lines() {
            if line.trim().is_empty() {
                continue;
            }
            
            match serde_json::from_str::<ActivityLogEntry>(line) {
                Ok(entry) => entries.push(entry),
                Err(e) => {
                    warn!("Failed to parse log entry: {} - Line: {}", e, line);
                }
            }
        }

        // Sort by timestamp (newest first)
        entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        // Apply limit if specified
        if let Some(limit) = limit {
            entries.truncate(limit);
        }

        Ok(entries)
    }

    /// Get log file statistics
    #[allow(dead_code)]
    pub fn get_log_stats(&self) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        let mut stats = serde_json::json!({
            "log_file_path": self.log_file_path,
            "file_exists": self.log_file_path.exists(),
            "backup_files": []
        });

        if self.log_file_path.exists() {
            let metadata = std::fs::metadata(&self.log_file_path)?;
            stats["file_size_bytes"] = serde_json::Value::Number(metadata.len().into());
            let size_mb = metadata.len() as f64 / 1024.0 / 1024.0;
            stats["file_size_mb"] = serde_json::Value::Number(
                serde_json::Number::from_f64(size_mb).unwrap_or_else(|| serde_json::Number::from(0))
            );
        }

        // Check for backup files
        let mut backup_files = Vec::new();
        for i in 1..=self.max_backup_files {
            let backup_path = self.log_file_path.with_extension(format!("log.{}", i));
            if backup_path.exists() {
                if let Ok(metadata) = std::fs::metadata(&backup_path) {
                    let size_mb = metadata.len() as f64 / 1024.0 / 1024.0;
                    backup_files.push(serde_json::json!({
                        "path": backup_path,
                        "size_bytes": metadata.len(),
                        "size_mb": size_mb
                    }));
                }
            }
        }
        stats["backup_files"] = serde_json::Value::Array(backup_files);

        Ok(stats)
    }
}

/// Convenience macros for logging common activities
#[macro_export]
macro_rules! log_activity {
    ($logger:expr, $level:expr, $category:expr, $action:expr) => {
        $logger.log(&crate::logging::ActivityLogEntry::new($level, $category.to_string(), $action.to_string()));
    };
    ($logger:expr, $level:expr, $category:expr, $action:expr, $($key:ident: $value:expr),+) => {
        {
            let mut entry = crate::logging::ActivityLogEntry::new($level, $category.to_string(), $action.to_string());
            $(
                entry = match stringify!($key) {
                    "resource_type" => entry.with_resource($value.to_string(), None),
                    "resource_id" => {
                        if let Some(rt) = entry.resource_type.clone() {
                            entry.with_resource(rt, Some($value.to_string()))
                        } else {
                            entry.with_resource("unknown".to_string(), Some($value.to_string()))
                        }
                    },
                    "user_id" => entry.with_user($value.to_string(), None),
                    "user_email" => {
                        if let Some(uid) = entry.user_id.clone() {
                            entry.with_user(uid, Some($value.to_string()))
                        } else {
                            entry.with_user("unknown".to_string(), Some($value.to_string()))
                        }
                    },
                    "details" => entry.with_details($value),
                    "duration_ms" => entry.with_duration($value),
                    "error" => entry.with_error($value.to_string(), None),
                    _ => entry,
                };
            )+
            $logger.log(&entry);
        }
    };
}

#[macro_export]
macro_rules! log_info {
    ($logger:expr, $category:expr, $action:expr) => {
        log_activity!($logger, crate::logging::LogLevel::Info, $category, $action);
    };
    ($logger:expr, $category:expr, $action:expr, $($key:ident: $value:expr),+) => {
        log_activity!($logger, crate::logging::LogLevel::Info, $category, $action, $($key: $value),+);
    };
}

#[macro_export]
macro_rules! log_error {
    ($logger:expr, $category:expr, $action:expr, $error:expr) => {
        log_activity!($logger, crate::logging::LogLevel::Error, $category, $action, error: $error);
    };
}

#[macro_export]
macro_rules! log_warn {
    ($logger:expr, $category:expr, $action:expr) => {
        log_activity!($logger, crate::logging::LogLevel::Warning, $category, $action);
    };
    ($logger:expr, $category:expr, $action:expr, $($key:ident: $value:expr),+) => {
        log_activity!($logger, crate::logging::LogLevel::Warning, $category, $action, $($key: $value),+);
    };
}
