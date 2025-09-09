use anyhow::Result;
use sqlx::{Transaction, Sqlite};
use serde_json::Value;
use super::comprehensive_sync::ComprehensiveSync;

impl ComprehensiveSync {
    /// Sync categories table
    pub async fn sync_categories(&self) -> Result<u32> {
        self.sync_table("categories", 1000).await
    }

    /// Sync classes table with borrowing limits
    pub async fn sync_classes(&self) -> Result<u32> {
        self.sync_table("classes", 1000).await
    }

    /// Sync books table
    pub async fn sync_books(&self) -> Result<u32> {
        self.sync_table("books", 1000).await
    }

    /// Sync students table
    pub async fn sync_students(&self) -> Result<u32> {
        self.sync_table("students", 2000).await
    }

    /// Sync staff table
    pub async fn sync_staff(&self) -> Result<u32> {
        self.sync_table("staff", 1000).await
    }

    /// Sync book_copies table
    pub async fn sync_book_copies(&self) -> Result<u32> {
        self.sync_table("book_copies", 5000).await
    }

    /// Sync borrowings table
    pub async fn sync_borrowings(&self) -> Result<u32> {
        self.sync_table("borrowings", 3000).await
    }

    /// Sync fines table
    pub async fn sync_fines(&self) -> Result<u32> {
        self.sync_table("fines", 2000).await
    }

    /// Sync fine_settings table
    pub async fn sync_fine_settings(&self) -> Result<u32> {
        self.sync_table("fine_settings", 100).await
    }

    /// Sync group_borrowings table
    pub async fn sync_group_borrowings(&self) -> Result<u32> {
        self.sync_table("group_borrowings", 1000).await
    }

    /// Sync theft_reports table
    pub async fn sync_theft_reports(&self) -> Result<u32> {
        self.sync_table("theft_reports", 1000).await
    }

    /// Sync notifications table
    pub async fn sync_notifications(&self) -> Result<u32> {
        self.sync_table("notifications", 2000).await
    }

    /// Sync profiles table
    pub async fn sync_profiles(&self) -> Result<u32> {
        self.sync_table("profiles", 1000).await
    }

    // Individual insert methods for each table type

    /// Insert category record
    pub async fn insert_category(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        // Use INSERT OR IGNORE to avoid UNIQUE constraint violations on name field
        let query = r#"
            INSERT OR IGNORE INTO categories (
                id, name, description, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["name"].as_str().unwrap_or("Unknown Category"))
            .bind(record["description"].as_str())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert class record with all borrowing-related fields
    pub async fn insert_class(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO classes (
                id, class_name, form_level, class_section, max_books_allowed, 
                is_active, academic_level_type, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["class_name"].as_str().unwrap_or("Unknown Class"))
            .bind(record["form_level"].as_i64().unwrap_or(1))
            .bind(record["class_section"].as_str())
            .bind(record["max_books_allowed"].as_i64().unwrap_or(2))
            .bind(if record["is_active"].as_bool().unwrap_or(true) { 1 } else { 0 })
            .bind(record["academic_level_type"].as_str().unwrap_or("form"))
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert book record
    pub async fn insert_book(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO books (
                id, title, author, isbn, genre, publisher, publication_year,
                total_copies, available_copies, shelf_location, cover_image_url,
                description, status, category_id, condition, book_code,
                acquisition_year, legacy_book_id, legacy_isbn, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["title"].as_str().unwrap_or("Unknown Title"))
            .bind(record["author"].as_str().unwrap_or("Unknown Author"))
            .bind(record["isbn"].as_str())
            .bind(record["genre"].as_str())
            .bind(record["publisher"].as_str())
            .bind(record["publication_year"].as_i64())
            .bind(record["total_copies"].as_i64().unwrap_or(1))
            .bind(record["available_copies"].as_i64().unwrap_or(1))
            .bind(record["shelf_location"].as_str())
            .bind(record["cover_image_url"].as_str())
            .bind(record["description"].as_str())
            .bind(record["status"].as_str().unwrap_or("available"))
            .bind(record["category_id"].as_str())
            .bind(record["condition"].as_str().unwrap_or("good"))
            .bind(record["book_code"].as_str())
            .bind(record["acquisition_year"].as_i64())
            .bind(record["legacy_book_id"].as_i64())
            .bind(record["legacy_isbn"].as_str())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert student record
    pub async fn insert_student(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO students (
                id, admission_number, first_name, last_name, email, phone,
                class_grade, address, date_of_birth, enrollment_date, status,
                class_id, academic_year, is_repeating, legacy_student_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["admission_number"].as_str().unwrap_or("Unknown"))
            .bind(record["first_name"].as_str().unwrap_or("Unknown"))
            .bind(record["last_name"].as_str().unwrap_or("Unknown"))
            .bind(record["email"].as_str())
            .bind(record["phone"].as_str())
            .bind(record["class_grade"].as_str().unwrap_or("Unknown"))
            .bind(record["address"].as_str())
            .bind(record["date_of_birth"].as_str())
            .bind(record["enrollment_date"].as_str())
            .bind(record["status"].as_str().unwrap_or("active"))
            .bind(record["class_id"].as_str())
            .bind(record["academic_year"].as_str().unwrap_or("2024/2025"))
            .bind(record["is_repeating"].as_bool().unwrap_or(false))
            .bind(record["legacy_student_id"].as_i64())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    /// Insert staff record
    pub async fn insert_staff(&self, record: &Value, tx: &mut Transaction<'_, Sqlite>) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO staff (
                id, staff_id, first_name, last_name, email, phone,
                department, position, status, legacy_staff_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        sqlx::query(query)
            .bind(record["id"].as_str().unwrap_or_default())
            .bind(record["staff_id"].as_str().unwrap_or("Unknown"))
            .bind(record["first_name"].as_str().unwrap_or("Unknown"))
            .bind(record["last_name"].as_str().unwrap_or("Unknown"))
            .bind(record["email"].as_str())
            .bind(record["phone"].as_str())
            .bind(record["department"].as_str())
            .bind(record["position"].as_str())
            .bind(record["status"].as_str().unwrap_or("active"))
            .bind(record["legacy_staff_id"].as_i64())
            .bind(record["created_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .bind(record["updated_at"].as_str().unwrap_or_else(|| "2024-01-01T00:00:00Z"))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }
}
