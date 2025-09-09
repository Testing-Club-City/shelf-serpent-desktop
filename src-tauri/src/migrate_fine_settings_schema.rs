use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use std::path::PathBuf;

/// Migrate local fine_settings table to match Supabase schema
pub async fn migrate_fine_settings_to_supabase_schema() -> Result<()> {
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    println!("🔄 Migrating fine_settings table to match Supabase schema...");
    
    // Check if the table exists and what columns it has
    let table_info = sqlx::query("PRAGMA table_info(fine_settings)")
        .fetch_all(&pool)
        .await?;
    
    let mut has_amount_per_day = false;
    let mut has_daily_rate = false;
    let mut has_max_fine_amount = false;
    let mut has_grace_period_days = false;
    
    for row in &table_info {
        let column_name: String = row.get("name");
        match column_name.as_str() {
            "amount_per_day" => has_amount_per_day = true,
            "daily_rate" => has_daily_rate = true,
            "max_fine_amount" => has_max_fine_amount = true,
            "grace_period_days" => has_grace_period_days = true,
            _ => {}
        }
    }
    
    println!("📊 Current fine_settings columns:");
    println!("   - amount_per_day: {}", has_amount_per_day);
    println!("   - daily_rate: {}", has_daily_rate);
    println!("   - max_fine_amount: {}", has_max_fine_amount);
    println!("   - grace_period_days: {}", has_grace_period_days);
    
    // Create a new table with the correct Supabase schema
    println!("🏗️ Creating new fine_settings table with Supabase schema...");
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS fine_settings_new (
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
    
    // Copy data from old table to new table, mapping columns appropriately
    println!("📋 Copying data with column mapping...");
    
    if has_daily_rate && !has_amount_per_day {
        // Map daily_rate -> amount_per_day
        sqlx::query(r#"
            INSERT INTO fine_settings_new (
                id, fine_type, amount_per_day, max_fine_amount, grace_period_days, 
                is_active, created_at, updated_at, synced, sync_version, deleted
            )
            SELECT 
                id, 
                COALESCE(fine_type, type) as fine_type,
                COALESCE(daily_rate, 0.0) as amount_per_day,
                COALESCE(max_fine_amount, max_fine) as max_fine_amount,
                COALESCE(grace_period_days, grace_period, 0) as grace_period_days,
                COALESCE(is_active, 1) as is_active,
                created_at,
                updated_at,
                COALESCE(synced, 0) as synced,
                COALESCE(sync_version, 1) as sync_version,
                COALESCE(deleted, 0) as deleted
            FROM fine_settings
        "#)
        .execute(&pool)
        .await?;
    } else if has_amount_per_day {
        // Already has correct column, just copy
        sqlx::query(r#"
            INSERT INTO fine_settings_new (
                id, fine_type, amount_per_day, max_fine_amount, grace_period_days, 
                is_active, created_at, updated_at, synced, sync_version, deleted
            )
            SELECT 
                id, 
                COALESCE(fine_type, type) as fine_type,
                amount_per_day,
                COALESCE(max_fine_amount, max_fine) as max_fine_amount,
                COALESCE(grace_period_days, grace_period, 0) as grace_period_days,
                COALESCE(is_active, 1) as is_active,
                created_at,
                updated_at,
                COALESCE(synced, 0) as synced,
                COALESCE(sync_version, 1) as sync_version,
                COALESCE(deleted, 0) as deleted
            FROM fine_settings
        "#)
        .execute(&pool)
        .await?;
    } else {
        // Create default records if no data exists
        println!("⚠️ No existing fine_settings data found, creating defaults...");
        
        sqlx::query(r#"
            INSERT INTO fine_settings_new (
                id, fine_type, amount_per_day, max_fine_amount, grace_period_days, 
                is_active, created_at, updated_at, synced, sync_version, deleted
            ) VALUES 
            ('default-overdue', 'overdue', 1.0, 50.0, 3, 1, datetime('now'), datetime('now'), 0, 1, 0),
            ('default-lost', 'lost', 10.0, 100.0, 0, 1, datetime('now'), datetime('now'), 0, 1, 0),
            ('default-damaged', 'damaged', 5.0, 75.0, 0, 1, datetime('now'), datetime('now'), 0, 1, 0)
        "#)
        .execute(&pool)
        .await?;
    }
    
    // Drop old table and rename new one
    println!("🔄 Replacing old table with new schema...");
    
    sqlx::query("DROP TABLE IF EXISTS fine_settings_backup")
        .execute(&pool)
        .await?;
    
    sqlx::query("ALTER TABLE fine_settings RENAME TO fine_settings_backup")
        .execute(&pool)
        .await?;
    
    sqlx::query("ALTER TABLE fine_settings_new RENAME TO fine_settings")
        .execute(&pool)
        .await?;
    
    // Verify the migration
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM fine_settings")
        .fetch_one(&pool)
        .await?;
    
    println!("✅ Migration completed successfully!");
    println!("📊 fine_settings table now has {} records with Supabase-compatible schema", count);
    println!("🗑️ Old table backed up as 'fine_settings_backup'");
    
    // Mark all records as unsynced so they get uploaded with new schema
    sqlx::query("UPDATE fine_settings SET synced = 0")
        .execute(&pool)
        .await?;
    
    println!("🔄 Marked all fine_settings as unsynced for re-upload");
    
    Ok(())
}
