use crate::database::DatabaseManager;
use rusqlite::{Result, Row};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserSession {
    pub id: String,
    pub user_id: String,
    pub email: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub user_metadata: Option<String>,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub session_valid: bool,
    pub offline_expiry: DateTime<Utc>,
    pub device_fingerprint: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthCredentials {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub session: Option<UserSession>,
    pub error: Option<String>,
    pub is_offline: bool,
}

pub struct AuthManager {
    db: Arc<DatabaseManager>,
}

impl AuthManager {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }

    /// Store session in local database for offline access
    pub async fn store_session(&self, session: &UserSession) -> Result<()> {
        let conn = self.db.connection.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO user_sessions 
             (id, user_id, email, access_token, refresh_token, expires_at, user_metadata, role, 
              created_at, updated_at, last_activity, session_valid, offline_expiry, device_fingerprint)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            (
                &session.id,
                &session.user_id,
                &session.email,
                &session.access_token,
                &session.refresh_token,
                session.expires_at.to_rfc3339(),
                &session.user_metadata,
                &session.role,
                session.created_at.to_rfc3339(),
                session.updated_at.to_rfc3339(),
                session.last_activity.to_rfc3339(),
                session.session_valid,
                session.offline_expiry.to_rfc3339(),
                &session.device_fingerprint,
            ),
        )?;
        Ok(())
    }

    /// Get stored session for offline authentication
    pub async fn get_stored_session(&self, email: &str) -> Result<Option<UserSession>> {
        let conn = self.db.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, email, access_token, refresh_token, expires_at, user_metadata, 
                    role, created_at, updated_at, last_activity, session_valid, offline_expiry, device_fingerprint
             FROM user_sessions 
             WHERE email = ?1 AND session_valid = 1 AND offline_expiry > datetime('now')
             ORDER BY last_activity DESC LIMIT 1"
        )?;

        let session = stmt.query_row([email], |row| {
            self.row_to_session(row)
        }).optional()?;

        Ok(session)
    }

    /// Validate stored credentials for offline login
    pub async fn validate_offline_credentials(&self, credentials: &AuthCredentials) -> Result<Option<UserSession>> {
        // For now, we'll just check if we have a valid session stored
        // In a real implementation, you'd hash and compare passwords
        let session = self.get_stored_session(&credentials.email).await?;
        
        if let Some(mut session) = session {
            // Update last activity
            session.last_activity = Utc::now();
            self.update_session_activity(&session).await?;
            Ok(Some(session))
        } else {
            Ok(None)
        }
    }

    /// Update session activity timestamp
    pub async fn update_session_activity(&self, session: &UserSession) -> Result<()> {
        let conn = self.db.connection.lock().unwrap();
        conn.execute(
            "UPDATE user_sessions SET last_activity = ?1, updated_at = ?2 WHERE id = ?3",
            (
                session.last_activity.to_rfc3339(),
                Utc::now().to_rfc3339(),
                &session.id,
            ),
        )?;
        Ok(())
    }

    /// Invalidate session (logout)
    pub async fn invalidate_session(&self, session_id: &str) -> Result<()> {
        let conn = self.db.connection.lock().unwrap();
        conn.execute(
            "UPDATE user_sessions SET session_valid = 0, updated_at = ?1 WHERE id = ?2",
            (Utc::now().to_rfc3339(), session_id),
        )?;
        Ok(())
    }

    /// Clean up expired sessions
    pub async fn cleanup_expired_sessions(&self) -> Result<()> {
        let conn = self.db.connection.lock().unwrap();
        conn.execute(
            "DELETE FROM user_sessions WHERE offline_expiry < datetime('now')",
            [],
        )?;
        Ok(())
    }

    /// Create session from Supabase response
    pub fn create_session_from_supabase(
        &self,
        email: String,
        user_id: String,
        access_token: String,
        refresh_token: Option<String>,
        expires_in: i64,
        user_metadata: Option<String>,
    ) -> UserSession {
        let now = Utc::now();
        let expires_at = now + Duration::seconds(expires_in);
        // Offline sessions are valid for 30 days
        let offline_expiry = now + Duration::days(30);

        UserSession {
            id: Uuid::new_v4().to_string(),
            user_id,
            email,
            access_token,
            refresh_token,
            expires_at,
            user_metadata,
            role: "user".to_string(),
            created_at: now,
            updated_at: now,
            last_activity: now,
            session_valid: true,
            offline_expiry,
            device_fingerprint: None,
        }
    }

    /// Convert database row to UserSession
    fn row_to_session(&self, row: &Row) -> rusqlite::Result<UserSession> {
        let expires_str: String = row.get(5)?;
        let created_str: String = row.get(8)?;
        let updated_str: String = row.get(9)?;
        let activity_str: String = row.get(10)?;
        let offline_expiry_str: String = row.get(12)?;
        let session_valid: i32 = row.get(11)?;

        Ok(UserSession {
            id: row.get(0)?,
            user_id: row.get(1)?,
            email: row.get(2)?,
            access_token: row.get(3)?,
            refresh_token: row.get(4)?,
            expires_at: DateTime::parse_from_rfc3339(&expires_str).unwrap().with_timezone(&Utc),
            user_metadata: row.get(6)?,
            role: row.get(7)?,
            created_at: DateTime::parse_from_rfc3339(&created_str).unwrap().with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(&updated_str).unwrap().with_timezone(&Utc),
            last_activity: DateTime::parse_from_rfc3339(&activity_str).unwrap().with_timezone(&Utc),
            session_valid: session_valid == 1,
            offline_expiry: DateTime::parse_from_rfc3339(&offline_expiry_str).unwrap().with_timezone(&Utc),
            device_fingerprint: row.get(13)?,
        })
    }
}
