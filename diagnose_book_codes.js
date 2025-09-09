// Diagnostic script to check book codes in the database
// Run this in your browser console when on your app

async function diagnoseBooksTable() {
  console.log('🔍 Diagnosing books table and book codes...');
  
  try {
    // Check if we have access to supabase
    if (!window.supabase) {
      console.error('❌ Supabase client not found. Make sure you\'re on your app page.');
      return;
    }

    // Get all books with their book codes
    const { data: allBooks, error: fetchError } = await window.supabase
      .from('books')
      .select('id, title, author, book_code')
      .limit(10); // Just get first 10 for diagnosis

    if (fetchError) {
      console.error('❌ Error fetching books:', fetchError);
      return;
    }

    console.log('📚 Sample books from database:');
    console.table(allBooks);

    // Count books with and without codes
    const { data: booksWithoutCodes, error: countError } = await window.supabase
      .from('books')
      .select('id, title, book_code', { count: 'exact' })
      .or('book_code.is.null,book_code.eq.');

    if (countError) {
      console.error('❌ Error counting books without codes:', countError);
      return;
    }

    console.log(`📊 Books without codes: ${booksWithoutCodes?.length || 0}`);
    
    if (booksWithoutCodes && booksWithoutCodes.length > 0) {
      console.log('📋 Sample books without codes:');
      console.table(booksWithoutCodes.slice(0, 5));
    }

    // Get total count
    const { count: totalBooks } = await window.supabase
      .from('books')
      .select('*', { count: 'exact', head: true });

    console.log(`📈 Total books in database: ${totalBooks}`);
    console.log(`📈 Books with missing codes: ${booksWithoutCodes?.length || 0}`);
    console.log(`📈 Books with codes: ${(totalBooks || 0) - (booksWithoutCodes?.length || 0)}`);

    // Test the book_code field specifically
    const { data: codeTest } = await window.supabase
      .from('books')
      .select('book_code')
      .limit(5);

    console.log('🧪 Book code field test:');
    codeTest?.forEach((book, index) => {
      console.log(`Book ${index + 1}: book_code = "${book.book_code}" (type: ${typeof book.book_code})`);
    });

  } catch (error) {
    console.error('💥 Diagnostic error:', error);
  }
}

// Run the diagnosis
diagnoseBooksTable();
