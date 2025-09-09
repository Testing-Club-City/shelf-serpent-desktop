// Test script to validate borrowing data format
// Run this in the browser console when the app is running

async function testBorrowingCreation() {
  try {
    console.log('🔄 Testing borrowing creation...');
    
    // Get some sample data first
    const students = await window.__TAURI__.invoke('get_students');
    const books = await window.__TAURI__.invoke('get_books');
    
    if (students.length === 0) {
      console.error('❌ No students found');
      return;
    }
    
    if (books.length === 0) {
      console.error('❌ No books found');
      return;
    }
    
    console.log(`✅ Found ${students.length} students and ${books.length} books`);
    
    // Create a properly formatted borrowing object
    const borrowingData = {
      id: crypto.randomUUID(),
      student_id: students[0].id,
      book_id: books[0].id,
      borrowed_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
      returned_date: null,
      status: 'Active', // Note: This should match the Rust enum variant
      fine_amount: 0.0,
      notes: 'Test borrowing from browser console',
      issued_by: null,
      returned_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      fine_paid: false,
      book_copy_id: null,
      condition_at_issue: 'good',
      condition_at_return: null,
      is_lost: false,
      tracking_code: null,
      return_notes: null,
      copy_condition: null,
      group_borrowing_id: null,
      borrower_type: 'Student', // Note: This should match the Rust enum variant
      staff_id: null
    };
    
    console.log('📋 Borrowing data to be sent:', JSON.stringify(borrowingData, null, 2));
    
    // Try to create the borrowing
    const result = await window.__TAURI__.invoke('create_borrowing', { 
      borrowingData: borrowingData 
    });
    
    console.log('✅ Borrowing created successfully!', result);
    
    // Verify by getting borrowings
    const borrowings = await window.__TAURI__.invoke('get_borrowings');
    console.log(`📊 Total borrowings now: ${borrowings.length}`);
    
    // Find our borrowing
    const ourBorrowing = borrowings.find(b => b.id === borrowingData.id);
    if (ourBorrowing) {
      console.log('✅ Our borrowing found in database:', ourBorrowing);
    } else {
      console.log('❌ Our borrowing not found in database');
    }
    
  } catch (error) {
    console.error('❌ Error creating borrowing:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  }
}

// Run the test
testBorrowingCreation();
