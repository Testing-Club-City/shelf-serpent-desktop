use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use std::path::PathBuf;
use tokio;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔄 Starting fine_settings schema migration...");
    
    // Connect to database
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    
    if !db_path.exists() {
        println!("❌ Database not found at: {:?}", db_path);
        println!("💡 Make sure to run your Tauri app first to create the database");
        return Ok(());
    }
    
    println!("📂 Connecting to database: {:?}", db_path);
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Check if fine_settings table exists
    let table_exists = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='fine_settings'")
        .fetch_optional(&pool)
        .await?
        .is_some();
    
    if !table_exists {
        println!("⚠️ fine_settings table doesn't exist, creating it...");
        
        sqlx::query(r#"
            CREATE TABLE fine_settings (
                id TEXT PRIMARY KEY,
                fine_type TEXT,
                amount_per_day REAL DEFAULT 0.0,
                max_fine_amount REAL,
                grace_period_days INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at TEXT,
                updated_at TEXT,
                synced INTEGER DEFAULT 0,
                sync_version INTEGER DEFAULT 1,
                deleted BOOLEAN DEFAULT 0
            )
        "#)
        .execute(&pool)
        .await?;
        
        // Insert default fine settings
        sqlx::query(r#"
            INSERT INTO fine_settings (
                id, fine_type, amount_per_day, max_fine_amount, grace_period_days, 
                is_active, created_at, updated_at, synced, sync_version, deleted
            ) VALUES 
            ('default-overdue', 'overdue', 1.0, 50.0, 3, 1, datetime('now'), datetime('now'), 0, 1, 0),
            ('default-lost', 'lost', 10.0, 100.0, 0, 1, datetime('now'), datetime('now'), 0, 1, 0),
            ('default-damaged', 'damaged', 5.0, 75.0, 0, 1, datetime('now'), datetime('now'), 0, 1, 0)
        "#)
        .execute(&pool)
        .await?;
        
        println!("✅ Created fine_settings table with default records");
        return Ok(());
    }
    
    // Check current table structure
    let table_info = sqlx::query("PRAGMA table_info(fine_settings)")
        .fetch_all(&pool)
        .await?;
    
    let mut has_amount_per_day = false;
    let mut has_daily_rate = false;
    let mut has_max_fine_amount = false;
    let mut has_grace_period_days = false;
    let mut has_fine_type = false;
    
    println!("📊 Current fine_settings columns:");
    for row in &table_info {
        let column_name: String = row.get("name");
        println!("   - {}", column_name);
        
        match column_name.as_str() {
            "amount_per_day" => has_amount_per_day = true,
            "daily_rate" => has_daily_rate = true,
            "max_fine_amount" => has_max_fine_amount = true,
            "grace_period_days" => has_grace_period_days = true,
            "fine_type" => has_fine_type = true,
            _ => {}
        }
    }
    
    println!("\n🔍 Schema Analysis:");
    println!("   - amount_per_day: {}", has_amount_per_day);
    println!("   - daily_rate: {}", has_daily_rate);
    println!("   - max_fine_amount: {}", has_max_fine_amount);
    println!("   - grace_period_days: {}", has_grace_period_days);
    println!("   - fine_type: {}", has_fine_type);
    
    let mut changes_made = false;
    
    // Add amount_per_day column if missing
    if !has_amount_per_day {
        println!("\n🔧 Adding amount_per_day column...");
        sqlx::query("ALTER TABLE fine_settings ADD COLUMN amount_per_day REAL DEFAULT 0.0")
            .execute(&pool)
            .await?;
        
        if has_daily_rate {
            println!("📋 Migrating data from daily_rate to amount_per_day...");
            let migrated = sqlx::query("UPDATE fine_settings SET amount_per_day = daily_rate WHERE daily_rate IS NOT NULL")
                .execute(&pool)
                .await?
                .rows_affected();
            println!("✅ Migrated {} records", migrated);
        } else {
            println!("📋 Setting default amount_per_day values...");
            let updated = sqlx::query("UPDATE fine_settings SET amount_per_day = 1.0 WHERE amount_per_day IS NULL OR amount_per_day = 0")
                .execute(&pool)
                .await?
                .rows_affected();
            println!("✅ Set defaults for {} records", updated);
        }
        changes_made = true;
    }
    
    // Add max_fine_amount column if missing
    if !has_max_fine_amount {
        println!("\n🔧 Adding max_fine_amount column...");
        sqlx::query("ALTER TABLE fine_settings ADD COLUMN max_fine_amount REAL")
            .execute(&pool)
            .await?;
        
        // Try to migrate from max_fine if it exists
        let has_max_fine = table_info.iter().any(|row| {
            let column_name: String = row.get("name");
            column_name == "max_fine"
        });
        
        if has_max_fine {
            println!("📋 Migrating data from max_fine to max_fine_amount...");
            let migrated = sqlx::query("UPDATE fine_settings SET max_fine_amount = max_fine WHERE max_fine IS NOT NULL")
                .execute(&pool)
                .await?
                .rows_affected();
            println!("✅ Migrated {} records", migrated);
        }
        changes_made = true;
    }
    
    // Add grace_period_days column if missing
    if !has_grace_period_days {
        println!("\n🔧 Adding grace_period_days column...");
        sqlx::query("ALTER TABLE fine_settings ADD COLUMN grace_period_days INTEGER DEFAULT 0")
            .execute(&pool)
            .await?;
        
        // Try to migrate from grace_period if it exists
        let has_grace_period = table_info.iter().any(|row| {
            let column_name: String = row.get("name");
            column_name == "grace_period"
        });
        
        if has_grace_period {
            println!("📋 Migrating data from grace_period to grace_period_days...");
            let migrated = sqlx::query("UPDATE fine_settings SET grace_period_days = grace_period WHERE grace_period IS NOT NULL")
                .execute(&pool)
                .await?
                .rows_affected();
            println!("✅ Migrated {} records", migrated);
        }
        changes_made = true;
    }
    
    // Add fine_type column if missing
    if !has_fine_type {
        println!("\n🔧 Adding fine_type column...");
        sqlx::query("ALTER TABLE fine_settings ADD COLUMN fine_type TEXT")
            .execute(&pool)
            .await?;
        
        // Try to migrate from type if it exists
        let has_type = table_info.iter().any(|row| {
            let column_name: String = row.get("name");
            column_name == "type"
        });
        
        if has_type {
            println!("📋 Migrating data from type to fine_type...");
            let migrated = sqlx::query("UPDATE fine_settings SET fine_type = type WHERE type IS NOT NULL")
                .execute(&pool)
                .await?
                .rows_affected();
            println!("✅ Migrated {} records", migrated);
        }
        changes_made = true;
    }
    
    // Ensure other required columns exist
    let required_columns = vec![
        ("is_active", "BOOLEAN DEFAULT 1"),
        ("synced", "INTEGER DEFAULT 0"),
        ("sync_version", "INTEGER DEFAULT 1"),
        ("deleted", "BOOLEAN DEFAULT 0"),
    ];
    
    for (column, column_type) in required_columns {
        let has_column = table_info.iter().any(|row| {
            let column_name: String = row.get("name");
            column_name == column
        });
        
        if !has_column {
            println!("\n🔧 Adding {} column...", column);
            sqlx::query(&format!("ALTER TABLE fine_settings ADD COLUMN {} {}", column, column_type))
                .execute(&pool)
                .await?;
            changes_made = true;
        }
    }
    
    if changes_made {
        // Mark all records as unsynced for re-upload
        println!("\n🔄 Marking all records as unsynced for re-upload...");
        let marked = sqlx::query("UPDATE fine_settings SET synced = 0")
            .execute(&pool)
            .await?
            .rows_affected();
        println!("✅ Marked {} records for re-sync", marked);
    }
    
    // Verify final schema
    println!("\n📊 Final Schema Verification:");
    let final_info = sqlx::query("PRAGMA table_info(fine_settings)")
        .fetch_all(&pool)
        .await?;
    
    for row in &final_info {
        let column_name: String = row.get("name");
        let column_type: String = row.get("type");
        println!("   ✅ {} ({})", column_name, column_type);
    }
    
    // Show record count
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM fine_settings")
        .fetch_one(&pool)
        .await?;
    
    println!("\n🎉 Migration completed successfully!");
    println!("📊 fine_settings table now has {} records", count);
    
    if changes_made {
        println!("🔄 Schema updated to match Supabase requirements");
        println!("✅ All records marked for re-sync");
        println!("🎯 Your fine_settings sync should now work without errors!");
    } else {
        println!("✅ Schema was already correct - no changes needed");
    }
    
    Ok(())
}
