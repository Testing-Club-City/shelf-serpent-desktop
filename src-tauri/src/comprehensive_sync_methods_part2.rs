use anyhow::Result;
use sqlx::{Transaction, Sqlite};
use serde_json::Value;
use super::comprehensive_sync::ComprehensiveSync;

impl ComprehensiveSync {
    /// Insert book_copy record
    pub async fn insert_book_copy(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO book_copies (
                id, book_id, copy_number, book_code, condition, status,
                tracking_code, notes, legacy_book_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["book_id"].as_str())
            .bind(record["copy_number"].as_i64().unwrap_or(1))
            .bind(record["book_code"].as_str().unwrap_or("Unknown"))
            .bind(record["condition"].as_str().unwrap_or("good"))
            .bind(record["status"].as_str().unwrap_or("available"))
            .bind(record["tracking_code"].as_str())
            .bind(record["notes"].as_str())
            .bind(record["legacy_book_id"].as_i64())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert borrowing record
    pub async fn insert_borrowing(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO borrowings (
                id, student_id, book_id, borrowed_date, due_date, returned_date,
                status, fine_amount, notes, issued_by, returned_by, fine_paid,
                book_copy_id, condition_at_issue, condition_at_return, is_lost,
                tracking_code, return_notes, copy_condition, group_borrowing_id,
                borrower_type, staff_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["student_id"].as_str())
            .bind(record["book_id"].as_str())
            .bind(record["borrowed_date"].as_str())
            .bind(record["due_date"].as_str())
            .bind(record["returned_date"].as_str())
            .bind(record["status"].as_str().unwrap_or("active"))
            .bind(record["fine_amount"].as_f64().unwrap_or(0.0))
            .bind(record["notes"].as_str())
            .bind(record["issued_by"].as_str())
            .bind(record["returned_by"].as_str())
            .bind(if record["fine_paid"].as_bool().unwrap_or(false) { 1 } else { 0 })
            .bind(record["book_copy_id"].as_str())
            .bind(record["condition_at_issue"].as_str().unwrap_or("good"))
            .bind(record["condition_at_return"].as_str())
            .bind(if record["is_lost"].as_bool().unwrap_or(false) { 1 } else { 0 })
            .bind(record["tracking_code"].as_str())
            .bind(record["return_notes"].as_str())
            .bind(record["copy_condition"].as_str())
            .bind(record["group_borrowing_id"].as_str())
            .bind(record["borrower_type"].as_str().unwrap_or("student"))
            .bind(record["staff_id"].as_str())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert fine record
    pub async fn insert_fine(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO fines (
                id, student_id, borrowing_id, fine_type, amount, description,
                status, created_by, borrower_type, staff_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["student_id"].as_str())
            .bind(record["borrowing_id"].as_str())
            .bind(record["fine_type"].as_str().unwrap_or("overdue"))
            .bind(record["amount"].as_f64().unwrap_or(0.0))
            .bind(record["description"].as_str())
            .bind(record["status"].as_str().unwrap_or("unpaid"))
            .bind(record["created_by"].as_str())
            .bind(record["borrower_type"].as_str().unwrap_or("student"))
            .bind(record["staff_id"].as_str())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert fine_setting record
    pub async fn insert_fine_setting(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        // Define allowed fine types
        let allowed_fine_types = [
            "overdue", "damaged", "lost_book", "stolen_book", "theft_victim",
            "condition_poor", "condition_fair", "condition_excellent", "condition_good",
            "late_return", "replacement_cost", "processing_fee"
        ];
        
        // Get fine_type from record and validate it
        let fine_type = record["fine_type"].as_str().unwrap_or("overdue");
        
        // Skip records with invalid fine_types
        if !allowed_fine_types.contains(&fine_type) {
            println!("⚠️ Skipping fine_setting with invalid fine_type: {}", fine_type);
            return Ok(());
        }
        
        let query = r#"
            INSERT OR REPLACE INTO fine_settings (
                id, fine_type, amount, description, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(fine_type)
            .bind(record["amount"].as_f64().unwrap_or(0.0))
            .bind(record["description"].as_str())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert group_borrowing record
    pub async fn insert_group_borrowing(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO group_borrowings (
                id, book_id, book_copy_id, tracking_code, borrowed_date, due_date,
                returned_date, condition_at_issue, condition_at_return, fine_amount,
                fine_paid, notes, return_notes, status, is_lost, student_count,
                issued_by, returned_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["book_id"].as_str())
            .bind(record["book_copy_id"].as_str())
            .bind(record["tracking_code"].as_str())
            .bind(record["borrowed_date"].as_str())
            .bind(record["due_date"].as_str())
            .bind(record["returned_date"].as_str())
            .bind(record["condition_at_issue"].as_str().unwrap_or("good"))
            .bind(record["condition_at_return"].as_str())
            .bind(record["fine_amount"].as_f64().unwrap_or(0.0))
            .bind(if record["fine_paid"].as_bool().unwrap_or(false) { 1 } else { 0 })
            .bind(record["notes"].as_str())
            .bind(record["return_notes"].as_str())
            .bind(record["status"].as_str().unwrap_or("active"))
            .bind(if record["is_lost"].as_bool().unwrap_or(false) { 1 } else { 0 })
            .bind(record["student_count"].as_i64().unwrap_or(1))
            .bind(record["issued_by"].as_str())
            .bind(record["returned_by"].as_str())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert theft_report record
    pub async fn insert_theft_report(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO theft_reports (
                id, student_id, book_id, book_copy_id, borrowing_id,
                expected_tracking_code, returned_tracking_code, theft_reason,
                reported_date, reported_by, status, investigation_notes,
                resolved_date, resolved_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["student_id"].as_str())
            .bind(record["book_id"].as_str())
            .bind(record["book_copy_id"].as_str())
            .bind(record["borrowing_id"].as_str())
            .bind(record["expected_tracking_code"].as_str())
            .bind(record["returned_tracking_code"].as_str())
            .bind(record["theft_reason"].as_str())
            .bind(record["reported_date"].as_str())
            .bind(record["reported_by"].as_str())
            .bind(record["status"].as_str().unwrap_or("reported"))
            .bind(record["investigation_notes"].as_str())
            .bind(record["resolved_date"].as_str())
            .bind(record["resolved_by"].as_str())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert notification record
    pub async fn insert_notification(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        // First check if notifications table exists, if not create it
        let create_table_query = r#"
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                read INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                synced INTEGER DEFAULT 0,
                sync_version INTEGER DEFAULT 1,
                deleted INTEGER DEFAULT 0
            )
        "#;
        
        sqlx::query(create_table_query)
            .execute(&mut **tx)
            .await?;

        let query = r#"
            INSERT OR REPLACE INTO notifications (
                id, user_id, title, message, type, read, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["user_id"].as_str())
            .bind(record["title"].as_str().unwrap_or("Notification"))
            .bind(record["message"].as_str().unwrap_or(""))
            .bind(record["type"].as_str().unwrap_or("info"))
            .bind(if record["read"].as_bool().unwrap_or(false) { 1 } else { 0 })
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert profile record
    pub async fn insert_profile(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        // First check if profiles table exists, if not create it
        let create_table_query = r#"
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                first_name TEXT,
                last_name TEXT,
                phone TEXT,
                suspended INTEGER DEFAULT 0,
                is_online INTEGER DEFAULT 0,
                last_seen TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                synced INTEGER DEFAULT 0,
                sync_version INTEGER DEFAULT 1,
                deleted INTEGER DEFAULT 0
            )
        "#;
        
        sqlx::query(create_table_query)
            .execute(&mut **tx)
            .await?;

        let query = r#"
            INSERT OR REPLACE INTO profiles (
                id, email, role, first_name, last_name, phone, suspended,
                is_online, last_seen, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["email"].as_str().unwrap_or(""))
            .bind(record["role"].as_str().unwrap_or("user"))
            .bind(record["first_name"].as_str())
            .bind(record["last_name"].as_str())
            .bind(record["phone"].as_str())
            .bind(if record["suspended"].as_bool().unwrap_or(false) { 1 } else { 0 })
            .bind(if record["is_online"].as_bool().unwrap_or(false) { 1 } else { 0 })
            .bind(record["last_seen"].as_str())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }
}
