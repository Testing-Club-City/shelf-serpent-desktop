use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::models::{Borrowing, BorrowingStatus, BorrowerType};

/// Simplified struct for creating borrowings from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BorrowingCreateRequest {
    pub student_id: Option<String>,
    pub book_id: Option<String>,
    pub book_copy_id: Option<String>,
    pub borrowed_date: String,
    pub due_date: String,
    pub status: Option<String>,
    pub condition_at_issue: Option<String>,
    pub notes: Option<String>,
    pub issued_by: Option<String>,
    pub borrower_type: Option<String>,
    pub staff_id: Option<String>,
    pub borrowing_type: Option<String>,
    pub long_term_period: Option<String>,
    pub short_term_period: Option<String>,
    pub is_long_term: Option<bool>,
}

impl BorrowingCreateRequest {
    /// Convert the request into a full Borrowing struct with defaults
    pub fn into_borrowing(self) -> Result<Borrowing, String> {
        let now = Utc::now();
        
        // Parse dates
        let borrowed_date = NaiveDate::parse_from_str(&self.borrowed_date, "%Y-%m-%d")
            .map_err(|e| format!("Invalid borrowed_date format: {}", e))?;
        
        let due_date = NaiveDate::parse_from_str(&self.due_date, "%Y-%m-%d")
            .map_err(|e| format!("Invalid due_date format: {}", e))?;
        
        // Parse UUIDs
        let student_id = if let Some(id_str) = self.student_id {
            Some(Uuid::parse_str(&id_str)
                .map_err(|e| format!("Invalid student_id UUID: {}", e))?)
        } else {
            None
        };
        
        let book_id = if let Some(id_str) = self.book_id {
            Some(Uuid::parse_str(&id_str)
                .map_err(|e| format!("Invalid book_id UUID: {}", e))?)
        } else {
            None
        };
        
        let book_copy_id = if let Some(id_str) = self.book_copy_id {
            Some(Uuid::parse_str(&id_str)
                .map_err(|e| format!("Invalid book_copy_id UUID: {}", e))?)
        } else {
            None
        };
        
        let issued_by = if let Some(id_str) = self.issued_by {
            Some(Uuid::parse_str(&id_str)
                .map_err(|e| format!("Invalid issued_by UUID: {}", e))?)
        } else {
            None
        };
        
        let staff_id = if let Some(id_str) = self.staff_id {
            Some(Uuid::parse_str(&id_str)
                .map_err(|e| format!("Invalid staff_id UUID: {}", e))?)
        } else {
            None
        };
        
        // Parse status
        let status = match self.status.as_deref().unwrap_or("active") {
            "active" => BorrowingStatus::Active,
            "returned" => BorrowingStatus::Returned,
            "overdue" => BorrowingStatus::Overdue,
            "lost" => BorrowingStatus::Lost,
            _ => BorrowingStatus::Active,
        };
        
        // Parse borrower type
        let borrower_type = match self.borrower_type.as_deref().unwrap_or("student") {
            "student" => BorrowerType::Student,
            "staff" => BorrowerType::Staff,
            _ => BorrowerType::Student,
        };
        
        Ok(Borrowing {
            id: Uuid::new_v4(),
            student_id,
            book_id,
            legacy_book_id: None,
            borrowed_date,
            due_date,
            returned_date: None,
            status,
            fine_amount: 0.0,
            notes: self.notes,
            issued_by,
            returned_by: None,
            created_at: now,
            updated_at: now,
            fine_paid: false,
            book_copy_id,
            condition_at_issue: self.condition_at_issue.unwrap_or_else(|| "good".to_string()),
            condition_at_return: None,
            is_lost: false,
            tracking_code: None,
            return_notes: None,
            copy_condition: None,
            group_borrowing_id: None,
            borrower_type,
            staff_id,
            borrowing_type: self.borrowing_type,
            long_term_period: self.long_term_period,
            short_term_period: self.short_term_period,
            is_long_term: self.is_long_term,
        })
    }
}