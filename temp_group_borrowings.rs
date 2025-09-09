async fn upload_group_borrowings(
    db: &DatabaseManager,
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let group_borrowings = {
        let conn = db.get_connection().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, group_name, book_id, borrowed_date, due_date, returned_date, status, fine_amount FROM group_borrowings WHERE book_id IS NOT NULL")?;
        let rows = stmt.query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>("id")?,
                "group_name": row.get::<_, String>("group_name")?,
                "book_id": row.get::<_, String>("book_id")?,
                "borrow_date": row.get::<_, String>("borrowed_date")?,
                "due_date": row.get::<_, String>("due_date")?,
                "return_date": row.get::<_, Option<String>>("returned_date")?,
                "status": row.get::<_, String>("status")?,
                "fine_amount": row.get::<_, Option<f64>>("fine_amount")?
            }))
        })?;
        
        let mut group_borrowings = Vec::new();
        for row in rows {
            group_borrowings.push(row?);
        }
        group_borrowings
    };

    if group_borrowings.is_empty() { 
        return Ok(0); 
    }

    // Upload group borrowings in batches
    const BATCH_SIZE: usize = 100;
    let mut total_uploaded = 0;
    
    for chunk in group_borrowings.chunks(BATCH_SIZE) {
        let response = client
            .post(&format!("{}/rest/v1/group_borrowings", supabase_url))
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(&chunk)
            .send()
            .await?;
        
        if response.status().is_success() {
            total_uploaded += chunk.len() as u32;
            info!("👥 Uploaded batch of {} group borrowings", chunk.len());
        } else {
            warn!("⚠️ Failed to upload batch of {} group borrowings: {}", chunk.len(), response.status());
        }
    }
    
    Ok(total_uploaded)
}
