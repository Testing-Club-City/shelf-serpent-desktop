use anyhow::Result;
use serde_json::{Value, json};
use std::collections::HashMap;
use sqlx::Column;

/// Comprehensive schema mapper between local SQLite and Supabase PostgreSQL
pub struct SchemaMapper;

impl SchemaMapper {
    /// Map local categories to Supabase categories (Perfect match!)
    pub fn map_category_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "name": local_row.get("name").unwrap_or(&Value::Null),
            "description": local_row.get("description").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
        })
    }

    /// Map local classes to Supabase classes (Perfect match!)
    pub fn map_class_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "class_name": local_row.get("class_name").unwrap_or(&Value::Null),
            "form_level": local_row.get("form_level").unwrap_or(&Value::Null),
            "class_section": local_row.get("class_section").unwrap_or(&Value::Null),
            "max_books_allowed": local_row.get("max_books_allowed").unwrap_or(&json!(2)),
            "is_active": local_row.get("is_active").unwrap_or(&json!(true)),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null),
            "academic_level_type": local_row.get("academic_level_type").unwrap_or(&json!("form"))
        })
    }

    /// Map local books to Supabase books (Nearly perfect match!)
    pub fn map_book_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        // Map local status to Supabase book_status enum
        let local_status = local_row.get("status").and_then(|v| v.as_str()).unwrap_or("available");
        let supabase_status = match local_status {
            "available" => "available",
            "unavailable" | "checked_out" => "unavailable", 
            "damaged" => "damaged",
            "lost" => "lost",
            _ => "available"
        };

        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "title": local_row.get("title").unwrap_or(&Value::Null),
            "author": local_row.get("author").unwrap_or(&Value::Null),
            "isbn": local_row.get("isbn").unwrap_or(&Value::Null),
            "genre": local_row.get("genre").unwrap_or(&Value::Null),
            "publisher": local_row.get("publisher").unwrap_or(&Value::Null),
            "publication_year": local_row.get("publication_year").unwrap_or(&Value::Null),
            "total_copies": local_row.get("total_copies").unwrap_or(&json!(1)),
            "available_copies": local_row.get("available_copies").unwrap_or(&json!(1)),
            "shelf_location": local_row.get("shelf_location").unwrap_or(&Value::Null),
            "cover_image_url": local_row.get("cover_image_url").unwrap_or(&Value::Null),
            "description": local_row.get("description").unwrap_or(&Value::Null),
            "status": json!(supabase_status),
            "category_id": local_row.get("category_id").unwrap_or(&Value::Null),
            "condition": local_row.get("condition").unwrap_or(&json!("good")),
            "book_code": local_row.get("book_code").unwrap_or(&Value::Null),
            "acquisition_year": local_row.get("acquisition_year").unwrap_or(&Value::Null),
            "legacy_book_id": local_row.get("legacy_book_id").unwrap_or(&Value::Null),
            "legacy_isbn": local_row.get("legacy_isbn").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
        })
    }

    /// Map local students to Supabase students (Nearly perfect match!)
    pub fn map_student_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "admission_number": local_row.get("admission_number").unwrap_or(&Value::Null),
            "first_name": local_row.get("first_name").unwrap_or(&Value::Null),
            "last_name": local_row.get("last_name").unwrap_or(&Value::Null),
            "email": local_row.get("email").unwrap_or(&Value::Null),
            "phone": local_row.get("phone").unwrap_or(&Value::Null),
            "class_grade": local_row.get("class_grade")
                .or_else(|| local_row.get("class_name"))
                .unwrap_or(&Value::Null),
            "address": local_row.get("address").unwrap_or(&Value::Null),
            "date_of_birth": local_row.get("date_of_birth").unwrap_or(&Value::Null),
            "enrollment_date": local_row.get("enrollment_date").unwrap_or(&Value::Null),
            "status": local_row.get("status").unwrap_or(&json!("active")),
            "class_id": local_row.get("class_id").unwrap_or(&Value::Null),
            "academic_year": local_row.get("academic_year").unwrap_or(&json!("2024/2025")),
            "is_repeating": local_row.get("is_repeating").unwrap_or(&json!(false)),
            "legacy_student_id": local_row.get("legacy_student_id").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
        })
    }

    /// Map local students to Supabase students (exclude deleted column)
    pub fn map_student_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        let mut mapped = json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "admission_number": local_row.get("admission_number").unwrap_or(&Value::Null),
            "first_name": local_row.get("first_name").unwrap_or(&Value::Null),
            "last_name": local_row.get("last_name").unwrap_or(&Value::Null),
            "email": local_row.get("email").unwrap_or(&Value::Null),
            "phone": local_row.get("phone").unwrap_or(&Value::Null),
            "class_id": local_row.get("class_id").unwrap_or(&Value::Null),
            "date_of_birth": local_row.get("date_of_birth").unwrap_or(&Value::Null),
            "address": local_row.get("address").unwrap_or(&Value::Null),
            "parent_contact": local_row.get("parent_contact").unwrap_or(&Value::Null),
            "enrollment_date": local_row.get("enrollment_date").unwrap_or(&Value::Null),
            "status": local_row.get("status").unwrap_or(&json!("active")),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null),
            "synced": local_row.get("synced").unwrap_or(&json!(0)),
            "sync_version": local_row.get("sync_version").unwrap_or(&json!(1))
            // Note: 'deleted' column is excluded for Supabase
        });
        
        // Remove any null values to avoid issues
        if let Value::Object(ref mut obj) = mapped {
            obj.retain(|_, v| !v.is_null());
        }
        
        mapped
    }

    /// Map local borrowings to Supabase borrowings (exclude deleted column)
    pub fn map_borrowing_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        let mut mapped = json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "student_id": local_row.get("student_id").unwrap_or(&Value::Null),
            "book_id": local_row.get("book_id").unwrap_or(&Value::Null),
            "borrowed_date": local_row.get("borrowed_date").unwrap_or(&Value::Null),
            "due_date": local_row.get("due_date").unwrap_or(&Value::Null),
            "returned_date": local_row.get("returned_date").unwrap_or(&Value::Null),
            "status": local_row.get("status").unwrap_or(&json!("active")),
            "fine_amount": local_row.get("fine_amount").unwrap_or(&json!(0)),
            "notes": local_row.get("notes").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null),
            "synced": local_row.get("synced").unwrap_or(&json!(0)),
            "sync_version": local_row.get("sync_version").unwrap_or(&json!(1))
            // Note: 'deleted' column is excluded for Supabase
        });
        
        // Remove any null values to avoid issues
        if let Value::Object(ref mut obj) = mapped {
            obj.retain(|_, v| !v.is_null());
        }
        
        mapped
    }
    pub fn map_borrowing_to_supabase(local_row: &HashMap<String, Value>) -> Result<Value> {
        // Handle date formatting
        let format_date = |date_val: Option<&Value>| -> Option<String> {
            match date_val {
                Some(Value::String(date_str)) if !date_str.is_empty() => Some(date_str.clone()),
                _ => None
            }
        };

        // Map local status to Supabase borrowing_status enum
        let local_status = local_row.get("status").and_then(|v| v.as_str()).unwrap_or("active");
        let supabase_status = match local_status {
            "active" | "borrowed" => "active",
            "returned" => "returned", 
            "overdue" => "overdue",
            "lost" => "lost",
            _ => "active"
        };

        Ok(json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "student_id": local_row.get("student_id").unwrap_or(&Value::Null),
            "book_id": local_row.get("book_id").unwrap_or(&Value::Null),
            "borrowed_date": format_date(local_row.get("borrowed_date"))
                .map(|d| Value::String(d))
                .unwrap_or(Value::Null),
            "due_date": format_date(local_row.get("due_date"))
                .map(|d| Value::String(d))
                .unwrap_or(Value::Null),
            "returned_date": format_date(local_row.get("returned_date"))
                .map(|d| Value::String(d))
                .unwrap_or(Value::Null),
            "status": json!(supabase_status),
            "fine_amount": local_row.get("fine_amount").unwrap_or(&json!(0.0)),
            "notes": local_row.get("notes").unwrap_or(&Value::Null),
            "issued_by": local_row.get("issued_by").unwrap_or(&Value::Null),
            "returned_by": local_row.get("returned_by").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null),
            "fine_paid": local_row.get("fine_paid").unwrap_or(&json!(false)),
            "book_copy_id": local_row.get("book_copy_id").unwrap_or(&Value::Null),
            "condition_at_issue": local_row.get("condition_at_issue").unwrap_or(&json!("good")),
            "condition_at_return": local_row.get("condition_at_return").unwrap_or(&Value::Null),
            "is_lost": local_row.get("is_lost").unwrap_or(&json!(false)),
            "tracking_code": local_row.get("tracking_code").unwrap_or(&Value::Null),
            "return_notes": local_row.get("return_notes").unwrap_or(&Value::Null),
            "copy_condition": local_row.get("copy_condition").unwrap_or(&Value::Null),
            "group_borrowing_id": local_row.get("group_borrowing_id").unwrap_or(&Value::Null),
            "borrower_type": local_row.get("borrower_type").unwrap_or(&json!("student")),
            "staff_id": local_row.get("staff_id").unwrap_or(&Value::Null)
        }))
    }

    /// Map local book_copies to Supabase book_copies (enhanced for new schema)
    pub fn map_book_copy_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "book_id": local_row.get("legacy_book_id").unwrap_or(&local_row.get("book_id").unwrap_or(&Value::Null)),
            "copy_number": local_row.get("copy_number").unwrap_or(&json!(1)),
            "book_code": local_row.get("copy_identifier").unwrap_or(&local_row.get("book_code").unwrap_or(&Value::Null)),
            "condition": local_row.get("condition").unwrap_or(&json!("good")),
            "status": local_row.get("status").unwrap_or(&json!("available")),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null),
            "tracking_code": local_row.get("copy_identifier")
                .or_else(|| local_row.get("tracking_code"))
                .or_else(|| local_row.get("barcode"))
                .unwrap_or(&Value::Null),
            "notes": local_row.get("notes").unwrap_or(&Value::Null),
            "legacy_book_id": local_row.get("legacy_book_id").unwrap_or(&Value::Null)
        })
    }

    /// Map local fines to Supabase fines (enhanced for new schema)
    pub fn map_fine_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "student_id": local_row.get("student_id").unwrap_or(&Value::Null),
            "borrowing_id": local_row.get("borrowing_id").unwrap_or(&Value::Null),
            "fine_type": local_row.get("fine_type").unwrap_or(&json!("overdue")),
            "amount": local_row.get("amount").unwrap_or(&json!(0.0)),
            "description": local_row.get("description").unwrap_or(&Value::Null),
            "status": local_row.get("status").unwrap_or(&json!("unpaid")),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null),
            "created_by": local_row.get("created_by").unwrap_or(&Value::Null),
            "borrower_type": local_row.get("borrower_type").unwrap_or(&json!("student")),
            "staff_id": local_row.get("staff_id").unwrap_or(&Value::Null)
        })
    }

    /// Map local fine_settings to Supabase fine_settings
    pub fn map_fine_setting_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "fine_type": local_row.get("fine_type")
                .or_else(|| local_row.get("type"))
                .unwrap_or(&json!("overdue")),
            "amount": local_row.get("amount")
                .or_else(|| local_row.get("daily_fine"))
                .unwrap_or(&json!(0.0)),
            "description": local_row.get("description").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
        })
    }

    /// Map local staff to Supabase staff
    pub fn map_staff_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "staff_id": local_row.get("staff_id").unwrap_or(&Value::Null),
            "first_name": local_row.get("first_name").unwrap_or(&Value::Null),
            "last_name": local_row.get("last_name").unwrap_or(&Value::Null),
            "email": local_row.get("email").unwrap_or(&Value::Null),
            "phone": local_row.get("phone").unwrap_or(&Value::Null),
            "department": local_row.get("department").unwrap_or(&Value::Null),
            "position": local_row.get("position").unwrap_or(&Value::Null),
            "status": local_row.get("status").unwrap_or(&json!("active")),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null),
            "legacy_staff_id": local_row.get("legacy_staff_id").unwrap_or(&Value::Null)
        })
    }

    /// Map local group_borrowings to Supabase group_borrowings
    pub fn map_group_borrowing_to_supabase(local_row: &HashMap<String, Value>) -> Result<Value> {
        // Handle date formatting
        let format_date = |date_val: Option<&Value>| -> Option<String> {
            match date_val {
                Some(Value::String(date_str)) if !date_str.is_empty() => Some(date_str.clone()),
                _ => None
            }
        };

        Ok(json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "book_id": local_row.get("book_id").unwrap_or(&Value::Null),
            "book_copy_id": local_row.get("book_copy_id").unwrap_or(&Value::Null),
            "tracking_code": local_row.get("tracking_code").unwrap_or(&Value::Null),
            "borrowed_date": format_date(local_row.get("borrowed_date"))
                .map(|d| Value::String(d))
                .unwrap_or(Value::Null),
            "due_date": format_date(local_row.get("due_date"))
                .map(|d| Value::String(d))
                .unwrap_or(Value::Null),
            "returned_date": format_date(local_row.get("returned_date"))
                .map(|d| Value::String(d))
                .unwrap_or(Value::Null),
            "condition_at_issue": local_row.get("condition_at_issue").unwrap_or(&json!("good")),
            "condition_at_return": local_row.get("condition_at_return").unwrap_or(&Value::Null),
            "fine_amount": local_row.get("fine_amount").unwrap_or(&json!(0.0)),
            "fine_paid": local_row.get("fine_paid").unwrap_or(&json!(false)),
            "notes": local_row.get("notes").unwrap_or(&Value::Null),
            "return_notes": local_row.get("return_notes").unwrap_or(&Value::Null),
            "status": local_row.get("status").unwrap_or(&json!("active")),
            "is_lost": local_row.get("is_lost").unwrap_or(&json!(false)),
            "student_count": local_row.get("student_count").unwrap_or(&json!(1)),
            "issued_by": local_row.get("issued_by").unwrap_or(&Value::Null),
            "returned_by": local_row.get("returned_by").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null),
            "student_ids": local_row.get("student_ids").unwrap_or(&json!([]))
        }))
    }

    /// Map local theft_reports to Supabase theft_reports
    pub fn map_theft_report_to_supabase(local_row: &HashMap<String, Value>) -> Result<Value> {
        // Handle date formatting
        let format_date = |date_val: Option<&Value>| -> Option<String> {
            match date_val {
                Some(Value::String(date_str)) if !date_str.is_empty() => Some(date_str.clone()),
                _ => None
            }
        };

        Ok(json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "student_id": local_row.get("student_id").unwrap_or(&Value::Null),
            "book_id": local_row.get("book_id").unwrap_or(&Value::Null),
            "book_copy_id": local_row.get("book_copy_id").unwrap_or(&Value::Null),
            "borrowing_id": local_row.get("borrowing_id").unwrap_or(&Value::Null),
            "expected_tracking_code": local_row.get("expected_tracking_code").unwrap_or(&Value::Null),
            "returned_tracking_code": local_row.get("returned_tracking_code").unwrap_or(&Value::Null),
            "theft_reason": local_row.get("theft_reason").unwrap_or(&Value::Null),
            "reported_date": format_date(local_row.get("reported_date"))
                .map(|d| Value::String(d))
                .unwrap_or(Value::Null),
            "reported_by": local_row.get("reported_by").unwrap_or(&Value::Null),
            "status": local_row.get("status").unwrap_or(&json!("reported")),
            "investigation_notes": local_row.get("investigation_notes").unwrap_or(&Value::Null),
            "resolved_date": format_date(local_row.get("resolved_date"))
                .map(|d| Value::String(d))
                .unwrap_or(Value::Null),
            "resolved_by": local_row.get("resolved_by").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
        }))
    }

    /// Map local notifications to Supabase notifications
    pub fn map_notification_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "user_id": local_row.get("user_id").unwrap_or(&Value::Null),
            "title": local_row.get("title").unwrap_or(&Value::Null),
            "message": local_row.get("message").unwrap_or(&Value::Null),
            "type": local_row.get("type").unwrap_or(&json!("info")),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "read": local_row.get("read").unwrap_or(&json!(false)),
            "related_id": local_row.get("related_id").unwrap_or(&Value::Null)
        })
    }

    /// Map local profiles to Supabase profiles
    pub fn map_profile_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "email": local_row.get("email").unwrap_or(&Value::Null),
            "role": local_row.get("role").unwrap_or(&json!("user")),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null),
            "suspended": local_row.get("suspended").unwrap_or(&json!(false)),
            "first_name": local_row.get("first_name").unwrap_or(&Value::Null),
            "last_name": local_row.get("last_name").unwrap_or(&Value::Null),
            "phone": local_row.get("phone").unwrap_or(&Value::Null),
            "is_online": local_row.get("is_online").unwrap_or(&json!(false)),
            "last_seen": local_row.get("last_seen").unwrap_or(&Value::Null)
        })
    }

    /// Get table mapping configuration - ALL TABLES NOW HAVE DIRECT MAPPINGS!
    pub fn get_table_mappings() -> HashMap<String, TableMapping> {
        let mut mappings = HashMap::new();
        
        mappings.insert("categories".to_string(), TableMapping {
            supabase_table: "categories".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("classes".to_string(), TableMapping {
            supabase_table: "classes".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("books".to_string(), TableMapping {
            supabase_table: "books".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("students".to_string(), TableMapping {
            supabase_table: "students".to_string(),
            has_direct_mapping: false,  // Use custom mapping to exclude 'deleted'
            requires_special_handling: true,
        });
        
        mappings.insert("borrowings".to_string(), TableMapping {
            supabase_table: "borrowings".to_string(),
            has_direct_mapping: false,  // Use custom mapping to exclude 'deleted'
            requires_special_handling: true,
        });
        
        mappings.insert("book_copies".to_string(), TableMapping {
            supabase_table: "book_copies".to_string(),
            has_direct_mapping: false,  // Use custom mapping
            requires_special_handling: true,
        });
        
        mappings.insert("staff".to_string(), TableMapping {
            supabase_table: "staff".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("fines".to_string(), TableMapping {
            supabase_table: "fines".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("fine_settings".to_string(), TableMapping {
            supabase_table: "fine_settings".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("group_borrowings".to_string(), TableMapping {
            supabase_table: "group_borrowings".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("theft_reports".to_string(), TableMapping {
            supabase_table: "theft_reports".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("notifications".to_string(), TableMapping {
            supabase_table: "notifications".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("profiles".to_string(), TableMapping {
            supabase_table: "profiles".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings
    }
}

#[derive(Debug, Clone)]
pub struct TableMapping {
    pub supabase_table: String,
    pub has_direct_mapping: bool,
    pub requires_special_handling: bool,
}

/// Helper function to convert sqlx Row to HashMap
pub fn row_to_hashmap(row: &sqlx::sqlite::SqliteRow) -> Result<HashMap<String, Value>> {
    use sqlx::Row;
    let mut map = HashMap::new();
    
    // Get column names and values
    for (i, column) in row.columns().iter().enumerate() {
        let column_name = column.name();
        
        // Try to get value as different types
        let value = if let Ok(val) = row.try_get::<Option<String>, _>(i) {
            match val {
                Some(s) => Value::String(s),
                None => Value::Null,
            }
        } else if let Ok(val) = row.try_get::<Option<i64>, _>(i) {
            match val {
                Some(n) => Value::Number(n.into()),
                None => Value::Null,
            }
        } else if let Ok(val) = row.try_get::<Option<f64>, _>(i) {
            match val {
                Some(n) => Value::Number(serde_json::Number::from_f64(n).unwrap_or(0.into())),
                None => Value::Null,
            }
        } else if let Ok(val) = row.try_get::<Option<bool>, _>(i) {
            match val {
                Some(b) => Value::Bool(b),
                None => Value::Null,
            }
        } else {
            Value::Null
        };
        
        map.insert(column_name.to_string(), value);
    }
    
    Ok(map)
}
