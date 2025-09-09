use serde_json::{json, Value};
use std::collections::HashMap;
use sqlx::{Row, Column};
use anyhow::Result;
use chrono;

/// Schema mapper for handling differences between local SQLite and Supabase PostgreSQL
pub struct SchemaMapper;

#[derive(Debug, Clone)]
pub struct TableMapping {
    pub supabase_table: String,
    pub has_direct_mapping: bool,
    pub requires_special_handling: bool,
}

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

    /// Map local books to Supabase books (Perfect match!)
    pub fn map_book_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "title": local_row.get("title").unwrap_or(&Value::Null),
            "author": local_row.get("author").unwrap_or(&Value::Null),
            "isbn": local_row.get("isbn").unwrap_or(&Value::Null),
            "publisher": local_row.get("publisher").unwrap_or(&Value::Null),
            "publication_year": local_row.get("publication_year").unwrap_or(&Value::Null),
            "category_id": local_row.get("category_id").unwrap_or(&Value::Null),
            "total_copies": local_row.get("total_copies").unwrap_or(&json!(1)),
            "available_copies": local_row.get("available_copies").unwrap_or(&json!(1)),
            "location": local_row.get("location").unwrap_or(&Value::Null),
            "description": local_row.get("description").unwrap_or(&Value::Null),
            "language": local_row.get("language").unwrap_or(&json!("English")),
            "status": local_row.get("status").unwrap_or(&json!("available")),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
        })
    }

    /// Map local students to Supabase students (exclude sync columns)
    pub fn map_student_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        // Handle class_grade - use class_id if class_grade is null
        let class_grade = local_row.get("class_grade")
            .and_then(|v| if v.is_null() { None } else { Some(v.clone()) })
            .or_else(|| local_row.get("class_id").cloned())
            .unwrap_or_else(|| json!("Unknown"));

        let mut mapped = json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "admission_number": local_row.get("admission_number").unwrap_or(&Value::Null),
            "first_name": local_row.get("first_name").unwrap_or(&Value::Null),
            "last_name": local_row.get("last_name").unwrap_or(&Value::Null),
            "email": local_row.get("email").unwrap_or(&Value::Null),
            "phone": local_row.get("phone").unwrap_or(&Value::Null),
            "class_grade": class_grade,
            "date_of_birth": local_row.get("date_of_birth").unwrap_or(&Value::Null),
            "address": local_row.get("address").unwrap_or(&Value::Null),
            "parent_contact": local_row.get("parent_contact").unwrap_or(&Value::Null),
            "enrollment_date": local_row.get("enrollment_date").unwrap_or(&Value::Null),
            "status": local_row.get("status").unwrap_or(&json!("active")),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
            // Note: 'deleted', 'synced', 'sync_version', 'class_id' columns are excluded for Supabase
        });
        
        // Remove any null values to avoid issues
        if let Value::Object(ref mut obj) = mapped {
            obj.retain(|_, v| !v.is_null());
        }
        
        mapped
    }

    /// Map local borrowings to Supabase borrowings (exclude sync columns)
    pub fn map_borrowing_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        // Helper function to format dates properly
        let format_date = |date_val: Option<&Value>| -> Value {
            match date_val {
                Some(Value::String(date_str)) if !date_str.is_empty() && date_str != "" => {
                    // Try to parse and reformat the date
                    if let Ok(parsed_date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                        Value::String(parsed_date.format("%Y-%m-%d").to_string())
                    } else if let Ok(parsed_datetime) = chrono::DateTime::parse_from_rfc3339(date_str) {
                        Value::String(parsed_datetime.format("%Y-%m-%d").to_string())
                    } else {
                        Value::Null
                    }
                },
                _ => Value::Null
            }
        };

        let mut mapped = json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "student_id": local_row.get("student_id").unwrap_or(&Value::Null),
            "book_id": local_row.get("book_id").unwrap_or(&Value::Null),
            "borrowed_date": format_date(local_row.get("borrowed_date")),
            "due_date": format_date(local_row.get("due_date")),
            "returned_date": format_date(local_row.get("returned_date")),
            "status": local_row.get("status").unwrap_or(&json!("active")),
            "fine_amount": local_row.get("fine_amount").unwrap_or(&json!(0)),
            "notes": local_row.get("notes").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
            // Note: 'deleted', 'synced', 'sync_version' columns are excluded for Supabase
        });
        
        // Remove any null values to avoid issues
        if let Value::Object(ref mut obj) = mapped {
            obj.retain(|_, v| !v.is_null());
        }
        
        mapped
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

    /// Map local fines to Supabase fines (Perfect match!)
    pub fn map_fine_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "borrowing_id": local_row.get("borrowing_id").unwrap_or(&Value::Null),
            "amount": local_row.get("amount").unwrap_or(&json!(0.0)),
            "reason": local_row.get("reason").unwrap_or(&Value::Null),
            "status": local_row.get("status").unwrap_or(&json!("pending")),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
        })
    }

    /// Map local fine_settings to Supabase fine_settings (exclude sync columns)
    pub fn map_fine_setting_to_supabase(local_row: &HashMap<String, Value>) -> Value {
        let mut mapped = json!({
            "id": local_row.get("id").unwrap_or(&Value::Null),
            "fine_type": local_row.get("type").unwrap_or(&local_row.get("fine_type").unwrap_or(&Value::Null)),
            "amount": local_row.get("amount").unwrap_or(&json!(0.0)),
            "description": local_row.get("description").unwrap_or(&Value::Null),
            "created_at": local_row.get("created_at").unwrap_or(&Value::Null),
            "updated_at": local_row.get("updated_at").unwrap_or(&Value::Null)
            // Note: Removed max_fine, grace_period, is_active as they don't exist in Supabase schema
            // Note: 'deleted', 'synced', 'sync_version' columns are excluded for Supabase
        });
        
        // Remove any null values to avoid issues
        if let Value::Object(ref mut obj) = mapped {
            obj.retain(|_, v| !v.is_null());
        }
        
        mapped
    }

    /// Get table mappings configuration
    pub fn get_table_mappings() -> HashMap<String, TableMapping> {
        let mut mappings = HashMap::new();
        
        mappings.insert("categories".to_string(), TableMapping {
            supabase_table: "categories".to_string(),
            has_direct_mapping: false,  // Use custom mapping
            requires_special_handling: true,
        });
        
        mappings.insert("books".to_string(), TableMapping {
            supabase_table: "books".to_string(),
            has_direct_mapping: false,  // Use custom mapping
            requires_special_handling: true,
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
        
        mappings.insert("fines".to_string(), TableMapping {
            supabase_table: "fines".to_string(),
            has_direct_mapping: false,  // Use custom mapping
            requires_special_handling: true,
        });
        
        mappings.insert("fine_settings".to_string(), TableMapping {
            supabase_table: "fine_settings".to_string(),
            has_direct_mapping: false,  // Use custom mapping to handle RLS
            requires_special_handling: true,
        });
        
        mappings.insert("staff".to_string(), TableMapping {
            supabase_table: "staff".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings.insert("classes".to_string(), TableMapping {
            supabase_table: "classes".to_string(),
            has_direct_mapping: true,
            requires_special_handling: false,
        });
        
        mappings
    }
}

/// Convert SQLite row to HashMap for easier processing
pub fn row_to_hashmap(row: &sqlx::sqlite::SqliteRow) -> Result<HashMap<String, Value>> {
    let mut map = HashMap::new();
    
    for column in row.columns() {
        let column_name = column.name();
        let value: Value = match row.try_get::<Option<String>, _>(column_name) {
            Ok(Some(s)) => Value::String(s),
            Ok(None) => Value::Null,
            Err(_) => {
                // Try as integer
                match row.try_get::<Option<i64>, _>(column_name) {
                    Ok(Some(i)) => json!(i),
                    Ok(None) => Value::Null,
                    Err(_) => {
                        // Try as float
                        match row.try_get::<Option<f64>, _>(column_name) {
                            Ok(Some(f)) => json!(f),
                            Ok(None) => Value::Null,
                            Err(_) => Value::Null,
                        }
                    }
                }
            }
        };
        map.insert(column_name.to_string(), value);
    }
    
    Ok(map)
}
