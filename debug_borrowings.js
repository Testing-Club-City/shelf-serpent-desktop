const { invoke } = window.__TAURI__.core;

async function debugBorrowings() {
    console.log("🔍 Debugging borrowings data...");
    
    try {
        // Get database info first
        const dbInfo = await invoke('get_database_info');
        console.log("📊 Database info:", dbInfo);
        
        // Get borrowings data
        const borrowings = await invoke('get_borrowings');
        console.log("📚 Borrowings data:", borrowings);
        console.log("📚 Number of borrowings:", borrowings.length);
        
        if (borrowings.length > 0) {
            console.log("📚 First borrowing:", borrowings[0]);
        }
        
        // Get library stats
        const stats = await invoke('get_library_stats');
        console.log("📊 Library stats:", stats);
        
    } catch (error) {
        console.error("❌ Error debugging borrowings:", error);
    }
}

// Run the debug function
debugBorrowings();