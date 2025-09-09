const { invoke } = require('@tauri-apps/api/tauri');

async function testBorrowingCreation() {
  try {
    console.log('Testing borrowing creation...');
    
    // Create a simple borrowing object
    const borrowingData = {
      id: 'test-borrowing-' + Date.now(),
      student_id: null, // We'll need to get a real student ID
      book_id: null, // We'll need to get a real book ID
      borrowed_date: new Date().toISOString().split('T')[0], // Today's date
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
      status: 'active',
      fine_amount: 0.0,
      notes: 'Test borrowing',
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
      borrower_type: 'student',
      staff_id: null
    };
    
    console.log('Borrowing data:', JSON.stringify(borrowingData, null, 2));
    
    // First, let's get some students and books to use real IDs
    const students = await invoke('get_students');
    const books = await invoke('get_books');
    
    if (students.length === 0) {
      console.error('No students found in database');
      return;
    }
    
    if (books.length === 0) {
      console.error('No books found in database');
      return;
    }
    
    // Use the first student and book
    borrowingData.student_id = students[0].id;
    borrowingData.book_id = books[0].id;
    
    console.log('Using student ID:', borrowingData.student_id);
    console.log('Using book ID:', borrowingData.book_id);
    
    // Try to create the borrowing
    const result = await invoke('create_borrowing', { borrowingData });
    console.log('Borrowing created successfully:', result);
    
  } catch (error) {
    console.error('Error creating borrowing:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  }
}

// Run the test
testBorrowingCreation();
