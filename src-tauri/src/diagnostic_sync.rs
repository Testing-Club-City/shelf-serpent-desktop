use anyhow::Result;
use reqwest;

// Diagnostic function to check actual record counts from Supabase
pub async fn check_supabase_counts() -> Result<()> {
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let tables = vec!["students", "books", "borrowings", "book_copies", "fines"];
    
    for table in tables {
        // First, get count using head request
        let count_url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=*&limit=1",
            table
        );
        
        let response = client
            .get(&count_url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Range", "0-0")
            .send()
            .await?;
        
        let count_header = response.headers().get("content-range");
        let total_count = if let Some(range) = count_header {
            let range_str = range.to_str().unwrap_or("0/0");
            range_str.split('/').last().unwrap_or("0").parse::<i32>().unwrap_or(0)
        } else {
            // Fallback: try to get all records with a small limit to check
            let test_url = format!(
                "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=count",
                table
            );
            
            let count_response = client
                .get(&test_url)
                .header("apikey", anon_key)
                .header("Authorization", format!("Bearer {}", anon_key))
                .send()
                .await?;
            
            if count_response.status().is_success() {
                let count_json: serde_json::Value = count_response.json().await?;
                count_json[0]["count"].as_i64().unwrap_or(0) as i32
            } else {
                0
            }
        };
        
        println!("📊 Table '{}': {} total records in Supabase", table, total_count);
        
        // Also test actual fetching with different parameters
        let test_batch_url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=*&limit=1000&offset=0",
            table
        );
        
        let test_response = client
            .get(&test_batch_url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if test_response.status().is_success() {
            let test_json: serde_json::Value = test_response.json().await?;
            let actual_records = test_json.as_array().map(|arr| arr.len()).unwrap_or(0);
            println!("📊 Table '{}': Actually fetched {} records with limit=1000", table, actual_records);
        }
    }
    
    Ok(())
}
