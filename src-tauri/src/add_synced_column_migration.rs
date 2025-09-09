use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use std::path::PathBuf;

/// Add the missing 'synced' column to tables that need it for bidirectional sync
pub async fn add_synced_columns() -> Result<()> {
    println!("🔧 Adding missing 'synced' columns for bidirectional sync...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // List of tables that need the synced column
    let tables_to_update = vec![
        "categories",
        "classes", 
        "books",
        "students",
        "staff",
        "borrowings",
        "book_copies",
        "fines",
        "fine_settings",
        "group_borrowings",
        "theft_reports"
    ];
    
    for table_name in tables_to_update {
        println!("🔧 Checking table: {}", table_name);
        
        // Check if synced column already exists
        let column_exists = sqlx::query(
            "SELECT COUNT(*) as count FROM pragma_table_info(?) WHERE name = 'synced'"
        )
        .bind(table_name)
        .fetch_one(&pool)
        .await;
        
        match column_exists {
            Ok(row) => {
                let count: i64 = row.get("count");
                if count == 0 {
                    // Add the synced column
                    let alter_query = format!(
                        "ALTER TABLE {} ADD COLUMN synced INTEGER DEFAULT 0", 
                        table_name
                    );
                    
                    match sqlx::query(&alter_query).execute(&pool).await {
                        Ok(_) => {
                            println!("✅ Added 'synced' column to {}", table_name);
                        },
                        Err(e) => {
                            println!("⚠️ Failed to add 'synced' column to {}: {}", table_name, e);
                        }
                    }
                } else {
                    println!("✅ 'synced' column already exists in {}", table_name);
                }
            },
            Err(e) => {
                println!("❌ Failed to check {} table: {}", table_name, e);
            }
        }
        
        // Also add sync_version column if it doesn't exist
        let version_column_exists = sqlx::query(
            "SELECT COUNT(*) as count FROM pragma_table_info(?) WHERE name = 'sync_version'"
        )
        .bind(table_name)
        .fetch_one(&pool)
        .await;
        
        match version_column_exists {
            Ok(row) => {
                let count: i64 = row.get("count");
                if count == 0 {
                    let alter_query = format!(
                        "ALTER TABLE {} ADD COLUMN sync_version INTEGER DEFAULT 1", 
                        table_name
                    );
                    
                    match sqlx::query(&alter_query).execute(&pool).await {
                        Ok(_) => {
                            println!("✅ Added 'sync_version' column to {}", table_name);
                        },
                        Err(e) => {
                            println!("⚠️ Failed to add 'sync_version' column to {}: {}", table_name, e);
                        }
                    }
                } else {
                    println!("✅ 'sync_version' column already exists in {}", table_name);
                }
            },
            Err(e) => {
                println!("❌ Failed to check sync_version for {} table: {}", table_name, e);
            }
        }
    }
    
    pool.close().await;
    println!("🎉 Database migration completed!");
    
    Ok(())
}
