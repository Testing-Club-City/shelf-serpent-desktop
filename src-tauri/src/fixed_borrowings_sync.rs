use anyhow::Result;
use sqlx::{SqlitePool, Row};
use std::collections::HashSet;

pub async fn sync_borrowings_with_validation() -> Result<u32> {
    println!("🔧 Starting FIXED borrowings sync with validation...");
    
    let app_dir = dirs::data_dir()
        .expect("Failed to get data directory")
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Step 1: Get valid student, staff and book IDs from local database
    println!("📊 Validating local reference data...");
    
    let student_ids: HashSet<String> = sqlx::query("SELECT id FROM students")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(|row| row.get::<String, _>("id"))
        .collect();
    
    let staff_ids: HashSet<String> = sqlx::query("SELECT id FROM staff")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(|row| row.get::<String, _>("id"))
        .collect();
    
    let book_ids: HashSet<String> = sqlx::query("SELECT id FROM books")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(|row| row.get::<String, _>("id"))
        .collect();
    
    println!("✅ Found {} students, {} staff, and {} books in local database", 
             student_ids.len(), staff_ids.len(), book_ids.len());
    
    // Step 2: Get existing borrowing IDs for differential sync
    let existing_borrowing_ids: HashSet<String> = sqlx::query("SELECT id FROM borrowings")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(|row| row.get::<String, _>("id"))
        .collect();
    
    println!("📋 Found {} existing borrowings in local database", existing_borrowing_ids.len());
    
    // Step 3: Fetch borrowings from Supabase in batches
    let batch_size = 5000;
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut total_skipped = 0;
    let mut batch_number = 1;
    let mut staff_borrowings_synced = 0;
    let mut student_borrowings_synced = 0;
    
    loop {
        println!("📥 Fetching borrowings batch {} (offset: {})...", batch_number, offset);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/borrowings?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ Failed to fetch batch {}: {}", batch_number, response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let borrowings = json.as_array().unwrap_or(&empty_vec);
        
        if borrowings.is_empty() {
            println!("✅ No more borrowings to fetch - completed!");
            break;
        }
        
        // Step 4: Filter and validate borrowings
        let mut valid_borrowings = Vec::new();
        let mut invalid_count = 0;
        
        for borrowing in borrowings {
            let id = borrowing["id"].as_str().unwrap_or_default();
            let student_id = borrowing["student_id"].as_str().unwrap_or("");
            let staff_id = borrowing["staff_id"].as_str().unwrap_or("");
            let book_id = borrowing["book_id"].as_str().unwrap_or("");
            let borrower_type = borrowing["borrower_type"].as_str().unwrap_or("student");
            
            // Skip if already exists
            if existing_borrowing_ids.contains(id) {
                continue;
            }
            
            // Validate foreign keys based on borrower type
            let has_valid_borrower = if borrower_type == "staff" {
                !staff_id.is_empty() && staff_ids.contains(staff_id)
            } else {
                !student_id.is_empty() && student_ids.contains(student_id)
            };
            
            let has_valid_book = book_ids.contains(book_id);
            
            if has_valid_borrower && has_valid_book {
                valid_borrowings.push(borrowing);
            } else {
                invalid_count += 1;
                if invalid_count <= 5 { // Log first few invalid records
                    println!("⚠️ Skipping borrowing {}: borrower_type={}, valid_borrower={}, valid_book={}", 
                             id, borrower_type, has_valid_borrower, has_valid_book);
                }
            }
        }
        
        total_skipped += invalid_count;
        
        if valid_borrowings.is_empty() {
            println!("📋 Batch {}: No valid borrowings to insert (skipped {})", 
                     batch_number, invalid_count);
            offset += batch_size;
            batch_number += 1;
            continue;
        }
        
        println!("📋 Processing {} valid borrowings (skipped {})...", 
                 valid_borrowings.len(), invalid_count);
        
        // Step 5: Insert valid borrowings with CORRECTED QUERY
        let mut tx = pool.begin().await?;
        let mut batch_inserted = 0;
        
        for borrowing in valid_borrowings {
            let id = borrowing["id"].as_str().unwrap_or_default();
            let student_id = borrowing["student_id"].as_str();
            let staff_id = borrowing["staff_id"].as_str(); // ✅ FIXED: Extract staff_id
            let book_id = borrowing["book_id"].as_str().unwrap_or("");
            let borrowed_date = borrowing["borrowed_date"].as_str()
                .or_else(|| borrowing["borrow_date"].as_str())
                .unwrap_or("");
            let due_date = borrowing["due_date"].as_str().unwrap_or("");
            let returned_date = borrowing["returned_date"].as_str()
                .or_else(|| borrowing["return_date"].as_str());
            let status = borrowing["status"].as_str().unwrap_or("borrowed");
            let fine_amount = borrowing["fine_amount"].as_f64().unwrap_or(0.0);
            let notes = borrowing["notes"].as_str();
            let created_at = borrowing["created_at"].as_str();
            let updated_at = borrowing["updated_at"].as_str();
            let borrower_type = borrowing["borrower_type"].as_str().unwrap_or("student"); // ✅ FIXED: Extract borrower_type
            
            // Additional fields for compatibility
            let book_copy_id = borrowing["book_copy_id"].as_str();
            let condition_at_issue = borrowing["condition_at_issue"].as_str().unwrap_or("good");
            let condition_at_return = borrowing["condition_at_return"].as_str();
            let is_lost = borrowing["is_lost"].as_bool().unwrap_or(false);
            let tracking_code = borrowing["tracking_code"].as_str();
            let return_notes = borrowing["return_notes"].as_str();
            let issued_by = borrowing["issued_by"].as_str();
            let returned_by = borrowing["returned_by"].as_str();
            let fine_paid = borrowing["fine_paid"].as_bool().unwrap_or(false);
            
            // ✅ CORRECTED QUERY: Include staff_id and borrower_type
            let query = r#"
                INSERT INTO borrowings (
                    id, student_id, staff_id, book_id, borrowed_date, due_date, returned_date,
                    status, fine_amount, notes, created_at, updated_at,
                    book_copy_id, condition_at_issue, condition_at_return, is_lost,
                    tracking_code, return_notes, issued_by, returned_by, fine_paid,
                    borrower_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#;
            
            match sqlx::query(query)
                .bind(id)
                .bind(student_id)
                .bind(staff_id) // ✅ FIXED: Bind staff_id
                .bind(book_id)
                .bind(borrowed_date)
                .bind(due_date)
                .bind(returned_date)
                .bind(status)
                .bind(fine_amount)
                .bind(notes)
                .bind(created_at)
                .bind(updated_at)
                .bind(book_copy_id)
                .bind(condition_at_issue)
                .bind(condition_at_return)
                .bind(is_lost)
                .bind(tracking_code)
                .bind(return_notes)
                .bind(issued_by)
                .bind(returned_by)
                .bind(fine_paid)
                .bind(borrower_type) // ✅ FIXED: Bind borrower_type
                .execute(&mut *tx)
                .await
            {
                Ok(_) => {
                    batch_inserted += 1;
                    // Track staff vs student borrowings
                    if borrower_type == "staff" {
                        staff_borrowings_synced += 1;
                    } else {
                        student_borrowings_synced += 1;
                    }
                },
                Err(e) => println!("❌ Failed to insert borrowing {}: {}", id, e),
            }
        }
        
        // Commit batch
        match tx.commit().await {
            Ok(_) => {
                total_inserted += batch_inserted;
                println!("✅ Batch {} committed: {} borrowings inserted", 
                         batch_number, batch_inserted);
            },
            Err(e) => println!("❌ Batch {} commit failed: {}", batch_number, e),
        }
        
        offset += batch_size;
        batch_number += 1;
        
        // Prevent infinite loops
        if batch_number > 100 {
            println!("⚠️ Reached maximum batch limit, stopping sync");
            break;
        }
    }
    
    pool.close().await;
    
    println!("✅ Fixed borrowings sync completed:");
    println!("   📊 Total inserted: {}", total_inserted);
    println!("   👥 Staff borrowings: {}", staff_borrowings_synced);
    println!("   🎓 Student borrowings: {}", student_borrowings_synced);
    println!("   ⚠️ Total skipped (invalid references): {}", total_skipped);
    
    Ok(total_inserted)
}

pub async fn sync_group_borrowings_with_validation() -> Result<u32> {
    println!("👥 Starting FIXED group borrowings sync with validation...");
    
    let app_dir = dirs::data_dir()
        .expect("Failed to get data directory")
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Get valid book IDs from local database
    let book_ids: HashSet<String> = sqlx::query("SELECT id FROM books")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(|row| row.get::<String, _>("id"))
        .collect();
    
    println!("✅ Found {} books for group borrowing validation", book_ids.len());
    
    // Get existing group borrowing IDs
    let existing_ids: HashSet<String> = sqlx::query("SELECT id FROM group_borrowings")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(|row| row.get::<String, _>("id"))
        .collect();
    
    println!("👥 Found {} existing group borrowings", existing_ids.len());
    
    // Fetch all group borrowings
    let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/group_borrowings?select=*";
    
    let response = client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    let json: serde_json::Value = response.json().await?;
    let empty_vec = vec![];
    let group_borrowings = json.as_array().unwrap_or(&empty_vec);
    
    let mut inserted = 0;
    let mut skipped = 0;
    let mut tx = pool.begin().await?;
    
    for borrowing in group_borrowings {
        let id = borrowing["id"].as_str().unwrap_or_default();
        let book_id = borrowing["book_id"].as_str().unwrap_or("");
        
        // Skip if already exists
        if existing_ids.contains(id) {
            continue;
        }
        
        // Validate book exists
        if !book_ids.contains(book_id) {
            skipped += 1;
            if skipped <= 5 {
                println!("⚠️ Skipping group borrowing {}: missing book {}", id, book_id);
            }
            continue;
        }
        
        // Insert valid group borrowing
        let book_copy_id = borrowing["book_copy_id"].as_str();
        let tracking_code = borrowing["tracking_code"].as_str();
        let borrowed_date = borrowing["borrowed_date"].as_str();
        let due_date = borrowing["due_date"].as_str();
        let returned_date = borrowing["returned_date"].as_str();
        let condition_at_issue = borrowing["condition_at_issue"].as_str().unwrap_or("good");
        let condition_at_return = borrowing["condition_at_return"].as_str();
        let fine_amount = borrowing["fine_amount"].as_f64().unwrap_or(0.0);
        let fine_paid = borrowing["fine_paid"].as_bool().unwrap_or(false);
        let notes = borrowing["notes"].as_str();
        let return_notes = borrowing["return_notes"].as_str();
        let status = borrowing["status"].as_str().unwrap_or("active");
        let is_lost = borrowing["is_lost"].as_bool().unwrap_or(false);
        let student_count = borrowing["student_count"].as_i64().unwrap_or(1);
        let issued_by = borrowing["issued_by"].as_str();
        let returned_by = borrowing["returned_by"].as_str();
        let created_at = borrowing["created_at"].as_str();
        let updated_at = borrowing["updated_at"].as_str();
        let student_ids = borrowing["student_ids"].as_str().unwrap_or("[]");
        
        let query = r#"
            INSERT INTO group_borrowings (
                id, book_id, book_copy_id, tracking_code, borrowed_date, due_date,
                returned_date, condition_at_issue, condition_at_return, fine_amount, fine_paid,
                notes, return_notes, status, is_lost, student_count, issued_by, returned_by,
                created_at, updated_at, student_ids
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;
        
        match sqlx::query(query)
            .bind(id)
            .bind(book_id)
            .bind(book_copy_id)
            .bind(tracking_code)
            .bind(borrowed_date)
            .bind(due_date)
            .bind(returned_date)
            .bind(condition_at_issue)
            .bind(condition_at_return)
            .bind(fine_amount)
            .bind(fine_paid)
            .bind(notes)
            .bind(return_notes)
            .bind(status)
            .bind(is_lost)
            .bind(student_count)
            .bind(issued_by)
            .bind(returned_by)
            .bind(created_at)
            .bind(updated_at)
            .bind(student_ids)
            .execute(&mut *tx)
            .await
        {
            Ok(_) => inserted += 1,
            Err(e) => println!("❌ Failed to insert group borrowing {}: {}", id, e),
        }
    }
    
    tx.commit().await?;
    pool.close().await;
    
    println!("✅ Fixed group borrowings sync completed:");
    println!("   📊 Total inserted: {}", inserted);
    println!("   ⚠️ Total skipped (invalid references): {}", skipped);
    
    Ok(inserted)
}
