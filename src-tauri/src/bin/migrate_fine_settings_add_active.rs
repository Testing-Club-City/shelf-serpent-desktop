use rusqlite::{Connection, Result};
use std::path::PathBuf;

fn main() -> Result<()> {
    println!("🔧 Starting migration: Adding is_active column to fine_settings table");

    // Get the database path
    let db_path = get_database_path();
    println!("📂 Database path: {}", db_path.display());

    // Open connection
    let mut conn = Connection::open(&db_path)?;
    
    // Start transaction
    let tx = conn.transaction()?;
    
    // Check if column already exists
    let column_exists: bool = tx.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('fine_settings') WHERE name='is_active'",
        [],
        |row| {
            let count: i32 = row.get(0)?;
            Ok(count > 0)
        }
    )?;

    if column_exists {
        println!("✅ Column 'is_active' already exists in fine_settings table");
    } else {
        println!("➕ Adding 'is_active' column to fine_settings table...");
        
        // Add the is_active column with default value of 1 (active)
        tx.execute(
            "ALTER TABLE fine_settings ADD COLUMN is_active INTEGER DEFAULT 1 NOT NULL",
            [],
        )?;
        
        println!("✅ Column 'is_active' added successfully");
        
        // Update all existing rows to be active by default
        tx.execute(
            "UPDATE fine_settings SET is_active = 1 WHERE is_active IS NULL",
            [],
        )?;
        
        println!("✅ Updated all existing fine settings to active");
    }
    
    // Commit transaction
    tx.commit()?;
    
    println!("✅ Migration completed successfully!");
    println!("\n📊 Current fine_settings schema:");
    
    // Display the updated schema
    let mut stmt = conn.prepare("SELECT name, type FROM pragma_table_info('fine_settings')")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    
    for row in rows {
        let (name, type_) = row?;
        println!("  - {}: {}", name, type_);
    }
    
    Ok(())
}

fn get_database_path() -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop(); // Go up from src-tauri
    path.push("library.db");
    path
}
