// Test script to check borrowings data structure
const { invoke } = require('@tauri-apps/api/tauri');

async function testBorrowingsData() {
  try {
    console.log('Testing get_borrowings command...');
    const borrowings = await invoke('get_borrowings');
    
    console.log(`Found ${borrowings.length} borrowings`);
    
    if (borrowings.length > 0) {
      const firstBorrowing = borrowings[0];
      console.log('\nFirst borrowing structure:');
      console.log(JSON.stringify(firstBorrowing, null, 2));
      
      console.log('\nBook information:');
      console.log('books property:', firstBorrowing.books);
      console.log('book_id:', firstBorrowing.book_id);
      
      console.log('\nStudent information:');
      console.log('students property:', firstBorrowing.students);
      console.log('student_id:', firstBorrowing.student_id);
    }
  } catch (error) {
    console.error('Error testing borrowings data:', error);
  }
}

testBorrowingsData();
