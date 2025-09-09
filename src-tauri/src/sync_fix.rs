use anyhow::Result;
use reqwest;
use sqlx::{sqlite::SqlitePool, Row};
use std::path::PathBuf;

// Fixed sync functions with proper batch sizes and range-based pagination

pub async fn sync_books_in_batches_fixed() -> Result<u32> {
    println!("📚 Starting FIXED books sync...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let batch_size = 1000; // Fixed: reduced from 5000
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut batch_number = 1;
    
    let existing_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM books")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
    
    let existing_ids_set: std::collections::HashSet<String> = existing_ids.into_iter().collect();
    println!("📊 Found {} existing local books", existing_ids_set.len());
    
    loop {
        let range_start = offset;
        let range_end = offset + batch_size - 1;
        println!("📖 Fetching books batch {} (range: {}-{})...", batch_number, range_start, range_end);
        
        let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=*";
        
        let response = client
            .get(url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Range", format!("{}-{}", range_start, range_end))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ API request failed: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let books = json.as_array().unwrap_or(&vec![]);
        
        if books.is_empty() {
            println!("✅ No more books to fetch - completed!");
            break;
        }
        
        println!("📊 Actually received {} books in this batch", books.len());
        
        let missing_books: Vec<&serde_json::Value> = books
            .iter()
            .filter(|book| {
                let id = book["id"].as_str().unwrap_or_default();
                !existing_ids_set.contains(id)
            })
            .collect();
        
        if missing_books.is_empty() {
            println!("📋 Batch {}: All {} books already exist locally", batch_number, books.len());
        } else {
            println!("📚 Processing {} new books in batch {}...", missing_books.len(), batch_number);
            
            let mut tx = pool.begin().await?;
            let mut batch_inserted = 0;
            
            for book in missing_books {
                let id = book["id"].as_str().unwrap_or_default();
                let title = book["title"].as_str().unwrap_or("Unknown Title");
                let author = book["author"].as_str().unwrap_or("Unknown Author");
                let isbn = book["isbn"].as_str();
                let genre = book["genre"].as_str();
                let publisher = book["publisher"].as_str();
                let publication_year = book["publication_year"].as_i64();
                let total_copies = book["total_copies"].as_i64().unwrap_or(1);
                let available_copies = book["available_copies"].as_i64().unwrap_or(1);
                let shelf_location = book["shelf_location"].as_str();
                let description = book["description"].as_str();
                let status = book["status"].as_str().unwrap_or("available");
                let category_id = book["category_id"].as_str();
                
                let query = r#"
                    INSERT INTO books (
                        id, title, author, isbn, genre, publisher, publication_year, 
                        total_copies, available_copies, shelf_location, description, 
                        status, category_id, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                if let Err(e) = sqlx::query(query)
                    .bind(id)
                    .bind(title)
                    .bind(author)
                    .bind(isbn)
                    .bind(genre)
                    .bind(publisher)
                    .bind(publication_year)
                    .bind(total_copies)
                    .bind(available_copies)
                    .bind(shelf_location)
                    .bind(description)
                    .bind(status)
                    .bind(category_id)
                    .execute(&mut *tx)
                    .await
                {
                    println!("❌ Error inserting book {}: {}", id, e);
                } else {
                    batch_inserted += 1;
                }
            }
            
            tx.commit().await?;
            total_inserted += batch_inserted;
            println!("✅ Batch {}: Successfully inserted {} books", batch_number, batch_inserted);
        }
        
        offset += batch_size;
        batch_number += 1;
        
        if batch_number > 200 { // Increased limit due to smaller batch size
            println!("⚠️ Reached maximum batch limit (200) - stopping");
            break;
        }
    }
    
    println!("🎉 Books sync completed: {} new books inserted", total_inserted);
    Ok(total_inserted)
}

pub async fn sync_students_in_batches_fixed() -> Result<u32> {
    println!("👥 Starting FIXED students sync...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let batch_size = 1000; // Fixed: reduced from 5000
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut batch_number = 1;
    
    let existing_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM students")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
    
    let existing_ids_set: std::collections::HashSet<String> = existing_ids.into_iter().collect();
    println!("📊 Found {} existing local students", existing_ids_set.len());
    
    loop {
        let range_start = offset;
        let range_end = offset + batch_size - 1;
        println!("👥 Fetching students batch {} (range: {}-{})...", batch_number, range_start, range_end);
        
        let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/students?select=*";
        
        let response = client
            .get(url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Range", format!("{}-{}", range_start, range_end))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ API request failed: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let students = json.as_array().unwrap_or(&vec![]);
        
        if students.is_empty() {
            println!("✅ No more students to fetch - completed!");
            break;
        }
        
        println!("📊 Actually received {} students in this batch", students.len());
        
        let missing_students: Vec<&serde_json::Value> = students
            .iter()
            .filter(|student| {
                let id = student["id"].as_str().unwrap_or_default();
                !existing_ids_set.contains(id)
            })
            .collect();
        
        if missing_students.is_empty() {
            println!("📋 Batch {}: All {} students already exist locally", batch_number, students.len());
        } else {
            println!("👨‍🎓 Processing {} new students in batch {}...", missing_students.len(), batch_number);
            
            let mut tx = pool.begin().await?;
            let mut batch_inserted = 0;
            
            for student in missing_students {
                let id = student["id"].as_str().unwrap_or_default();
                let student_id = student["student_id"].as_str().unwrap_or_default();
                let first_name = student["first_name"].as_str().unwrap_or("Unknown");
                let last_name = student["last_name"].as_str().unwrap_or("Unknown");
                let email = student["email"].as_str();
                let phone = student["phone"].as_str();
                let class_id = student["class_id"].as_str();
                let admission_number = student["admission_number"].as_str();
                let status = student["status"].as_str().unwrap_or("active");
                
                let query = r#"
                    INSERT INTO students (
                        id, student_id, first_name, last_name, email, phone, class_id, 
                        admission_number, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                if let Err(e) = sqlx::query(query)
                    .bind(id)
                    .bind(student_id)
                    .bind(first_name)
                    .bind(last_name)
                    .bind(email)
                    .bind(phone)
                    .bind(class_id)
                    .bind(admission_number)
                    .bind(status)
                    .execute(&mut *tx)
                    .await
                {
                    println!("❌ Error inserting student {}: {}", id, e);
                } else {
                    batch_inserted += 1;
                }
            }
            
            tx.commit().await?;
            total_inserted += batch_inserted;
            println!("✅ Batch {}: Successfully inserted {} students", batch_number, batch_inserted);
        }
        
        offset += batch_size;
        batch_number += 1;
        
        if batch_number > 200 {
            println!("⚠️ Reached maximum batch limit (200) - stopping");
            break;
        }
    }
    
    println!("🎉 Students sync completed: {} new students inserted", total_inserted);
    Ok(total_inserted)
}
