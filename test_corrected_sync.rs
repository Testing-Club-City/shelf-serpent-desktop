// Add this to your main.rs or create a separate binary

use crate::corrected_book_copies_sync::sync_book_copies_corrected;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔄 Testing corrected book copies sync...");
    
    match sync_book_copies_corrected().await {
        Ok(count) => {
            println!("✅ Sync completed successfully!");
            println!("📊 Total records processed: {}", count);
        }
        Err(e) => {
            println!("❌ Sync failed: {}", e);
        }
    }
    
    Ok(())
}
