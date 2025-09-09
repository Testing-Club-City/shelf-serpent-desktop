use std::path::Path;

fn main() {
    let db_path = Path::new(&std::env::var("APPDATA").unwrap())
        .join("library-management-system")
        .join("library.db");
    
    println!("Database path: {:?}", db_path);
    
    if db_path.exists() {
        println!("✓ Database file exists");
        let metadata = std::fs::metadata(&db_path).unwrap();
        println!("✓ File size: {} bytes", metadata.len());
        println!("✓ Last modified: {:?}", metadata.modified().unwrap());
        
        // Try to open and read the database
        match rusqlite::Connection::open(&db_path) {
            Ok(conn) => {
                println!("✓ Successfully opened database");
                
                // Check tables
                match conn.prepare("SELECT name FROM sqlite_master WHERE type='table';") {
                    Ok(mut stmt) => {
                        println!("\n📋 Tables in database:");
                        let table_names = stmt.query_map([], |row| {
                            Ok(row.get::<_, String>(0)?)
                        }).unwrap();
                        
                        for table_name in table_names {
                            if let Ok(name) = table_name {
                                println!("  - {}", name);
                                
                                // Count rows in each table
                                let count_query = format!("SELECT COUNT(*) FROM {}", name);
                                match conn.query_row(&count_query, [], |row| {
                                    Ok(row.get::<_, i32>(0)?)
                                }) {
                                    Ok(count) => println!("    ({} rows)", count),
                                    Err(e) => println!("    (error counting: {})", e),
                                }
                            }
                        }
                    },
                    Err(e) => println!("❌ Error querying tables: {}", e),
                }
                
                // Check specific tables for sample data
                println!("\n📊 Sample data:");
                
                // Check books
                match conn.query_row("SELECT COUNT(*) FROM books", [], |row| {
                    Ok(row.get::<_, i32>(0)?)
                }) {
                    Ok(count) if count > 0 => {
                        println!("📚 Books table has {} records", count);
                        match conn.prepare("SELECT title, author FROM books LIMIT 3") {
                            Ok(mut stmt) => {
                                let rows = stmt.query_map([], |row| {
                                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                                }).unwrap();
                                
                                for row in rows {
                                    if let Ok((title, author)) = row {
                                        println!("  - '{}' by {}", title, author);
                                    }
                                }
                            },
                            Err(e) => println!("  Error reading books: {}", e),
                        }
                    },
                    Ok(_) => println!("📚 Books table is empty"),
                    Err(e) => println!("❌ Error checking books: {}", e),
                }
                
                // Check students
                match conn.query_row("SELECT COUNT(*) FROM students", [], |row| {
                    Ok(row.get::<_, i32>(0)?)
                }) {
                    Ok(count) if count > 0 => {
                        println!("👨‍🎓 Students table has {} records", count);
                        match conn.prepare("SELECT first_name, last_name, admission_number FROM students LIMIT 3") {
                            Ok(mut stmt) => {
                                let rows = stmt.query_map([], |row| {
                                    Ok((
                                        row.get::<_, String>(0)?, 
                                        row.get::<_, String>(1)?,
                                        row.get::<_, String>(2)?
                                    ))
                                }).unwrap();
                                
                                for row in rows {
                                    if let Ok((first_name, last_name, admission)) = row {
                                        println!("  - {} {} ({})", first_name, last_name, admission);
                                    }
                                }
                            },
                            Err(e) => println!("  Error reading students: {}", e),
                        }
                    },
                    Ok(_) => println!("👨‍🎓 Students table is empty"),
                    Err(e) => println!("❌ Error checking students: {}", e),
                }
                
                // Check categories
                match conn.query_row("SELECT COUNT(*) FROM categories", [], |row| {
                    Ok(row.get::<_, i32>(0)?)
                }) {
                    Ok(count) if count > 0 => {
                        println!("📂 Categories table has {} records", count);
                        match conn.prepare("SELECT name FROM categories LIMIT 5") {
                            Ok(mut stmt) => {
                                let rows = stmt.query_map([], |row| {
                                    Ok(row.get::<_, String>(0)?)
                                }).unwrap();
                                
                                for row in rows {
                                    if let Ok(name) = row {
                                        println!("  - {}", name);
                                    }
                                }
                            },
                            Err(e) => println!("  Error reading categories: {}", e),
                        }
                    },
                    Ok(_) => println!("📂 Categories table is empty"),
                    Err(e) => println!("❌ Error checking categories: {}", e),
                }
                
            },
            Err(e) => println!("❌ Failed to open database: {}", e),
        }
    } else {
        println!("❌ Database file does not exist");
    }
}
