use rusqlite::{Connection, Result};
use std::path::PathBuf;

fn main() -> Result<()> {
    println!("🔍 Checking fine_settings table schema...");
    
    // Get the database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    println!("📂 Database path: {:?}", db_path);
    
    if !db_path.exists() {
        println!("❌ Database file not found at: {:?}", db_path);
        return Ok(());
    }
    
    let conn = Connection::open(&db_path)?;
    
    // Check table schema
    println!("\n📋 Fine Settings Table Schema:");
    let mut stmt = conn.prepare("PRAGMA table_info(fine_settings)")?;
    let column_info = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(1)?, // column name
            row.get::<_, String>(2)?, // data type
            row.get::<_, i32>(3)?,    // not null
            row.get::<_, Option<String>>(4)?, // default value
            row.get::<_, i32>(5)?,    // primary key
        ))
    })?;
    
    println!("Columns:");
    for column in column_info {
        let (name, data_type, not_null, default_val, is_pk) = column?;
        println!("  - {} {} {} {} {}", 
            name, 
            data_type,
            if not_null == 1 { "NOT NULL" } else { "NULL" },
            default_val.map(|d| format!("DEFAULT {}", d)).unwrap_or_default(),
            if is_pk == 1 { "PRIMARY KEY" } else { "" }
        );
    }
    
    // Check actual data
    println!("\n📊 Sample fine_settings data:");
    let mut stmt = conn.prepare("SELECT * FROM fine_settings LIMIT 3")?;
    let column_names: Vec<String> = stmt.column_names().iter().map(|&s| s.to_string()).collect();
    println!("Column names: {:?}", column_names);
    
    let rows = stmt.query_map([], |row| {
        let mut values = Vec::new();
        for i in 0..column_names.len() {
            let value: rusqlite::types::Value = row.get(i)?;
            values.push(format!("{:?}", value));
        }
        Ok(values)
    })?;
    
    for (i, row) in rows.enumerate() {
        if i < 3 {
            println!("Row {}: {:?}", i + 1, row?);
        }
    }
    
    // Check if daily_rate column exists
    let has_daily_rate = column_names.contains(&"daily_rate".to_string());
    let has_amount = column_names.contains(&"amount".to_string());
    
    println!("\n🔍 Schema Analysis:");
    println!("  - Has 'daily_rate' column: {}", has_daily_rate);
    println!("  - Has 'amount' column: {}", has_amount);
    
    if has_daily_rate && !has_amount {
        println!("\n⚠️ Issue found: Local has 'daily_rate' but Supabase expects 'amount'");
        println!("💡 Solution: Rename 'daily_rate' to 'amount' or add 'amount' column");
    } else if has_daily_rate && has_amount {
        println!("\n⚠️ Issue found: Both 'daily_rate' and 'amount' columns exist");
        println!("💡 Solution: Remove 'daily_rate' column and use only 'amount'");
    } else if !has_amount {
        println!("\n⚠️ Issue found: Missing 'amount' column that Supabase expects");
        println!("💡 Solution: Add 'amount' column");
    } else {
        println!("\n✅ Schema looks correct - 'amount' column exists");
    }
    
    Ok(())
}
