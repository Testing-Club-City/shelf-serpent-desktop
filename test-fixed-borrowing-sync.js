import { invoke } from '@tauri-apps/api/core';

async function testFixedBorrowingSync() {
  console.log('?? Testing the FIXED borrowing sync with correct staff_id and borrower_type...');
  
  try {
    // Call the fixed sync command
    const result = await invoke('sync_borrowings_fixed');
    console.log('? Fixed borrowing sync result:', result);
    
    // Now test the local database to see if staff borrowings are properly synced
    console.log('\n?? Checking updated local database stats...');
    
    // We'll use a simple count check
    // Note: You might want to create additional commands to verify the specific data
    const localStats = await invoke('get_local_data_stats');
    console.log('?? Local database stats after fix:', localStats);
    
    console.log('\n?? Fixed borrowing sync test completed!');
    console.log('Check your app\'s borrowing management interface:');
    console.log('- Staff borrowings should now appear in the Staff tab');
    console.log('- Student borrowings should appear in the Student tab');
    console.log('- Legacy book IDs should be properly linked');
    
  } catch (error) {
    console.error('? Fixed borrowing sync failed:', error);
  }
}

// Run the test
testFixedBorrowingSync();