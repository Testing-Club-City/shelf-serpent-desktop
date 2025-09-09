
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{command, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct BookCopySearchResult {
    pub id: String,
    pub tracking_code: String,
    pub book_id: String,
    pub copy_number: i32,
    pub book_code: String,
    pub condition: String,
    pub status: String,
    pub book_title: String,
    pub book_author: String,
    pub isbn: Option<String>,
    pub total_copies: i32,
    pub available_copies: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BookGroup {
    pub book: BookInfo,
    pub copies: Vec<BookCopySearchResult>,
    pub total_copies: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BookInfo {
    pub id: String,
    pub title: String,
    pub author: String,
    pub book_code: String,
    pub isbn: Option<String>,
    pub total_copies: i32,
    pub available_copies: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressiveSearchResult {
    pub search_type: String, // 'none' | 'book_code' | 'book_copies' | 'exact'
    pub data: serde_json::Value,
    pub search_term: String,
}

#[command]
pub async fn progressive_tracking_code_search(search_term: String, db: State<'_, crate::commands::DatabaseState>) -> Result<ProgressiveSearchResult, String> {
    if search_term.len() < 2 {
        return Ok(ProgressiveSearchResult {
            search_type: "none".to_string(),
            data: serde_json::Value::Null,
            search_term,
        });
    }

    let upper_search_term = search_term.to_uppercase();
    println!("🔍 Progressive search for: {}", upper_search_term);

    let conn = db.get_connection();
    let conn = conn.lock().map_err(|e| e.to_string())?;

    // First, try exact match by copy_identifier (the actual column name in local SQLite database)
    let exact_match_query = r#"
        SELECT 
            bc.id, bc.copy_identifier as tracking_code, bc.isbn, bc.title, bc.author, bc.condition, bc.status,
            bc.legacy_book_id, bc.copy_identifier as book_code
        FROM book_copies bc
        WHERE bc.copy_identifier = ? AND bc.status = 'available'
          AND bc.id NOT IN (
              SELECT book_copy_id FROM borrowings 
              WHERE status = 'active' AND book_copy_id IS NOT NULL
          )
    "#;
    
    println!("🔍 SQL Query (exact match): {}", exact_match_query);
    println!("🔍 Search term: {}", upper_search_term);

    if let Ok(mut stmt) = conn.prepare(exact_match_query) {
        if let Ok(exact_match) = stmt.query_row(params![upper_search_term], |row| {
            // Handle both integer and string IDs by trying integer first, then string
            let id_value = if let Ok(int_id) = row.get::<_, i64>(0) {
                int_id.to_string()
            } else if let Ok(str_id) = row.get::<_, String>(0) {
                str_id
            } else {
                "unknown".to_string()
            };
            
            Ok(BookCopySearchResult {
                id: id_value,
                tracking_code: row.get::<_, String>(1)?,
                book_id: "".to_string(), // Not available in local schema
                copy_number: 1, // Default value
                book_code: row.get::<_, String>(8)?,
                condition: row.get::<_, String>(5)?,
                status: row.get::<_, String>(6)?,
                book_title: row.get::<_, String>(3)?,
                book_author: row.get::<_, String>(4)?,
                isbn: row.get::<_, Option<String>>(2)?,
                total_copies: 1, // Default value
                available_copies: 1, // Default value
            })
        }) {
            println!("Found exact match by tracking code: {}", exact_match.tracking_code);
            return Ok(ProgressiveSearchResult {
                search_type: "exact".to_string(),
                data: serde_json::to_value(exact_match).map_err(|e| e.to_string())?,
                search_term: upper_search_term,
            });
        }
    }

    // Second, try legacy book ID match in book_copies table (this is the main fix)
    if let Ok(legacy_book_id) = search_term.parse::<i64>() {
        let legacy_match_query = r#"
            SELECT 
                bc.id, bc.copy_identifier as tracking_code, bc.isbn, bc.title, bc.author, bc.condition, bc.status,
                bc.legacy_book_id, bc.copy_identifier as book_code
            FROM book_copies bc
            WHERE bc.legacy_book_id = ? AND bc.status = 'available'
              AND bc.id NOT IN (
                  SELECT book_copy_id FROM borrowings 
                  WHERE status = 'active' AND book_copy_id IS NOT NULL
              )
        "#;
        
        println!("🔍 SQL Query (legacy match): {}", legacy_match_query);
        println!("🔍 Legacy book ID: {}", legacy_book_id);

        if let Ok(mut stmt) = conn.prepare(legacy_match_query) {
            if let Ok(legacy_match) = stmt.query_row(params![legacy_book_id], |row| {
                // Handle both integer and string IDs by trying integer first, then string
                let id_value = if let Ok(int_id) = row.get::<_, i64>(0) {
                    int_id.to_string()
                } else if let Ok(str_id) = row.get::<_, String>(0) {
                    str_id
                } else {
                    "unknown".to_string()
                };
                
                Ok(BookCopySearchResult {
                    id: id_value,
                    tracking_code: row.get::<_, String>(1)?,
                    book_id: "".to_string(), // Not available in local schema
                    copy_number: 1, // Default value
                    book_code: row.get::<_, String>(8)?,
                    condition: row.get::<_, String>(5)?,
                    status: row.get::<_, String>(6)?,
                    book_title: row.get::<_, String>(3)?,
                    book_author: row.get::<_, String>(4)?,
                    isbn: row.get::<_, Option<String>>(2)?,
                    total_copies: 1, // Default value
                    available_copies: 1, // Default value
                })
            }) {
                println!("Found exact match by legacy book ID: {}", legacy_book_id);
                return Ok(ProgressiveSearchResult {
                    search_type: "exact".to_string(),
                    data: serde_json::to_value(legacy_match).map_err(|e| e.to_string())?,
                    search_term: search_term,
                });
            }
        }
    }

    // Third, look for partial matches using LIKE (matches archive manager's ILIKE approach)
    let partial_match_query = r#"
        SELECT 
            bc.id, bc.copy_identifier as tracking_code, bc.isbn, bc.title, bc.author, bc.condition, bc.status,
            bc.legacy_book_id, bc.copy_identifier as book_code
        FROM book_copies bc
        WHERE bc.copy_identifier LIKE ? AND bc.status = 'available'
          AND bc.id NOT IN (
              SELECT book_copy_id FROM borrowings 
              WHERE status = 'active' AND book_copy_id IS NOT NULL
          )
        ORDER BY bc.copy_identifier
        LIMIT 20
    "#;
    
    let search_pattern = format!("{}%", upper_search_term);
    println!("🔍 SQL Query (partial match): {}", partial_match_query);
    println!("🔍 Search pattern: {}", search_pattern);

    let mut partial_matches = Vec::new();
    if let Ok(mut stmt) = conn.prepare(partial_match_query) {
        
        if let Ok(rows) = stmt.query_map(params![search_pattern], |row| {
            // Handle both integer and string IDs by trying integer first, then string
            let id_value = if let Ok(int_id) = row.get::<_, i64>(0) {
                int_id.to_string()
            } else if let Ok(str_id) = row.get::<_, String>(0) {
                str_id
            } else {
                "unknown".to_string()
            };
            
            Ok(BookCopySearchResult {
                id: id_value,
                tracking_code: row.get::<_, String>(1)?,
                book_id: "".to_string(), // Not available in local schema
                copy_number: 1, // Default value
                book_code: row.get::<_, String>(8)?,
                condition: row.get::<_, String>(5)?,
                status: row.get::<_, String>(6)?,
                book_title: row.get::<_, String>(3)?,
                book_author: row.get::<_, String>(4)?,
                isbn: row.get::<_, Option<String>>(2)?,
                total_copies: 1, // Default value
                available_copies: 1, // Default value
            })
        }) {
            for row_result in rows {
                if let Ok(copy) = row_result {
                    partial_matches.push(copy);
                }
            }
        }
    }

    if !partial_matches.is_empty() {
        // Analyze search pattern (matches archive manager logic exactly)
        let parts: Vec<&str> = upper_search_term.split('/').collect();
        
        if parts.len() == 1 {
            // Just book code (e.g., "KID2") - group by book_id like archive manager
            let mut book_groups: HashMap<String, BookGroup> = HashMap::new();
            
            for copy in partial_matches {
                let book_id = copy.book_id.clone();
                
                if !book_groups.contains_key(&book_id) {
                    book_groups.insert(book_id.clone(), BookGroup {
                        book: BookInfo {
                            id: book_id.clone(),
                            title: copy.book_title.clone(),
                            author: copy.book_author.clone(),
                            book_code: copy.book_code.clone(),
                            isbn: copy.isbn.clone(),
                            total_copies: copy.total_copies,
                            available_copies: copy.available_copies,
                        },
                        copies: Vec::new(),
                        total_copies: 0,
                    });
                }
                
                if let Some(group) = book_groups.get_mut(&book_id) {
                    group.copies.push(copy);
                    group.total_copies += 1;
                }
            }

            println!("Book code search - found {} books", book_groups.len());
            return Ok(ProgressiveSearchResult {
                search_type: "book_code".to_string(),
                data: serde_json::to_value(book_groups).map_err(|e| e.to_string())?,
                search_term: upper_search_term,
            });
            
        } else if parts.len() == 2 {
            // Book code + copy number prefix (e.g., "KID2/004") - return copies directly
            println!("Book copies search - found {} copies", partial_matches.len());
            return Ok(ProgressiveSearchResult {
                search_type: "book_copies".to_string(),
                data: serde_json::to_value(partial_matches).map_err(|e| e.to_string())?,
                search_term: upper_search_term,
            });
        }
    }

    println!("❌ No matches found for: {}", upper_search_term);
    Ok(ProgressiveSearchResult {
        search_type: "none".to_string(),
        data: serde_json::Value::Null,
        search_term: upper_search_term,
    })
}

#[command]
pub async fn search_books_by_code_or_title(query: String, state: State<'_, crate::commands::DatabaseState>) -> Result<Vec<BookInfo>, String> {
    if query.len() < 2 {
        return Ok(Vec::new());
    }

    let conn = state.get_connection();
    let conn = conn.lock().map_err(|e| e.to_string())?;

    // Search books by book_code, title, or author (matches archive manager approach)
    let search_query = r#"
        SELECT id, title, author, book_code, isbn, total_copies, available_copies
        FROM books
        WHERE book_code LIKE ? OR title LIKE ? OR author LIKE ?
        ORDER BY 
            CASE 
                WHEN book_code LIKE ? THEN 1
                WHEN title LIKE ? THEN 2
                ELSE 3
            END,
            title
        LIMIT 20
    "#;

    let search_pattern = format!("%{}%", query);
    let exact_pattern = format!("{}%", query);
    
    let mut books = Vec::new();
    
    if let Ok(mut stmt) = conn.prepare(search_query) {
        if let Ok(rows) = stmt.query_map(params![
            search_pattern, search_pattern, search_pattern,
            exact_pattern, exact_pattern
        ], |row| {
            Ok(BookInfo {
                id: row.get::<_, String>(0)?,
                title: row.get::<_, String>(1)?,
                author: row.get::<_, String>(2)?,
                book_code: row.get::<_, String>(3)?,
                isbn: row.get::<_, Option<String>>(4)?,
                total_copies: row.get::<_, i32>(5)?,
                available_copies: row.get::<_, i32>(6)?,
            })
        }) {
            for row_result in rows {
                if let Ok(book) = row_result {
                    books.push(book);
                }
            }
        }
    }

    Ok(books)
}

#[command]
pub async fn search_book_copies_by_legacy_id(legacy_id: String, state: State<'_, crate::commands::DatabaseState>) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.get_connection();
    let conn = conn.lock().map_err(|e| e.to_string())?;
    
    // First try exact match for legacy_book_id
    let mut stmt = conn.prepare("
        SELECT bc.id, bc.legacy_book_id, bc.copy_identifier as tracking_code, bc.condition,
               bc.title, bc.author, bc.isbn
        FROM book_copies bc
        WHERE bc.legacy_book_id = ?1 AND (bc.deleted = 0 OR bc.deleted IS NULL)
        ORDER BY bc.legacy_book_id
        LIMIT 10
    ").map_err(|e| e.to_string())?;
    
    let book_copies_iter = stmt.query_map([legacy_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>("id")?,
            "legacy_book_id": row.get::<_, Option<String>>("legacy_book_id")?,
            "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
            "condition": row.get::<_, Option<String>>("condition")?,
            "title": row.get::<_, Option<String>>("title")?,
            "author": row.get::<_, Option<String>>("author")?,
            "isbn": row.get::<_, Option<String>>("isbn")?
        }))
    }).map_err(|e| e.to_string())?;
    
    book_copies_iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
