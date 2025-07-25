use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// Enum Types
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BookStatus {
    Available,
    Unavailable,
    Damaged,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BorrowingStatus {
    Active,
    Returned,
    Overdue,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BookCondition {
    Excellent,
    Good,
    Fair,
    Poor,
    Damaged,
    Lost,
    Stolen,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CopyStatus {
    Available,
    Borrowed,
    Maintenance,
    Lost,
    Stolen,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FineType {
    Overdue,
    Damaged,
    Lost,
    LostBook,
    LateReturn,
    Damage,
    StolenBook,
    TheftVictim,
    ConditionPoor,
    ConditionFair,
    ConditionExcellent,
    ConditionGood,
    ReplacementCost,
    ProcessingFee,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FineStatus {
    Unpaid,
    Paid,
    Cleared,
    Collected,
    Partial,
    Waived,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TheftStatus {
    Reported,
    Investigating,
    Resolved,
    Closed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BorrowerType {
    Student,
    Staff,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AcademicLevelType {
    Form,
    Grade,
}

// Core Models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Book {
    pub id: Uuid,
    pub title: String,
    pub author: String,
    pub isbn: Option<String>,
    pub genre: Option<String>,
    pub publisher: Option<String>,
    pub publication_year: Option<i32>,
    pub total_copies: i32,
    pub available_copies: i32,
    pub shelf_location: Option<String>,
    pub cover_image_url: Option<String>,
    pub description: Option<String>,
    pub status: BookStatus,
    pub category_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub condition: Option<BookCondition>,
    pub book_code: Option<String>,
    pub acquisition_year: Option<i32>,
    pub legacy_book_id: Option<i32>,
    pub legacy_isbn: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookCopy {
    pub id: Uuid,
    pub book_id: Option<Uuid>,
    pub copy_number: i32,
    pub book_code: String,
    pub condition: BookCondition,
    pub status: CopyStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tracking_code: Option<String>,
    pub notes: Option<String>,
    pub legacy_book_id: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Class {
    pub id: Uuid,
    pub class_name: String,
    pub form_level: i32,
    pub class_section: Option<String>,
    pub max_books_allowed: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub academic_level_type: AcademicLevelType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
    pub id: Uuid,
    pub admission_number: String,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub class_grade: String,
    pub address: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub enrollment_date: NaiveDate,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub class_id: Option<Uuid>,
    pub academic_year: String,
    pub is_repeating: bool,
    pub legacy_student_id: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Staff {
    pub id: Uuid,
    pub staff_id: String,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub department: Option<String>,
    pub position: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub legacy_staff_id: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Borrowing {
    pub id: Uuid,
    pub student_id: Option<Uuid>,
    pub book_id: Option<Uuid>,
    pub borrowed_date: NaiveDate,
    pub due_date: NaiveDate,
    pub returned_date: Option<NaiveDate>,
    pub status: BorrowingStatus,
    pub fine_amount: f64,
    pub notes: Option<String>,
    pub issued_by: Option<Uuid>,
    pub returned_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub fine_paid: bool,
    pub book_copy_id: Option<Uuid>,
    pub condition_at_issue: String,
    pub condition_at_return: Option<String>,
    pub is_lost: bool,
    pub tracking_code: Option<String>,
    pub return_notes: Option<String>,
    pub copy_condition: Option<String>,
    pub group_borrowing_id: Option<Uuid>,
    pub borrower_type: BorrowerType,
    pub staff_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupBorrowing {
    pub id: Uuid,
    pub book_id: Uuid,
    pub book_copy_id: Option<Uuid>,
    pub tracking_code: Option<String>,
    pub borrowed_date: NaiveDate,
    pub due_date: NaiveDate,
    pub returned_date: Option<NaiveDate>,
    pub condition_at_issue: String,
    pub condition_at_return: Option<String>,
    pub fine_amount: f64,
    pub fine_paid: bool,
    pub notes: Option<String>,
    pub return_notes: Option<String>,
    pub status: String,
    pub is_lost: bool,
    pub student_count: i32,
    pub issued_by: Option<Uuid>,
    pub returned_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub student_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fine {
    pub id: Uuid,
    pub student_id: Option<Uuid>,
    pub borrowing_id: Option<Uuid>,
    pub fine_type: FineType,
    pub amount: f64,
    pub description: Option<String>,
    pub status: FineStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub borrower_type: BorrowerType,
    pub staff_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FineSetting {
    pub id: Uuid,
    pub fine_type: FineType,
    pub amount: f64,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TheftReport {
    pub id: Uuid,
    pub student_id: Uuid,
    pub book_id: Uuid,
    pub book_copy_id: Uuid,
    pub borrowing_id: Uuid,
    pub expected_tracking_code: String,
    pub returned_tracking_code: String,
    pub theft_reason: Option<String>,
    pub reported_date: NaiveDate,
    pub reported_by: Option<Uuid>,
    pub status: TheftStatus,
    pub investigation_notes: Option<String>,
    pub resolved_date: Option<NaiveDate>,
    pub resolved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Sync-related models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncLog {
    pub id: Uuid,
    pub table_name: String,
    pub record_id: Uuid,
    pub operation: String, // insert, update, delete
    pub timestamp: DateTime<Utc>,
    pub synced: bool,
    pub retry_count: i32,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub table_name: String,
    pub last_sync: DateTime<Utc>,
    pub sync_token: Option<String>,
}

// View models for efficient querying
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookWithDetails {
    pub book: Book,
    pub category: Option<Category>,
    pub copies: Vec<BookCopy>,
    pub active_borrowings: Vec<Borrowing>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentWithClass {
    pub student: Student,
    pub class: Option<Class>,
    pub active_borrowings: Vec<Borrowing>,
    pub total_fines: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BorrowingWithDetails {
    pub borrowing: Borrowing,
    pub book: Option<Book>,
    pub student: Option<Student>,
    pub staff: Option<Staff>,
    pub book_copy: Option<BookCopy>,
}
