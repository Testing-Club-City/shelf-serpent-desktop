use crate::database::DatabaseManager;
use serde_json::{Value, json};
use std::sync::Arc;
use tracing::{info, error, warn};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use lazy_static::lazy_static;

pub type DatabaseState = Arc<DatabaseManager>;

// Global sync pause state
lazy_static! {
    static ref SYNC_PAUSED: AtomicBool = AtomicBool::new(false);
    static ref UPLOAD_IN_PROGRESS: Mutex<bool> = Mutex::new(false);
}

// Function to check if sync is paused
pub fn is_sync_paused() -> bool {
    SYNC_PAUSED.load(Ordering::Relaxed)
}

// Function to pause sync
fn pause_sync() {
    SYNC_PAUSED.store(true, Ordering::Relaxed);
    info!("🚫 Bidirectional sync PAUSED for upload operation");
}

// Function to resume sync
fn resume_sync() {
    SYNC_PAUSED.store(false, Ordering::Relaxed);
    info!("✅ Bidirectional sync RESUMED after upload completion");
}

#[tauri::command]
pub async fn upload_local_changes() -> Result<Value, String> {
    // Check if upload is already in progress
    {
        let mut upload_guard = UPLOAD_IN_PROGRESS.lock().unwrap();
        if *upload_guard {
            return Err("Upload already in progress".to_string());
        }
        *upload_guard = true;
    }
    
    // Pause bidirectional sync
    pause_sync();
    
    info!("🚀 Starting COMPLETE upload of ALL local data to Supabase...");
    
    let start_time = std::time::Instant::now();
    let mut total_uploaded = 0;
    let mut errors = Vec::new();
    
    // Get database connection
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    let db = DatabaseManager::new(db_path.to_str().unwrap())
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    
    let client = reqwest::Client::new();
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Upload tables in dependency order
    info!("📁 Uploading categories data...");
    match upload_categories(&db, &client, supabase_url, anon_key).await {
        Ok(count) => {
            total_uploaded += count;
            info!("✅ Uploaded {} categories", count);
        }
        Err(e) => {
            let error_msg = format!("Failed to upload categories: {}", e);
            error!("{}", error_msg);
            errors.push(error_msg);
        }
    }
    
    // Upload fine_settings table
    info!("💰 Uploading fine_settings data...");
    match upload_fine_settings(&db, &client, supabase_url, anon_key).await {
        Ok(count) => {
            total_uploaded += count;
            info!("✅ Uploaded {} fine_settings", count);
        }
        Err(e) => {
            let error_msg = format!("Failed to upload fine_settings: {}", e);
            warn!("{}", error_msg);
            errors.push(error_msg);
        }
    }
    
    info!("Uploading classes data...");
    match upload_classes(&db, &client, supabase_url, anon_key).await {
        Ok(count) => {
            total_uploaded += count;
            info!("✅ Uploaded {} classes", count);
        }
        Err(e) => {
            let error_msg = format!("Failed to upload classes: {}", e);
            error!("{}", error_msg);
            errors.push(error_msg);
        }
    }
    
    info!("Uploading staff data...");
    match upload_staff(&db, &client, supabase_url, anon_key).await {
        Ok(count) => {
            total_uploaded += count;
            info!("✅ Uploaded {} staff", count);
        }
        Err(e) => {
            let error_msg = format!("Failed to upload staff: {}", e);
            error!("{}", error_msg);
            errors.push(error_msg);
        }
    }
    
    info!("Uploading books data...");
    match upload_books(&db, &client, supabase_url, anon_key).await {
        Ok(count) => {
            total_uploaded += count;
            info!("✅ Uploaded {} books", count);
        }
        Err(e) => {
            let error_msg = format!("Failed to upload books: {}", e);
            error!("{}", error_msg);
            errors.push(error_msg);
        }
    }
    
    info!("Uploading students data...");
    match upload_students(&db, &client, supabase_url, anon_key).await {
        Ok(count) => {
            total_uploaded += count;
            info!("✅ Uploaded {} students", count);
        }
        Err(e) => {
            let error_msg = format!("Failed to upload students: {}", e);
            error!("{}", error_msg);
            errors.push(error_msg);
        }
    }
    
    info!("Uploading borrowings data...");
    match upload_borrowings(&db, &client, supabase_url, anon_key).await {
        Ok(count) => {
            total_uploaded += count;
            info!("✅ Uploaded {} borrowings", count);
        }
        Err(e) => {
            let error_msg = format!("Failed to upload borrowings: {}", e);
            error!("{}", error_msg);
            errors.push(error_msg);
        }
    }
    
    info!("Uploading fines data...");
    match upload_fines(&db, &client, supabase_url, anon_key).await {
        Ok(count) => {
            total_uploaded += count;
            info!("✅ Uploaded {} fines", count);
        }
        Err(e) => {
            let error_msg = format!("Failed to upload fines: {}", e);
            error!("{}", error_msg);
            errors.push(error_msg);
        }
    }
    
    info!("Uploading group borrowings data...");
    match upload_group_borrowings(&db, &client, supabase_url, anon_key).await {
        Ok(count) => {
            total_uploaded += count;
            info!("✅ Uploaded {} group borrowings", count);
        }
        Err(e) => {
            let error_msg = format!("Failed to upload group borrowings: {}", e);
            error!("{}", error_msg);
            errors.push(error_msg);
        }
    }

    let duration = start_time.elapsed();
    let success = errors.is_empty();
    let message = if success {
        format!("Successfully uploaded {} records to Supabase", total_uploaded)
    } else {
        format!("Uploaded {} records with {} errors", total_uploaded, errors.len())
    };
    
    // Resume bidirectional sync
    resume_sync();
    
    // Mark upload as completed
    {
        let mut upload_guard = UPLOAD_IN_PROGRESS.lock().unwrap();
        *upload_guard = false;
    }
    
    info!("✅ Upload completed in {:?}: {}", duration, message);
    
    Ok(json!({
        "success": success,
        "uploaded": total_uploaded,
        "duration_ms": duration.as_millis(),
        "errors": errors,
        "message": message,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "sync_resumed": true
    }))
}

async fn upload_categories(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let categories = {
        let conn = db.get_connection().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, description FROM categories")?;
        let rows = stmt.query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>("id")?,
                "name": row.get::<_, String>("name")?,
                "description": row.get::<_, Option<String>>("description")?
            }))
        })?;
        
        let mut categories = Vec::new();
        for row in rows {
            categories.push(row?);
        }
        categories
    };
    
    if categories.is_empty() { return Ok(0); }
    
    let response = client
        .post(&format!("{}/rest/v1/categories", supabase_url))
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates")
        .json(&categories)
        .send()
        .await?;
    
    if response.status().is_success() {
        Ok(categories.len() as u32)
    } else {
        Ok(0)
    }
}

async fn upload_classes(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let classes = {
        let conn = db.get_connection().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, class_name, form_level, class_section, max_books_allowed, is_active FROM classes")?;
        let rows = stmt.query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>("id")?,
                "class_name": row.get::<_, String>("class_name")?,
                "form_level": row.get::<_, i32>("form_level")?,
                "class_section": row.get::<_, Option<String>>("class_section")?,
                "max_books_allowed": row.get::<_, i32>("max_books_allowed")?,
                "is_active": row.get::<_, bool>("is_active")?
            }))
        })?;
        
        let mut classes = Vec::new();
        for row in rows {
            classes.push(row?);
        }
        classes
    };
    
    if classes.is_empty() { return Ok(0); }
    
    let response = client
        .post(&format!("{}/rest/v1/classes", supabase_url))
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates")
        .json(&classes)
        .send()
        .await?;
    
    if response.status().is_success() {
        Ok(classes.len() as u32)
    } else {
        Ok(0)
    }
}

async fn upload_staff(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let staff = {
        let conn = db.get_connection().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, staff_id, first_name, last_name, email, phone, position, department FROM staff")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>("id")?,
                row.get::<_, String>("staff_id")?,
                row.get::<_, String>("first_name")?,
                row.get::<_, String>("last_name")?,
                row.get::<_, Option<String>>("email")?,
                row.get::<_, Option<String>>("phone")?,
                row.get::<_, String>("position")?,
                row.get::<_, Option<String>>("department")?,
            ))
        })?;
        
        let mut staff = Vec::new();
        for row in rows {
            staff.push(row?);
        }
        staff
    };
    
    let mut uploaded = 0;
    for (id, staff_id, first_name, last_name, email, phone, position, department) in staff {
        let payload = json!({
            "id": id,
            "staff_id": staff_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "position": position,
            "department": department
        });
        
        let response = client
            .post(&format!("{}/rest/v1/staff", supabase_url))
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(&payload)
            .send()
            .await?;
        
        if response.status().is_success() {
            uploaded += 1;
        }
    }
    
    Ok(uploaded)
}

async fn upload_books(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    info!("📚 Starting books upload...");
    
    // First, get existing ISBNs from Supabase to avoid conflicts
    let existing_isbns_response = client
        .get(&format!("{}/rest/v1/books?select=isbn", supabase_url))
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await;
    
    let mut existing_isbns = std::collections::HashSet::new();
    if let Ok(response) = existing_isbns_response {
        if response.status().is_success() {
            if let Ok(existing_books) = response.json::<Vec<serde_json::Value>>().await {
                for book in existing_books {
                    if let Some(isbn) = book.get("isbn").and_then(|v| v.as_str()) {
                        existing_isbns.insert(isbn.to_string());
                    }
                }
            }
        }
    }
    
    info!("📖 Found {} existing books in Supabase (will skip duplicates)", existing_isbns.len());

    let books = {
        let conn = db.get_connection().lock().unwrap();
        // Include all fields that exist in the local schema and map to Supabase
        let mut stmt = conn.prepare("SELECT id, title, author, isbn, publisher, publication_year, total_copies, available_copies, shelf_location, description, category_id, book_code, created_at, updated_at FROM books WHERE synced = 0")?;
        let rows = stmt.query_map([], |row| {
            // Handle publication_year constraint: must be NULL or > 1000
            let raw_pub_year = row.get::<_, Option<i32>>("publication_year")?;
            let valid_pub_year = match raw_pub_year {
                Some(year) if year > 1000 => Some(year),
                Some(_) => None, // Invalid year, set to NULL
                None => None,
            };
            
            let isbn = row.get::<_, Option<String>>("isbn")?;
            
            Ok(json!({
                "id": row.get::<_, String>("id")?,
                "title": row.get::<_, String>("title")?,
                "author": row.get::<_, String>("author")?,
                "isbn": isbn.clone(),
                "publisher": row.get::<_, Option<String>>("publisher")?,
                "publication_year": valid_pub_year,
                "total_copies": row.get::<_, i32>("total_copies")?,
                "available_copies": row.get::<_, i32>("available_copies")?,
                "shelf_location": row.get::<_, Option<String>>("shelf_location")?,
                "description": row.get::<_, Option<String>>("description")?,
                "status": "available",
                "category_id": row.get::<_, Option<String>>("category_id")?,
                "book_code": row.get::<_, Option<String>>("book_code")?,
                "created_at": row.get::<_, Option<String>>("created_at")?,
                "updated_at": row.get::<_, Option<String>>("updated_at")?,
                "condition": "good",  // Required field as per schema
                "acquisition_year": 2024,  // Default acquisition year
                "isbn_for_check": isbn  // Keep original ISBN for duplicate checking
            }))
        })?;
        
        let mut books = Vec::new();
        let mut skipped_count = 0;
        for row in rows {
            let mut book = row?;
            
            // Check if this book already exists in Supabase (by ISBN)
            if let Some(isbn_val) = book.get("isbn_for_check").and_then(|v| v.as_str()) {
                if existing_isbns.contains(isbn_val) {
                    skipped_count += 1;
                    continue; // Skip this book, it already exists
                }
            }
            
            // Remove the helper field before uploading
            book.as_object_mut().unwrap().remove("isbn_for_check");
            books.push(book);
        }
        
        if skipped_count > 0 {
            info!("📚 Skipped {} books that already exist in Supabase", skipped_count);
        }
        
        books
    };
    
    if books.is_empty() { 
        info!("📚 No new books to upload");
        return Ok(0); 
    }
    
    info!("📚 Uploading {} new books to Supabase", books.len());
    
    // Upload books in batches
    const BATCH_SIZE: usize = 50;
    let mut total_uploaded = 0;
    
    for chunk in books.chunks(BATCH_SIZE) {
        let response = client
            .post(&format!("{}/rest/v1/books", supabase_url))
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .json(&chunk)
            .send()
            .await?;
        
        if response.status().is_success() {
            total_uploaded += chunk.len() as u32;
            info!("📚 Successfully uploaded batch of {} books", chunk.len());
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            warn!("⚠️ Failed to upload batch of {} books: {} - {}", chunk.len(), status, error_text);
            
            // If we still get conflicts, try individual uploads
            if status == 409 {
                info!("🔄 Retrying individual uploads for this batch");
                for book in chunk {
                    let individual_response = client
                        .post(&format!("{}/rest/v1/books", supabase_url))
                        .header("apikey", anon_key)
                        .header("Authorization", format!("Bearer {}", anon_key))
                        .header("Content-Type", "application/json")
                        .header("Prefer", "return=minimal")
                        .json(&[book])
                        .send()
                        .await?;
                    
                    if individual_response.status().is_success() {
                        total_uploaded += 1;
                    } else {
                        let ind_status = individual_response.status();
                        let ind_error = individual_response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                        warn!("⚠️ Failed to upload individual book: {} - {}", ind_status, ind_error);
                    }
                }
            }
        }
    }
    
    // Mark uploaded books as synced
    if total_uploaded > 0 {
        let conn = db.get_connection().lock().unwrap();
        let _updated = conn.execute("UPDATE books SET synced = 1 WHERE synced = 0", [])?;
    }
    
    Ok(total_uploaded)
}

async fn upload_students(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    const BATCH_SIZE: usize = 200;
    let students = {
        let conn = db.get_connection().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, first_name, last_name, email, phone, class_grade, admission_number, address, status FROM students")?;
        let rows = stmt.query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>("id")?,
                "first_name": row.get::<_, String>("first_name")?,
                "last_name": row.get::<_, String>("last_name")?,
                "email": row.get::<_, Option<String>>("email")?,
                "phone": row.get::<_, Option<String>>("phone")?,
                "class_grade": row.get::<_, String>("class_grade")?,
                "admission_number": row.get::<_, String>("admission_number")?,
                "address": row.get::<_, Option<String>>("address")?,
                "status": row.get::<_, Option<String>>("status")?.unwrap_or_else(|| "active".to_string())
            }))
        })?;
        
        let mut students = Vec::new();
        for row in rows {
            students.push(row?);
        }
        students
    };
    
    let mut total_uploaded = 0;
    for batch in students.chunks(BATCH_SIZE) {
        let response = client
            .post(&format!("{}/rest/v1/students", supabase_url))
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(&batch)
            .send()
            .await?;
        
        if response.status().is_success() {
            total_uploaded += batch.len() as u32;
        } else {
            warn!("Students batch failed: {}", response.status());
        }
    }
    
    Ok(total_uploaded)
}

async fn upload_borrowings(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let borrowings = {
        let conn = db.get_connection().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, student_id, book_id, borrowed_date, due_date, returned_date, status, fine_amount FROM borrowings WHERE student_id IS NOT NULL AND book_id IS NOT NULL")?;
        let rows = stmt.query_map([], |row| {
            let status = row.get::<_, String>("status")?;
            
            // Map local status to Supabase enum values
            let supabase_status = match status.as_str() {
                "borrowed" | "active" => "active",
                "returned" => "returned", 
                "overdue" => "overdue",
                "lost" => "lost",
                _ => "active" // Default fallback
            };
            
            Ok(json!({
                "id": row.get::<_, String>("id")?,
                "student_id": row.get::<_, String>("student_id")?,
                "book_id": row.get::<_, String>("book_id")?,
                "borrowed_date": row.get::<_, String>("borrowed_date")?,
                "due_date": row.get::<_, String>("due_date")?,
                "returned_date": row.get::<_, Option<String>>("returned_date")?,
                "status": supabase_status,
                "fine_amount": row.get::<_, Option<f64>>("fine_amount")?.unwrap_or(0.0),
                "condition_at_issue": row.get::<_, Option<String>>("condition_at_issue")?.unwrap_or_else(|| "good".to_string()),
                "condition_at_return": row.get::<_, Option<String>>("condition_at_return")?,
                "fine_paid": row.get::<_, Option<i32>>("fine_paid")?.unwrap_or(0) != 0,
                "is_lost": row.get::<_, Option<i32>>("is_lost")?.unwrap_or(0) != 0,
                "notes": row.get::<_, Option<String>>("notes")?,
                "return_notes": row.get::<_, Option<String>>("return_notes")?,
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "book_copy_id": row.get::<_, Option<String>>("book_copy_id")?,
                "group_borrowing_id": row.get::<_, Option<String>>("group_borrowing_id")?,
                "borrower_type": row.get::<_, Option<String>>("borrower_type")?.unwrap_or_else(|| "student".to_string()),
                "staff_id": row.get::<_, Option<String>>("staff_id")?,
                "borrowing_type": row.get::<_, Option<String>>("borrowing_type")?.unwrap_or_else(|| "short_term".to_string()),
                "long_term_period": row.get::<_, Option<String>>("long_term_period")?,
                "short_term_period": row.get::<_, Option<String>>("short_term_period")?,
                "is_long_term": row.get::<_, Option<i32>>("is_long_term")?.unwrap_or(0) != 0
            }))
        })?;
        
        let mut borrowings = Vec::new();
        for row in rows {
            borrowings.push(row?);
        }
        borrowings
    };
    
    if borrowings.is_empty() { 
        info!("📋 No borrowings to upload");
        return Ok(0); 
    }
    
    info!("📋 Uploading {} borrowings to Supabase", borrowings.len());
    
    // Upload borrowings in batches for better performance
    const BATCH_SIZE: usize = 150;
    let mut total_uploaded = 0;
    
    for chunk in borrowings.chunks(BATCH_SIZE) {
        let response = client
            .post(&format!("{}/rest/v1/borrowings", supabase_url))
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(&chunk)
            .send()
            .await?;
        
        if response.status().is_success() {
            total_uploaded += chunk.len() as u32;
            info!("📋 Successfully uploaded batch of {} borrowings", chunk.len());
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            warn!("⚠️ Failed to upload batch of {} borrowings: {} - {}", chunk.len(), status, error_text);
        }
    }
    
    Ok(total_uploaded)
}

async fn upload_fine_settings(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let fine_settings = {
        let conn = db.get_connection().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, fine_type, 1.0 as amount, 1 as is_active FROM fine_settings")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>("id")?,
                row.get::<_, String>("fine_type")?,
                row.get::<_, f64>("amount")?,
                None::<f64>,
                0i32,
                row.get::<_, i32>("is_active")? != 0,
            ))
        })?;
        
        let mut fine_settings = Vec::new();
        for row in rows {
            fine_settings.push(row?);
        }
        fine_settings
    };
    
    let mut uploaded = 0;
    for (id, fine_type, amount_per_day, _max_fine_amount, _grace_period_days, is_active) in fine_settings {
        let payload = json!({
            "id": id,
            "fine_type": fine_type,
            "amount": amount_per_day,
            "is_active": is_active
        });
        
        let response = client
            .post(&format!("{}/rest/v1/fine_settings", supabase_url))
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(&payload)
            .send()
            .await?;
        
        if response.status().is_success() {
            uploaded += 1;
        }
    }
    
    Ok(uploaded)
}

async fn upload_fines(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let fines = {
        let conn = db.get_connection().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, student_id, staff_id, borrowing_id, fine_type, amount, status, description FROM fines")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>("id")?,
                row.get::<_, String>("student_id")?,
                row.get::<_, Option<String>>("staff_id")?,
                row.get::<_, Option<String>>("borrowing_id")?,
                row.get::<_, String>("fine_type")?,
                row.get::<_, f64>("amount")?,
                row.get::<_, String>("status")?,
                row.get::<_, Option<String>>("description")?,
                false, // fine_paid default
            ))
        })?;
        
        let mut fines = Vec::new();
        for row in rows {
            fines.push(row?);
        }
        fines
    };
    
    let mut uploaded = 0;
    for (id, student_id, staff_id, borrowing_id, fine_type, amount, status, description, fine_paid) in fines {
        let payload = json!({
            "id": id,
            "student_id": student_id,
            "staff_id": staff_id,
            "borrowing_id": borrowing_id,
            "fine_type": fine_type,
            "amount": amount,
            "status": status,
            "description": description,
            "fine_paid": fine_paid
        });
        
        let response = client
            .post(&format!("{}/rest/v1/fines", supabase_url))
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(&payload)
            .send()
            .await?;
        
        if response.status().is_success() {
            uploaded += 1;
        }
    }
    
    Ok(uploaded)
}async fn upload_group_borrowings(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let group_borrowings = {
        let conn = db.get_connection().lock().unwrap();
        // Use SELECT * to see what columns are available, then map to Supabase schema
        let mut stmt = conn.prepare("SELECT * FROM group_borrowings WHERE book_id IS NOT NULL")?;
        let rows = stmt.query_map([], |row| {
            let status = row.get::<_, String>("status").unwrap_or_else(|_| "active".to_string());
            
            // Map local status to Supabase enum values
            let supabase_status = match status.as_str() {
                "borrowed" | "active" => "active",
                "returned" => "returned", 
                "overdue" => "overdue",
                "lost" => "lost",
                _ => "active" // Default fallback
            };
            
            // Parse student_ids JSON string to array
            let student_ids_text = row.get::<_, Option<String>>("student_ids")?.unwrap_or_else(|| "[]".to_string());
            let student_ids: serde_json::Value = serde_json::from_str(&student_ids_text)
                .unwrap_or_else(|_| serde_json::Value::Array(vec![]));
            
            Ok(json!({
                "id": row.get::<_, String>("id")?,
                "book_id": row.get::<_, String>("book_id")?,
                "book_copy_id": row.get::<_, Option<String>>("book_copy_id")?,
                "borrowed_date": row.get::<_, String>("borrowed_date")?,
                "due_date": row.get::<_, String>("due_date")?,
                "returned_date": row.get::<_, Option<String>>("returned_date")?,
                "status": supabase_status,
                "fine_amount": row.get::<_, Option<f64>>("fine_amount")?.unwrap_or(0.0),
                "fine_paid": row.get::<_, Option<i32>>("fine_paid")?.unwrap_or(0) != 0,
                "student_count": row.get::<_, Option<i32>>("student_count")?.unwrap_or(1),
                "student_ids": student_ids,
                "condition_at_issue": row.get::<_, Option<String>>("condition_at_issue")?.unwrap_or_else(|| "good".to_string()),
                "condition_at_return": row.get::<_, Option<String>>("condition_at_return")?,
                "is_lost": row.get::<_, Option<i32>>("is_lost")?.unwrap_or(0) != 0,
                "notes": row.get::<_, Option<String>>("notes")?,
                "return_notes": row.get::<_, Option<String>>("return_notes")?,
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "issued_by": row.get::<_, Option<String>>("issued_by")?,
                "returned_by": row.get::<_, Option<String>>("returned_by")?
            }))
        })?;
        
        let mut group_borrowings = Vec::new();
        for row in rows {
            group_borrowings.push(row?);
        }
        group_borrowings
    };

    if group_borrowings.is_empty() { 
        return Ok(0); 
    }

    // Upload group borrowings in batches
    const BATCH_SIZE: usize = 100;
    let mut total_uploaded = 0;
    
    for chunk in group_borrowings.chunks(BATCH_SIZE) {
        let response = client
            .post(&format!("{}/rest/v1/group_borrowings", supabase_url))
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(&chunk)
            .send()
            .await?;
        
        if response.status().is_success() {
            total_uploaded += chunk.len() as u32;
            info!("👥 Uploaded batch of {} group borrowings", chunk.len());
        } else {
            warn!("⚠️ Failed to upload batch of {} group borrowings: {}", chunk.len(), response.status());
        }
    }
    
    Ok(total_uploaded)
}
