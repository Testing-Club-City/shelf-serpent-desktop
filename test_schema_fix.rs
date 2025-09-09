use anyhow::Result;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<()> {
    println!("🧪 Testing book copies schema fixes...");
    
    // Test the updated sync function
    let result = shelf_serpent_desktop::sync_all_fixed::sync_book_copies_in_batches_fixed().await;
    
    match result {
        Ok(count) => println!("✅ Successfully synced {} book copies", count),
        Err(e) => println!("❌ Error syncing book copies: {}", e),
    }
    
    Ok(())
}
