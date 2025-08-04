use std::path::PathBuf;
use anyhow::Result;
use sqlx::{sqlite::SqlitePool, Row};

// Check if sync is needed (for first-time setup)
pub async fn check_if_sync_needed() -> Result<bool> {
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Check if we have minimal data
    let books_count: i64 = sqlx::query("SELECT COUNT(*) as count FROM books")
        .fetch_one(&pool)
        .await?
        .get("count");
    
    let students_count: i64 = sqlx::query("SELECT COUNT(*) as count FROM students")
        .fetch_one(&pool)
        .await?
        .get("count");
    
    pool.close().await;
    
    // Only sync if we have very little data (less than 100 records)
    Ok(books_count < 100 && students_count < 100)
}

// Simple sync function that can be called from the main app
pub async fn sync_data_from_supabase() -> Result<()> {
    println!("🔄 Starting automatic data sync from Supabase...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Check if we already have data
    let books_count: i64 = sqlx::query("SELECT COUNT(*) as count FROM books")
        .fetch_one(&pool)
        .await?
        .get("count");
    
    if books_count > 0 {
        println!("📚 Local database already has {} books, skipping sync", books_count);
        pool.close().await;
        return Ok(());
    }
    
    // Sync books from Supabase
    let client = reqwest::Client::new();
    let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=*&limit=100";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    println!("📡 Fetching books from Supabase...");
    
    let response = client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        
        if let Some(books) = json.as_array() {
            let mut inserted = 0;
            for book in books {
                let id = book["id"].as_str().unwrap_or_default();
                let title = book["title"].as_str().unwrap_or("Unknown Title");
                let author = book["author"].as_str().unwrap_or("Unknown Author");
                let isbn = book["isbn"].as_str();
                let publisher = book["publisher"].as_str();
                let publication_year = book["publication_year"].as_i64();
                let total_copies = book["total_copies"].as_i64().unwrap_or(1);
                let available_copies = book["available_copies"].as_i64().unwrap_or(1);
                
                let query = r#"
                    INSERT OR REPLACE INTO books (
                        id, title, author, isbn, publisher, publication_year, 
                        total_copies, available_copies, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', datetime('now'), datetime('now'))
                "#;
                
                if sqlx::query(query)
                    .bind(id)
                    .bind(title)
                    .bind(author)
                    .bind(isbn)
                    .bind(publisher)
                    .bind(publication_year)
                    .bind(total_copies)
                    .bind(available_copies)
                    .execute(&pool)
                    .await.is_ok()
                {
                    inserted += 1;
                }
            }
            println!("✅ Successfully inserted {} books!", inserted);
        }
    }
    
    // Sync categories
    let categories_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/categories?select=*";
    let categories_response = client
        .get(categories_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if let Ok(categories_json) = categories_response.json::<serde_json::Value>().await {
        if let Some(categories) = categories_json.as_array() {
            let mut inserted_categories = 0;
            for category in categories {
                let id = category["id"].as_str().unwrap_or_default();
                let name = category["name"].as_str().unwrap_or("Unknown Category");
                let description = category["description"].as_str();
                
                let query = r#"
                    INSERT OR REPLACE INTO categories (
                        id, name, description, created_at, updated_at
                    ) VALUES (?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                if sqlx::query(query)
                    .bind(id)
                    .bind(name)
                    .bind(description)
                    .execute(&pool)
                    .await.is_ok()
                {
                    inserted_categories += 1;
                }
            }
            println!("✅ Successfully inserted {} categories!", inserted_categories);
        }
    }
    
    pool.close().await;
    println!("🎉 Automatic sync completed!");
    
    Ok(())
}

// Individual sync functions for professional UI
pub async fn sync_books_from_supabase(limit: u32) -> Result<u32> {
    println!("📚 Starting books sync with limit: {}", limit);
    
    // For large limits, use batching to get all records
    if limit >= 10000 {
        return sync_books_in_batches().await;
    }
    
    // Set up database path - same as main app
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    println!("🗃️ Using database: {}", db_path.display());
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Sync books from Supabase
    let client = reqwest::Client::new();
    let url = format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=*&limit={}", limit);
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    let mut inserted = 0;
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        
        if let Some(books) = json.as_array() {
            // Start a transaction for better performance
            let mut tx = pool.begin().await?;
            
            for book in books {
                let id = book["id"].as_str().unwrap_or_default();
                let title = book["title"].as_str().unwrap_or("Unknown Title");
                let author = book["author"].as_str().unwrap_or("Unknown Author");
                let isbn = book["isbn"].as_str();
                let category_id = book["category_id"].as_str();
                let total_copies = book["total_copies"].as_i64().unwrap_or(1);
                let available_copies = book["available_copies"].as_i64().unwrap_or(1);
                
                let query = r#"
                    INSERT OR REPLACE INTO books (
                        id, title, author, isbn, category_id, total_copies, 
                        available_copies, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', datetime('now'), datetime('now'))
                "#;
                
                match sqlx::query(query)
                    .bind(id)
                    .bind(title)
                    .bind(author)
                    .bind(isbn)
                    .bind(category_id)
                    .bind(total_copies)
                    .bind(available_copies)
                    .execute(&mut *tx)
                    .await 
                {
                    Ok(_) => inserted += 1,
                    Err(e) => println!("❌ Failed to insert book {}: {}", title, e),
                }
            }
            
            // Commit the transaction
            match tx.commit().await {
                Ok(_) => println!("✅ Transaction committed: {} books", inserted),
                Err(e) => println!("❌ Transaction failed: {}", e),
            }
        }
    }
    
    pool.close().await;
    println!("✅ Books sync completed: {} records", inserted);
    Ok(inserted)
}

// Enhanced books sync that fetches all records in batches
pub async fn sync_books_in_batches() -> Result<u32> {
    println!("📚 Starting COMPLETE books sync in batches...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let batch_size = 5000;
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut batch_number = 1;
    
    loop {
        println!("📖 Fetching books batch {} (offset: {})...", batch_number, offset);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ API request failed: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let books = json.as_array().unwrap_or(&empty_vec);
        
        if books.is_empty() {
            println!("✅ No more books to fetch - completed!");
            break;
        }
        
        println!("📚 Processing {} books in batch {}...", books.len(), batch_number);
        
        // Process this batch
        let mut tx = pool.begin().await?;
        let mut batch_inserted = 0;
        
        for book in books {
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
                INSERT OR REPLACE INTO books (
                    id, title, author, isbn, genre, publisher, publication_year, 
                    total_copies, available_copies, shelf_location, description, 
                    status, category_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            "#;
            
            match sqlx::query(query)
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
                Ok(_) => batch_inserted += 1,
                Err(e) => println!("❌ Failed to insert book {}: {}", title, e),
            }
        }
        
        // Commit this batch
        match tx.commit().await {
            Ok(_) => {
                total_inserted += batch_inserted;
                println!("✅ Batch {} committed: {} books (total: {})", batch_number, batch_inserted, total_inserted);
            },
            Err(e) => println!("❌ Batch {} commit failed: {}", batch_number, e),
        }
        
        // Move to next batch
        offset += batch_size;
        batch_number += 1;
        
        // Safety check to prevent infinite loops
        if batch_number > 100 {
            println!("⚠️ Reached maximum batch limit (100) - stopping");
            break;
        }
    }
    
    pool.close().await;
    println!("✅ Complete books sync finished: {} total records", total_inserted);
    Ok(total_inserted)
}

pub async fn sync_categories_from_supabase() -> Result<u32> {
    println!("📁 Starting categories sync");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Sync categories from Supabase
    let client = reqwest::Client::new();
    let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/categories?select=*";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let response = client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    let mut inserted = 0;
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        
        if let Some(categories) = json.as_array() {
            // Start a transaction for better performance
            let mut tx = pool.begin().await?;
            
            for category in categories {
                let id = category["id"].as_str().unwrap_or_default();
                let name = category["name"].as_str().unwrap_or("Unknown Category");
                let description = category["description"].as_str();
                
                let query = r#"
                    INSERT OR REPLACE INTO categories (
                        id, name, description, created_at, updated_at
                    ) VALUES (?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                if sqlx::query(query)
                    .bind(id)
                    .bind(name)
                    .bind(description)
                    .execute(&mut *tx)
                    .await.is_ok()
                {
                    inserted += 1;
                }
            }
            
            // Commit the transaction
            tx.commit().await?;
        }
    }
    
    pool.close().await;
    println!("✅ Categories sync completed: {} records", inserted);
    Ok(inserted)
}

pub async fn sync_students_from_supabase(limit: u32) -> Result<u32> {
    println!("👥 Starting students sync with limit: {}", limit);
    
    // For large limits, use batching to get all records
    if limit >= 10000 {
        return sync_students_in_batches().await;
    }
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Sync students from Supabase
    let client = reqwest::Client::new();
    let url = format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/students?select=*&limit={}", limit);
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    println!("🔍 Students API response status: {}", response.status());
    
    let mut inserted = 0;
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        
        println!("📊 Students API returned: {} records", 
            json.as_array().map(|a| a.len()).unwrap_or(0));
        
        if let Some(students) = json.as_array() {
            // Start a transaction for better performance
            let mut tx = pool.begin().await?;
            
            for student in students {
                let id = student["id"].as_str().unwrap_or_default();
                let student_id = student["student_id"].as_str()
                    .or_else(|| student["admission_number"].as_str())
                    .unwrap_or_default();
                let first_name = student["first_name"].as_str().unwrap_or("Unknown");
                let last_name = student["last_name"].as_str().unwrap_or("Unknown");
                let email = student["email"].as_str();
                let phone = student["phone"].as_str();
                let class_name = student["class"].as_str()
                    .or_else(|| student["class_grade"].as_str())
                    .unwrap_or_default();
                
                let query = r#"
                    INSERT OR REPLACE INTO students (
                        id, admission_number, first_name, last_name, email, phone, class_grade, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                match sqlx::query(query)
                    .bind(id)
                    .bind(student_id)
                    .bind(first_name)
                    .bind(last_name)
                    .bind(email)
                    .bind(phone)
                    .bind(class_name)
                    .execute(&mut *tx)
                    .await 
                {
                    Ok(_) => inserted += 1,
                    Err(e) => println!("❌ Failed to insert student {} {}: {}", first_name, last_name, e),
                }
            }
            
            // Commit the transaction
            match tx.commit().await {
                Ok(_) => println!("✅ Transaction committed: {} students", inserted),
                Err(e) => println!("❌ Transaction failed: {}", e),
            }
        }
    }
    
    pool.close().await;
    println!("✅ Students sync completed: {} records", inserted);
    Ok(inserted)
}

// Enhanced students sync that fetches all records in batches
pub async fn sync_students_in_batches() -> Result<u32> {
    println!("👥 Starting COMPLETE students sync in batches...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let batch_size = 5000;
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut batch_number = 1;
    
    loop {
        println!("👥 Fetching students batch {} (offset: {})...", batch_number, offset);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/students?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ API request failed: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let students = json.as_array().unwrap_or(&empty_vec);
        
        if students.is_empty() {
            println!("✅ No more students to fetch - completed!");
            break;
        }
        
        println!("👥 Processing {} students in batch {}...", students.len(), batch_number);
        
        // Process this batch
        let mut tx = pool.begin().await?;
        let mut batch_inserted = 0;
        
        for student in students {
            let id = student["id"].as_str().unwrap_or_default();
            let admission_number = student["admission_number"].as_str().unwrap_or_default();
            let first_name = student["first_name"].as_str().unwrap_or("Unknown");
            let last_name = student["last_name"].as_str().unwrap_or("Unknown");
            let email = student["email"].as_str();
            let phone = student["phone"].as_str();
            let class_grade = student["class_grade"].as_str().unwrap_or("Unknown");
            let address = student["address"].as_str();
            let date_of_birth = student["date_of_birth"].as_str();
            let enrollment_date = student["enrollment_date"].as_str();
            let status = student["status"].as_str().unwrap_or("active");
            
            let query = r#"
                INSERT OR REPLACE INTO students (
                    id, admission_number, first_name, last_name, email, phone, 
                    class_grade, address, date_of_birth, enrollment_date, status, 
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            "#;
            
            match sqlx::query(query)
                .bind(id)
                .bind(admission_number)
                .bind(first_name)
                .bind(last_name)
                .bind(email)
                .bind(phone)
                .bind(class_grade)
                .bind(address)
                .bind(date_of_birth)
                .bind(enrollment_date)
                .bind(status)
                .execute(&mut *tx)
                .await 
            {
                Ok(_) => batch_inserted += 1,
                Err(e) => println!("❌ Failed to insert student {} {}: {}", first_name, last_name, e),
            }
        }
        
        // Commit this batch
        match tx.commit().await {
            Ok(_) => {
                total_inserted += batch_inserted;
                println!("✅ Batch {} committed: {} students (total: {})", batch_number, batch_inserted, total_inserted);
            },
            Err(e) => println!("❌ Batch {} commit failed: {}", batch_number, e),
        }
        
        // Move to next batch
        offset += batch_size;
        batch_number += 1;
        
        // Safety check to prevent infinite loops
        if batch_number > 100 {
            println!("⚠️ Reached maximum batch limit (100) - stopping");
            break;
        }
    }
    
    pool.close().await;
    println!("✅ Complete students sync finished: {} total records", total_inserted);
    Ok(total_inserted)
}

pub async fn sync_borrowings_from_supabase(limit: u32) -> Result<u32> {
    println!("📋 Starting borrowings sync with limit: {}", limit);
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Sync borrowings from Supabase
    let client = reqwest::Client::new();
    let url = if limit >= 50000 {
        // For very high limits, don't use limit parameter to get all records
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/borrowings?select=*".to_string()
    } else {
        format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/borrowings?select=*&limit={}", limit)
    };
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    println!("🔍 Borrowings API response status: {}", response.status());
    
    let mut inserted = 0;
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        
        println!("📊 Borrowings API returned: {} records", 
            json.as_array().map(|a| a.len()).unwrap_or(0));
        
        if let Some(borrowings) = json.as_array() {
            // Start a transaction for better performance
            let mut tx = pool.begin().await?;
            
            for borrowing in borrowings {
                let id = borrowing["id"].as_str().unwrap_or_default();
                let student_id = borrowing["student_id"].as_str();
                let book_id = borrowing["book_id"].as_str();
                let borrowed_at = borrowing["borrowed_at"].as_str();
                let due_date = borrowing["due_date"].as_str();
                let returned_at = borrowing["returned_at"].as_str();
                let status = borrowing["status"].as_str().unwrap_or("active");
                let fine_amount = borrowing["fine_amount"].as_f64().unwrap_or(0.0);
                
                let query = r#"
                    INSERT OR REPLACE INTO borrowings (
                        id, student_id, book_id, borrowed_date, due_date, returned_date, 
                        status, fine_amount, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                match sqlx::query(query)
                    .bind(id)
                    .bind(student_id)
                    .bind(book_id)
                    .bind(borrowed_at)  // API field: borrowed_at -> DB field: borrow_date
                    .bind(due_date)
                    .bind(returned_at)  // API field: returned_at -> DB field: return_date
                    .bind(status)
                    .bind(fine_amount)
                    .execute(&mut *tx)
                    .await 
                {
                    Ok(_) => inserted += 1,
                    Err(e) => println!("❌ Failed to insert borrowing {}: {}", id, e),
                }
            }
            
            // Commit the transaction
            match tx.commit().await {
                Ok(_) => println!("✅ Transaction committed: {} borrowings", inserted),
                Err(e) => println!("❌ Transaction failed: {}", e),
            }
        }
    }
    
    pool.close().await;
    println!("✅ Borrowings sync completed: {} records", inserted);
    Ok(inserted)
}

// Enhanced borrowings sync that fetches all records in batches
pub async fn sync_borrowings_in_batches() -> Result<u32> {
    println!("📋 Starting COMPLETE borrowings sync in batches...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let batch_size = 5000;
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut batch_number = 1;
    
    loop {
        println!("📋 Fetching borrowings batch {} (offset: {})...", batch_number, offset);
        
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
            println!("❌ API request failed: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let borrowings = json.as_array().unwrap_or(&empty_vec);
        
        if borrowings.is_empty() {
            println!("✅ No more borrowings to fetch - completed!");
            break;
        }
        
        println!("📋 Processing {} borrowings in batch {}...", borrowings.len(), batch_number);
        
        let mut tx = pool.begin().await?;
        let mut batch_inserted = 0;
        
        for borrowing in borrowings {
            let id = borrowing["id"].as_str().unwrap_or_default();
            let student_id = borrowing["student_id"].as_str().unwrap_or("");
            let book_id = borrowing["book_id"].as_str().unwrap_or("");
            let borrowed_date = borrowing["borrowed_date"].as_str()
                .or_else(|| borrowing["borrow_date"].as_str()) // Handle both field names
                .unwrap_or("");
            let due_date = borrowing["due_date"].as_str().unwrap_or("");
            let returned_date = borrowing["returned_date"].as_str()
                .or_else(|| borrowing["return_date"].as_str()); // Handle both field names
            let status = borrowing["status"].as_str().unwrap_or("borrowed");
            let fine_amount = borrowing["fine_amount"].as_f64().unwrap_or(0.0);
            let notes = borrowing["notes"].as_str();
            let created_at = borrowing["created_at"].as_str();
            let updated_at = borrowing["updated_at"].as_str();
            
            let query = r#"
                INSERT OR REPLACE INTO borrowings (
                    id, student_id, book_id, borrowed_date, due_date, returned_date,
                    status, fine_amount, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#;
            
            match sqlx::query(query)
                .bind(id)
                .bind(student_id)
                .bind(book_id)
                .bind(borrowed_date)
                .bind(due_date)
                .bind(returned_date)
                .bind(status)
                .bind(fine_amount)
                .bind(notes)
                .bind(created_at)
                .bind(updated_at)
                .execute(&mut *tx)
                .await 
            {
                Ok(_) => batch_inserted += 1,
                Err(e) => {
                    if e.to_string().contains("FOREIGN KEY constraint failed") {
                        // Skip borrowings with missing student/book references
                        if total_inserted % 1000 == 0 {
                            println!("⚠️ Skipping borrowing {} - missing references", id);
                        }
                    } else {
                        println!("❌ Failed to insert borrowing {}: {}", id, e);
                    }
                },
            }
        }
        
        // Commit this batch
        match tx.commit().await {
            Ok(_) => {
                total_inserted += batch_inserted;
                println!("✅ Batch {} committed: {} borrowings (total: {})", batch_number, batch_inserted, total_inserted);
            },
            Err(e) => println!("❌ Batch {} commit failed: {}", batch_number, e),
        }
        
        // Move to next batch
        offset += batch_size;
        batch_number += 1;
        
        // Safety check
        if batch_number > 100 {
            println!("⚠️ Reached maximum batch limit (100) - stopping");
            break;
        }
    }
    
    pool.close().await;
    println!("✅ Complete borrowings sync finished: {} total records", total_inserted);
    Ok(total_inserted)
}

pub async fn sync_staff_from_supabase(limit: u32) -> Result<u32> {
    println!("👨‍💼 Starting staff sync with limit: {}", limit);
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Sync staff from Supabase
    let client = reqwest::Client::new();
    let url = if limit >= 1000 {
        // For very high limits, don't use limit parameter to get all records
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/staff?select=*".to_string()
    } else {
        format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/staff?select=*&limit={}", limit)
    };
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    println!("🔍 Staff API response status: {}", response.status());
    
    let mut inserted = 0;
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        
        println!("📊 Staff API returned: {} records", 
            json.as_array().map(|a| a.len()).unwrap_or(0));
        
        if let Some(staff_members) = json.as_array() {
            // Start a transaction for better performance
            let mut tx = pool.begin().await?;
            
            for staff in staff_members {
                let id = staff["id"].as_str().unwrap_or_default();
                let staff_id = staff["staff_id"].as_str()
                    .or_else(|| staff["id"].as_str())
                    .unwrap_or_default();
                let first_name = staff["first_name"].as_str().unwrap_or("Unknown");
                let last_name = staff["last_name"].as_str().unwrap_or("Unknown");
                let email = staff["email"].as_str();
                let phone = staff["phone"].as_str();
                let position = staff["position"].as_str()
                    .or_else(|| staff["role"].as_str())
                    .unwrap_or("librarian");
                let department = staff["department"].as_str();
                
                let query = r#"
                    INSERT OR REPLACE INTO staff (
                        id, staff_id, first_name, last_name, email, phone, position, department, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                match sqlx::query(query)
                    .bind(id)
                    .bind(staff_id)
                    .bind(first_name)
                    .bind(last_name)
                    .bind(email)
                    .bind(phone)
                    .bind(position)
                    .bind(department)
                    .execute(&mut *tx)
                    .await 
                {
                    Ok(_) => inserted += 1,
                    Err(e) => println!("❌ Failed to insert staff {} {}: {}", first_name, last_name, e),
                }
            }
            
            // Commit the transaction
            match tx.commit().await {
                Ok(_) => println!("✅ Transaction committed: {} staff", inserted),
                Err(e) => println!("❌ Transaction failed: {}", e),
            }
        }
    }
    
    pool.close().await;
    println!("✅ Staff sync completed: {} records", inserted);
    Ok(inserted)
}

pub async fn sync_classes_from_supabase() -> Result<u32> {
    println!("🏫 Starting classes sync");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Sync classes from Supabase
    let client = reqwest::Client::new();
    let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/classes?select=*";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let response = client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    println!("🔍 Classes API response status: {}", response.status());
    
    let mut inserted = 0;
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        
        println!("📊 Classes API returned: {} records", 
            json.as_array().map(|a| a.len()).unwrap_or(0));
        
        if let Some(classes) = json.as_array() {
            // Start a transaction for better performance
            let mut tx = pool.begin().await?;
            
            for class in classes {
                let id = class["id"].as_str().unwrap_or_default();
                let class_name = class["class_name"].as_str()
                    .or_else(|| class["name"].as_str())
                    .unwrap_or("Unknown Class");
                let form_level = class["form_level"].as_i64()
                    .or_else(|| class["level"].as_i64())
                    .unwrap_or(1);
                let class_section = class["class_section"].as_str()
                    .or_else(|| class["section"].as_str());
                
                let query = r#"
                    INSERT OR REPLACE INTO classes (
                        id, class_name, form_level, class_section, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                match sqlx::query(query)
                    .bind(id)
                    .bind(class_name)
                    .bind(form_level)
                    .bind(class_section)
                    .execute(&mut *tx)
                    .await 
                {
                    Ok(_) => inserted += 1,
                    Err(e) => println!("❌ Failed to insert class {}: {}", class_name, e),
                }
            }
            
            // Commit the transaction
            match tx.commit().await {
                Ok(_) => println!("✅ Transaction committed: {} classes", inserted),
                Err(e) => println!("❌ Transaction failed: {}", e),
            }
        }
    }
    
    pool.close().await;
    println!("✅ Classes sync completed: {} records", inserted);
    Ok(inserted)
}

pub async fn sync_book_copies_from_supabase(limit: u32) -> Result<u32> {
    println!("📚 Starting book copies sync with limit: {}", limit);
    
    // For large limits, use batching to get all records
    if limit >= 50000 {
        return sync_book_copies_in_batches().await;
    }
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Sync book copies from Supabase
    let client = reqwest::Client::new();
    let url = format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies?select=*&limit={}", limit);
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    println!("🔍 Book Copies API response status: {}", response.status());
    
    let mut inserted = 0;
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        
        println!("📊 Book Copies API returned: {} records", 
            json.as_array().map(|a| a.len()).unwrap_or(0));
        
        if let Some(book_copies) = json.as_array() {
            // Process in batches to manage memory for large datasets
            let batch_size = 5000;
            let total_records = book_copies.len();
            
            for (batch_index, batch) in book_copies.chunks(batch_size).enumerate() {
                // Start a new transaction for each batch
                let mut tx = pool.begin().await?;
                let mut batch_inserted = 0;
                
                for (index, copy) in batch.iter().enumerate() {
                    let global_index = batch_index * batch_size + index;
                    if global_index % 10000 == 0 {
                        println!("📝 Processing book copy {} of {}", global_index + 1, total_records);
                    }
                    
                    let id = copy["id"].as_str().unwrap_or_default();
                    let book_id = copy["book_id"].as_str();
                    let copy_number = copy["copy_number"].as_i64()
                        .or_else(|| copy["copy_id"].as_i64())
                        .unwrap_or(1);
                    let status = copy["status"].as_str().unwrap_or("available");
                    let condition = copy["condition"].as_str().unwrap_or("good");
                    let book_code = copy["book_code"].as_str().unwrap_or("");
                    let notes = copy["notes"].as_str();
                    let tracking_code = copy["tracking_code"].as_str();
                    
                    let query = r#"
                        INSERT OR REPLACE INTO book_copies (
                            id, book_id, copy_number, status, condition, 
                            book_code, notes, tracking_code, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    "#;
                    
                    match sqlx::query(query)
                        .bind(id)
                        .bind(book_id)
                        .bind(copy_number)
                        .bind(status)
                        .bind(condition)
                        .bind(book_code)
                        .bind(notes)
                        .bind(tracking_code)
                        .execute(&mut *tx)
                        .await 
                    {
                        Ok(_) => {
                            batch_inserted += 1;
                            inserted += 1;
                        },
                        Err(e) => {
                            if e.to_string().contains("FOREIGN KEY constraint failed") {
                                // Skip book copies that reference non-existent books
                                if global_index % 1000 == 0 {
                                    println!("⚠️ Skipping book copy {} - book {} not found locally", id, book_id.unwrap_or("null"));
                                }
                            } else {
                                println!("❌ Failed to insert book copy {}: {}", id, e);
                            }
                        },
                    }
                }
                
                // Commit this batch
                match tx.commit().await {
                    Ok(_) => println!("✅ Batch {} committed: {} book copies (total: {})", 
                        batch_index + 1, batch_inserted, inserted),
                    Err(e) => println!("❌ Batch {} commit failed: {}", batch_index + 1, e),
                }
            }
        }
    }
    
    pool.close().await;
    println!("✅ Book Copies sync completed: {} records", inserted);
    Ok(inserted)
}

// Enhanced book copies sync that fetches all records in batches
pub async fn sync_book_copies_in_batches() -> Result<u32> {
    println!("📚 Starting COMPLETE book copies sync in batches...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let batch_size = 5000; // Larger batch size for book copies
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut batch_number = 1;
    
    loop {
        println!("📖 Fetching book copies batch {} (offset: {})...", batch_number, offset);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ API request failed: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let book_copies = json.as_array().unwrap_or(&empty_vec);
        
        if book_copies.is_empty() {
            println!("✅ No more book copies to fetch - completed!");
            break;
        }
        
        println!("📚 Processing {} book copies in batch {}...", book_copies.len(), batch_number);
        
        // Process this batch in smaller sub-batches to avoid memory issues
        let sub_batch_size = 5000;
        for (sub_batch_index, sub_batch) in book_copies.chunks(sub_batch_size).enumerate() {
            let mut tx = pool.begin().await?;
            let mut sub_batch_inserted = 0;
            
            for copy in sub_batch {
                let id = copy["id"].as_str().unwrap_or_default();
                let book_id = copy["book_id"].as_str();
                let copy_number = copy["copy_number"].as_i64()
                    .or_else(|| copy["copy_id"].as_i64())
                    .unwrap_or(1);
                let status = copy["status"].as_str().unwrap_or("available");
                let condition = copy["condition"].as_str().unwrap_or("good");
                let book_code = copy["book_code"].as_str().unwrap_or("");
                let notes = copy["notes"].as_str();
                let tracking_code = copy["tracking_code"].as_str();
                
                let query = r#"
                    INSERT OR REPLACE INTO book_copies (
                        id, book_id, copy_number, status, condition, 
                        book_code, notes, tracking_code, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                match sqlx::query(query)
                    .bind(id)
                    .bind(book_id)
                    .bind(copy_number)
                    .bind(status)
                    .bind(condition)
                    .bind(book_code)
                    .bind(notes)
                    .bind(tracking_code)
                    .execute(&mut *tx)
                    .await 
                {
                    Ok(_) => sub_batch_inserted += 1,
                    Err(e) => {
                        if e.to_string().contains("FOREIGN KEY constraint failed") {
                            // Skip book copies that reference non-existent books
                            if total_inserted % 5000 == 0 {
                                println!("⚠️ Skipping book copy {} - book {} not found locally", id, book_id.unwrap_or("null"));
                            }
                        } else {
                            println!("❌ Failed to insert book copy {}: {}", id, e);
                        }
                    },
                }
            }
            
            // Commit this sub-batch
            match tx.commit().await {
                Ok(_) => {
                    total_inserted += sub_batch_inserted;
                    println!("✅ Sub-batch {}.{} committed: {} book copies (total: {})", 
                        batch_number, sub_batch_index + 1, sub_batch_inserted, total_inserted);
                },
                Err(e) => println!("❌ Sub-batch {}.{} commit failed: {}", batch_number, sub_batch_index + 1, e),
            }
        }
        
        // Move to next batch
        offset += batch_size;
        batch_number += 1;
        
        // Safety check to prevent infinite loops
        if batch_number > 100 {
            println!("⚠️ Reached maximum batch limit (100) - stopping");
            break;
        }
    }
    
    pool.close().await;
    println!("✅ Complete book copies sync finished: {} total records", total_inserted);
    Ok(total_inserted)
}

// Sync fines from Supabase
pub async fn sync_fines_from_supabase(limit: Option<u32>) -> Result<u32> {
    let actual_limit = limit.unwrap_or(300000);
    
    // For large limits, use batching
    if actual_limit >= 50000 {
        return sync_fines_in_batches().await;
    }
    
    println!("💰 Starting fines sync (limit: {})...", actual_limit);
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let url = format!(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/fines?select=*&limit={}",
        actual_limit
    );
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_msg = format!("API request failed: {}", response.status());
        println!("❌ {}", error_msg);
        return Err(anyhow::anyhow!(error_msg));
    }
    
    let json: serde_json::Value = response.json().await?;
    let empty_vec = vec![];
    let fines = json.as_array().unwrap_or(&empty_vec);
    
    let mut inserted = 0;
    let mut tx = pool.begin().await?;
    
    for fine in fines {
        let id = fine["id"].as_str().unwrap_or_default();
        let borrowing_id = fine["borrowing_id"].as_str();
        let student_id = fine["student_id"].as_str();
        let amount = fine["amount"].as_f64().unwrap_or(0.0);
        let reason = fine["reason"].as_str().unwrap_or("");
        let status = fine["status"].as_str().unwrap_or("unpaid");
        let applied_date = fine["applied_date"].as_str();
        let paid_date = fine["paid_date"].as_str();
        let created_at = fine["created_at"].as_str();
        let updated_at = fine["updated_at"].as_str();
        
        let query = r#"
            INSERT OR REPLACE INTO fines (
                id, borrowing_id, student_id, amount, reason, status,
                applied_date, paid_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;
        
        match sqlx::query(query)
            .bind(id)
            .bind(borrowing_id)
            .bind(student_id)
            .bind(amount)
            .bind(reason)
            .bind(status)
            .bind(applied_date)
            .bind(paid_date)
            .bind(created_at)
            .bind(updated_at)
            .execute(&mut *tx)
            .await 
        {
            Ok(_) => inserted += 1,
            Err(e) => println!("❌ Failed to insert fine {}: {}", id, e),
        }
    }
    
    tx.commit().await?;
    pool.close().await;
    println!("✅ Fines sync completed: {} records", inserted);
    Ok(inserted)
}

// Enhanced fines sync that fetches all records in batches
pub async fn sync_fines_in_batches() -> Result<u32> {
    println!("💰 Starting COMPLETE fines sync in batches...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let batch_size = 5000;
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut batch_number = 1;
    
    loop {
        println!("💰 Fetching fines batch {} (offset: {})...", batch_number, offset);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/fines?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ API request failed: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let fines = json.as_array().unwrap_or(&empty_vec);
        
        if fines.is_empty() {
            println!("✅ No more fines to fetch - completed!");
            break;
        }
        
        println!("💰 Processing {} fines in batch {}...", fines.len(), batch_number);
        
        let mut tx = pool.begin().await?;
        let mut batch_inserted = 0;
        
        for fine in fines {
            let id = fine["id"].as_str().unwrap_or_default();
            let borrowing_id = fine["borrowing_id"].as_str();
            let student_id = fine["student_id"].as_str();
            let amount = fine["amount"].as_f64().unwrap_or(0.0);
            let reason = fine["reason"].as_str().unwrap_or("");
            let status = fine["status"].as_str().unwrap_or("unpaid");
            let applied_date = fine["applied_date"].as_str();
            let paid_date = fine["paid_date"].as_str();
            let created_at = fine["created_at"].as_str();
            let updated_at = fine["updated_at"].as_str();
            
            let query = r#"
                INSERT OR REPLACE INTO fines (
                    id, borrowing_id, student_id, amount, reason, status,
                    applied_date, paid_date, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#;
            
            match sqlx::query(query)
                .bind(id)
                .bind(borrowing_id)
                .bind(student_id)
                .bind(amount)
                .bind(reason)
                .bind(status)
                .bind(applied_date)
                .bind(paid_date)
                .bind(created_at)
                .bind(updated_at)
                .execute(&mut *tx)
                .await 
            {
                Ok(_) => batch_inserted += 1,
                Err(e) => println!("❌ Failed to insert fine {}: {}", id, e),
            }
        }
        
        // Commit this batch
        match tx.commit().await {
            Ok(_) => {
                total_inserted += batch_inserted;
                println!("✅ Batch {} committed: {} fines (total: {})", batch_number, batch_inserted, total_inserted);
            },
            Err(e) => println!("❌ Batch {} commit failed: {}", batch_number, e),
        }
        
        // Move to next batch
        offset += batch_size;
        batch_number += 1;
        
        // Safety check
        if batch_number > 100 {
            println!("⚠️ Reached maximum batch limit (100) - stopping");
            break;
        }
    }
    
    pool.close().await;
    println!("✅ Complete fines sync finished: {} total records", total_inserted);
    Ok(total_inserted)
}

// Sync fine_settings from Supabase
pub async fn sync_fine_settings_from_supabase(limit: Option<u32>) -> Result<u32> {
    let actual_limit = limit.unwrap_or(300000);
    println!("⚙️ Starting fine settings sync (limit: {})...", actual_limit);
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let url = format!(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/fine_settings?select=*&limit={}",
        actual_limit
    );
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_msg = format!("API request failed: {}", response.status());
        println!("❌ {}", error_msg);
        return Err(anyhow::anyhow!(error_msg));
    }
    
    let json: serde_json::Value = response.json().await?;
    let empty_vec = vec![];
    let settings = json.as_array().unwrap_or(&empty_vec);
    
    let mut inserted = 0;
    let mut tx = pool.begin().await?;
    
    for setting in settings {
        let id = setting["id"].as_str().unwrap_or_default();
        let fine_type = setting["setting_name"].as_str().unwrap_or("");
        let amount_str = setting["setting_value"].as_str().unwrap_or("0");
        let amount = amount_str.parse::<f64>().unwrap_or(0.0);
        let description = setting["description"].as_str();
        let created_at = setting["created_at"].as_str();
        let updated_at = setting["updated_at"].as_str();
        
        let query = r#"
            INSERT OR REPLACE INTO fine_settings (
                id, fine_type, amount, description, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        "#;
        
        match sqlx::query(query)
            .bind(id)
            .bind(fine_type)
            .bind(amount)
            .bind(description)
            .bind(created_at)
            .bind(updated_at)
            .execute(&mut *tx)
            .await 
        {
            Ok(_) => inserted += 1,
            Err(e) => println!("❌ Failed to insert fine setting {}: {}", id, e),
        }
    }
    
    tx.commit().await?;
    pool.close().await;
    println!("✅ Fine settings sync completed: {} records", inserted);
    Ok(inserted)
}

// Sync group_borrowings from Supabase
pub async fn sync_group_borrowings_from_supabase(limit: Option<u32>) -> Result<u32> {
    let actual_limit = limit.unwrap_or(300000);
    
    // For large limits, use batching
    if actual_limit >= 50000 {
        return sync_group_borrowings_in_batches().await;
    }
    
    println!("👥 Starting group borrowings sync (limit: {})...", actual_limit);
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let url = format!(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/group_borrowings?select=*&limit={}",
        actual_limit
    );
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_msg = format!("API request failed: {}", response.status());
        println!("❌ {}", error_msg);
        return Err(anyhow::anyhow!(error_msg));
    }
    
    let json: serde_json::Value = response.json().await?;
    let empty_vec = vec![];
    let group_borrowings = json.as_array().unwrap_or(&empty_vec);
    
    let mut inserted = 0;
    let mut tx = pool.begin().await?;
    
    for borrowing in group_borrowings {
        let id = borrowing["id"].as_str().unwrap_or_default();
        let book_id = borrowing["book_id"].as_str();
        let book_copy_id = borrowing["book_copy_id"].as_str();
        let tracking_code = borrowing["tracking_code"].as_str();
        let borrowed_date = borrowing["borrowed_date"].as_str();
        let due_date = borrowing["due_date"].as_str();
        let returned_date = borrowing["returned_date"].as_str();
        let condition_at_issue = borrowing["condition_at_issue"].as_str().unwrap_or("good");
        let condition_at_return = borrowing["condition_at_return"].as_str();
        let fine_amount = borrowing["fine_amount"].as_f64().unwrap_or(0.0);
        let fine_paid = borrowing["fine_paid"].as_i64().unwrap_or(0);
        let notes = borrowing["notes"].as_str();
        let return_notes = borrowing["return_notes"].as_str();
        let status = borrowing["status"].as_str().unwrap_or("active");
        let is_lost = borrowing["is_lost"].as_i64().unwrap_or(0);
        let student_count = borrowing["student_count"].as_i64().unwrap_or(1);
        let issued_by = borrowing["issued_by"].as_str();
        let returned_by = borrowing["returned_by"].as_str();
        let created_at = borrowing["created_at"].as_str();
        let updated_at = borrowing["updated_at"].as_str();
        let student_ids = borrowing["student_ids"].as_str().unwrap_or("[]");
        
        let query = r#"
            INSERT OR REPLACE INTO group_borrowings (
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
    println!("✅ Group borrowings sync completed: {} records", inserted);
    Ok(inserted)
}

// Enhanced group borrowings sync that fetches all records in batches
pub async fn sync_group_borrowings_in_batches() -> Result<u32> {
    println!("👥 Starting COMPLETE group borrowings sync in batches...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let batch_size = 5000;
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut batch_number = 1;
    
    loop {
        println!("👥 Fetching group borrowings batch {} (offset: {})...", batch_number, offset);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/group_borrowings?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ API request failed: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let group_borrowings = json.as_array().unwrap_or(&empty_vec);
        
        if group_borrowings.is_empty() {
            println!("✅ No more group borrowings to fetch - completed!");
            break;
        }
        
        println!("👥 Processing {} group borrowings in batch {}...", group_borrowings.len(), batch_number);
        
        let mut tx = pool.begin().await?;
        let mut batch_inserted = 0;
        
        for borrowing in group_borrowings {
            let id = borrowing["id"].as_str().unwrap_or_default();
            let book_id = borrowing["book_id"].as_str();
            let book_copy_id = borrowing["book_copy_id"].as_str();
            let tracking_code = borrowing["tracking_code"].as_str();
            let borrowed_date = borrowing["borrowed_date"].as_str();
            let due_date = borrowing["due_date"].as_str();
            let returned_date = borrowing["returned_date"].as_str();
            let condition_at_issue = borrowing["condition_at_issue"].as_str().unwrap_or("good");
            let condition_at_return = borrowing["condition_at_return"].as_str();
            let fine_amount = borrowing["fine_amount"].as_f64().unwrap_or(0.0);
            let fine_paid = borrowing["fine_paid"].as_i64().unwrap_or(0);
            let notes = borrowing["notes"].as_str();
            let return_notes = borrowing["return_notes"].as_str();
            let status = borrowing["status"].as_str().unwrap_or("active");
            let is_lost = borrowing["is_lost"].as_i64().unwrap_or(0);
            let student_count = borrowing["student_count"].as_i64().unwrap_or(1);
            let issued_by = borrowing["issued_by"].as_str();
            let returned_by = borrowing["returned_by"].as_str();
            let created_at = borrowing["created_at"].as_str();
            let updated_at = borrowing["updated_at"].as_str();
            let student_ids = borrowing["student_ids"].as_str().unwrap_or("[]");
            
            let query = r#"
                INSERT OR REPLACE INTO group_borrowings (
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
                Ok(_) => batch_inserted += 1,
                Err(e) => println!("❌ Failed to insert group borrowing {}: {}", id, e),
            }
        }
        
        // Commit this batch
        match tx.commit().await {
            Ok(_) => {
                total_inserted += batch_inserted;
                println!("✅ Batch {} committed: {} group borrowings (total: {})", batch_number, batch_inserted, total_inserted);
            },
            Err(e) => println!("❌ Batch {} commit failed: {}", batch_number, e),
        }
        
        // Move to next batch
        offset += batch_size;
        batch_number += 1;
        
        // Safety check
        if batch_number > 100 {
            println!("⚠️ Reached maximum batch limit (100) - stopping");
            break;
        }
    }
    
    pool.close().await;
    println!("✅ Complete group borrowings sync finished: {} total records", total_inserted);
    Ok(total_inserted)
}

// Sync theft_reports from Supabase
pub async fn sync_theft_reports_from_supabase(limit: Option<u32>) -> Result<u32> {
    let actual_limit = limit.unwrap_or(300000);
    
    // For large limits, use batching
    if actual_limit >= 50000 {
        return sync_theft_reports_in_batches().await;
    }
    
    println!("🚨 Starting theft reports sync (limit: {})...", actual_limit);
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let url = format!(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/theft_reports?select=*&limit={}",
        actual_limit
    );
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_msg = format!("API request failed: {}", response.status());
        println!("❌ {}", error_msg);
        return Err(anyhow::anyhow!(error_msg));
    }
    
    let json: serde_json::Value = response.json().await?;
    let empty_vec = vec![];
    let theft_reports = json.as_array().unwrap_or(&empty_vec);
    
    let mut inserted = 0;
    let mut tx = pool.begin().await?;
    
    for report in theft_reports {
        let id = report["id"].as_str().unwrap_or_default();
        let book_id = report["book_id"].as_str();
        let student_id = report["student_id"].as_str();
        let reported_by = report["reported_by"].as_str();
        let report_date = report["report_date"].as_str();
        let description = report["description"].as_str().unwrap_or("");
        let status = report["status"].as_str().unwrap_or("reported");
        let resolved_date = report["resolved_date"].as_str();
        let resolution_notes = report["resolution_notes"].as_str();
        let created_at = report["created_at"].as_str();
        let updated_at = report["updated_at"].as_str();
        
        let query = r#"
            INSERT OR REPLACE INTO theft_reports (
                id, book_id, student_id, reported_by, report_date, description,
                status, resolved_date, resolution_notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;
        
        match sqlx::query(query)
            .bind(id)
            .bind(book_id)
            .bind(student_id)
            .bind(reported_by)
            .bind(report_date)
            .bind(description)
            .bind(status)
            .bind(resolved_date)
            .bind(resolution_notes)
            .bind(created_at)
            .bind(updated_at)
            .execute(&mut *tx)
            .await 
        {
            Ok(_) => inserted += 1,
            Err(e) => println!("❌ Failed to insert theft report {}: {}", id, e),
        }
    }
    
    tx.commit().await?;
    pool.close().await;
    println!("✅ Theft reports sync completed: {} records", inserted);
    Ok(inserted)
}

// Enhanced theft reports sync that fetches all records in batches
pub async fn sync_theft_reports_in_batches() -> Result<u32> {
    println!("🚨 Starting COMPLETE theft reports sync in batches...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let batch_size = 5000;
    let mut offset = 0;
    let mut total_inserted = 0;
    let mut batch_number = 1;
    
    loop {
        println!("🚨 Fetching theft reports batch {} (offset: {})...", batch_number, offset);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/theft_reports?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ API request failed: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let theft_reports = json.as_array().unwrap_or(&empty_vec);
        
        if theft_reports.is_empty() {
            println!("✅ No more theft reports to fetch - completed!");
            break;
        }
        
        println!("🚨 Processing {} theft reports in batch {}...", theft_reports.len(), batch_number);
        
        let mut tx = pool.begin().await?;
        let mut batch_inserted = 0;
        
        for report in theft_reports {
            let id = report["id"].as_str().unwrap_or_default();
            let book_id = report["book_id"].as_str();
            let student_id = report["student_id"].as_str();
            let reported_by = report["reported_by"].as_str();
            let report_date = report["report_date"].as_str();
            let description = report["description"].as_str().unwrap_or("");
            let status = report["status"].as_str().unwrap_or("reported");
            let resolved_date = report["resolved_date"].as_str();
            let resolution_notes = report["resolution_notes"].as_str();
            let created_at = report["created_at"].as_str();
            let updated_at = report["updated_at"].as_str();
            
            let query = r#"
                INSERT OR REPLACE INTO theft_reports (
                    id, book_id, student_id, reported_by, report_date, description,
                    status, resolved_date, resolution_notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#;
            
            match sqlx::query(query)
                .bind(id)
                .bind(book_id)
                .bind(student_id)
                .bind(reported_by)
                .bind(report_date)
                .bind(description)
                .bind(status)
                .bind(resolved_date)
                .bind(resolution_notes)
                .bind(created_at)
                .bind(updated_at)
                .execute(&mut *tx)
                .await 
            {
                Ok(_) => batch_inserted += 1,
                Err(e) => println!("❌ Failed to insert theft report {}: {}", id, e),
            }
        }
        
        // Commit this batch
        match tx.commit().await {
            Ok(_) => {
                total_inserted += batch_inserted;
                println!("✅ Batch {} committed: {} theft reports (total: {})", batch_number, batch_inserted, total_inserted);
            },
            Err(e) => println!("❌ Batch {} commit failed: {}", batch_number, e),
        }
        
        // Move to next batch
        offset += batch_size;
        batch_number += 1;
        
        // Safety check
        if batch_number > 100 {
            println!("⚠️ Reached maximum batch limit (100) - stopping");
            break;
        }
    }
    
    pool.close().await;
    println!("✅ Complete theft reports sync finished: {} total records", total_inserted);
    Ok(total_inserted)
}

// Comprehensive sync function for ALL database tables
pub async fn pull_all_database_from_supabase() -> Result<()> {
    println!("🚀 Starting COMPLETE DATABASE PULL from Supabase with ALL TABLES...");
    
    let mut total_records = 0;
    let start_time = std::time::Instant::now();
    
    // Sync all tables in logical order (dependencies first)
    println!("\n📋 === PHASE 1: BASIC DATA ===");
    
    // 1. Categories (no dependencies)
    match sync_categories_from_supabase().await {
        Ok(count) => {
            total_records += count;
            println!("✅ Categories: {} records", count);
        },
        Err(e) => println!("❌ Categories failed: {}", e),
    }
    
    // 2. Classes (no dependencies)
    match sync_classes_from_supabase().await {
        Ok(count) => {
            total_records += count;
            println!("✅ Classes: {} records", count);
        },
        Err(e) => println!("❌ Classes failed: {}", e),
    }
    
    // 3. Fine Settings (no dependencies)
    match sync_fine_settings_from_supabase(Some(300000)).await {
        Ok(count) => {
            total_records += count;
            println!("✅ Fine Settings: {} records", count);
        },
        Err(e) => println!("❌ Fine Settings failed: {}", e),
    }
    
    println!("\n📚 === PHASE 2: PEOPLE DATA ===");
    
    // 4. Students (depends on classes) - BATCHED FOR LARGE DATASETS
    match sync_students_in_batches().await {
        Ok(count) => {
            total_records += count;
            println!("✅ Students (Batched): {} records", count);
        },
        Err(e) => println!("❌ Students failed: {}", e),
    }
    
    // 5. Staff (no dependencies) - ENHANCED WITH PROPER SCHEMA
    match sync_staff_from_supabase(300000).await {
        Ok(count) => {
            total_records += count;
            println!("✅ Staff: {} records", count);
        },
        Err(e) => println!("❌ Staff failed: {}", e),
    }
    
    println!("\n📖 === PHASE 3: INVENTORY DATA ===");
    
    // 6. Books (depends on categories) - BATCHED FOR LARGE DATASETS
    match sync_books_in_batches().await {
        Ok(count) => {
            total_records += count;
            println!("✅ Books (Batched): {} records", count);
        },
        Err(e) => println!("❌ Books failed: {}", e),
    }
    
    // 7. Book Copies (depends on books) - BATCHED FOR MASSIVE DATASET: 90,000+ records
    match sync_book_copies_in_batches().await {
        Ok(count) => {
            total_records += count;
            println!("✅ Book Copies (Batched): {} records", count);
        },
        Err(e) => println!("❌ Book Copies failed: {}", e),
    }
    
    println!("\n📋 === PHASE 4: TRANSACTION DATA ===");
    
    // 8. Borrowings (depends on students and books) - BATCHED
    match sync_borrowings_in_batches().await {
        Ok(count) => {
            total_records += count;
            println!("✅ Borrowings (Batched): {} records", count);
        },
        Err(e) => println!("❌ Borrowings failed: {}", e),
    }
    
    // 9. Group Borrowings (depends on books and staff) - BATCHED
    match sync_group_borrowings_in_batches().await {
        Ok(count) => {
            total_records += count;
            println!("✅ Group Borrowings (Batched): {} records", count);
        },
        Err(e) => println!("❌ Group Borrowings failed: {}", e),
    }
    
    println!("\n💰 === PHASE 5: FINANCIAL DATA ===");
    
    // 10. Fines (depends on borrowings and students) - BATCHED
    match sync_fines_in_batches().await {
        Ok(count) => {
            total_records += count;
            println!("✅ Fines (Batched): {} records", count);
        },
        Err(e) => println!("❌ Fines failed: {}", e),
    }
    
    println!("\n🚨 === PHASE 6: SECURITY DATA ===");
    
    // 11. Theft Reports (depends on books and students) - BATCHED
    match sync_theft_reports_in_batches().await {
        Ok(count) => {
            total_records += count;
            println!("✅ Theft Reports (Batched): {} records", count);
        },
        Err(e) => println!("❌ Theft Reports failed: {}", e),
    }
    
    let duration = start_time.elapsed();
    
    println!("\n🎉 === COMPLETE DATABASE PULL FINISHED ===");
    println!("📊 Total records synchronized: {}", total_records);
    println!("⏱️ Total time: {:.2}s", duration.as_secs_f64());
    if duration.as_secs_f64() > 0.0 {
        println!("🚀 Average speed: {:.0} records/second", total_records as f64 / duration.as_secs_f64());
    }
    println!("✨ ALL 11 TABLE TYPES SYNCHRONIZED WITH BATCHING SUPPORT");
    
    Ok(())
}
