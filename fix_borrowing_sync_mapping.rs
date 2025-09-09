// Fix for the borrowing sync mapping - add book_copy_id

fn map_borrowing_for_supabase(&self, record: &HashMap<String, Value>) -> Value {
    let mut mapped = serde_json::json!({
        "id": record.get("id").unwrap_or(&Value::Null),
        "student_id": record.get("student_id").unwrap_or(&Value::Null),
        "book_id": record.get("book_id").unwrap_or(&Value::Null),
        "book_copy_id": record.get("book_copy_id").unwrap_or(&Value::Null), // ← ADD THIS LINE
        "borrowed_date": record.get("borrowed_date").unwrap_or(&Value::Null),
        "due_date": record.get("due_date").unwrap_or(&Value::Null),
        "returned_date": record.get("returned_date").unwrap_or(&Value::Null),
        "status": record.get("status").unwrap_or(&serde_json::json!("active")),
        "fine_amount": record.get("fine_amount").unwrap_or(&serde_json::json!(0.0)),
        "notes": record.get("notes").unwrap_or(&Value::Null),
        "borrower_type": record.get("borrower_type").unwrap_or(&serde_json::json!("student")),
        "staff_id": record.get("staff_id").unwrap_or(&Value::Null),
        "created_at": record.get("created_at").unwrap_or(&Value::Null),
        "updated_at": record.get("updated_at").unwrap_or(&Value::Null)
    });

    // Remove null values and sync-specific columns
    if let Value::Object(ref mut obj) = mapped {
        obj.retain(|k, v| !v.is_null() && !["synced", "sync_version", "deleted"].contains(&k.as_str()));
    }

    mapped
}
