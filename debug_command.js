// Test the command directly in browser console
// Copy and paste this into the browser console when the app is running

async function testCommand() {
    try {
        console.log('Testing search_book_copy_by_legacy_id command...');
        
        const result = await window.__TAURI__.core.invoke('search_book_copy_by_legacy_id', {
            legacy_book_id: 200
        });
        
        console.log('SUCCESS:', result);
        return result;
    } catch (error) {
        console.error('ERROR:', error);
        return error;
    }
}

// Run the test
testCommand();