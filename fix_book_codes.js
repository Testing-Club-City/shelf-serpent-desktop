// Quick script to fix missing book codes
// Run this in your browser's developer console when on your app

async function fixMissingBookCodes() {
  console.log('Fixing missing book codes...');
  
  try {
    // Get books without book codes
    const { data: booksWithoutCodes, error: fetchError } = await window.supabase
      .from('books')
      .select('id, title, book_code')
      .or('book_code.is.null,book_code.eq.');

    if (fetchError) {
      console.error('Error fetching books:', fetchError);
      return;
    }

    console.log(`Found ${booksWithoutCodes?.length || 0} books without codes`);

    let fixed = 0;
    
    // Generate book codes for each book
    for (const book of booksWithoutCodes || []) {
      try {
        // Generate a simple book code from title (first 3 letters)
        let baseCode = 'BK'; // Default fallback
        if (book.title && book.title.length >= 3) {
          baseCode = book.title.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
          if (baseCode.length < 2) baseCode = 'BK';
        }

        // Check if code exists and find unique variant
        let codeCounter = 1;
        let candidateCode = baseCode;
        
        while (true) {
          const { data: existingBook } = await window.supabase
            .from('books')
            .select('id')
            .eq('book_code', candidateCode)
            .single();

          if (!existingBook) break;
          
          candidateCode = baseCode + String(codeCounter).padStart(3, '0');
          codeCounter++;
          
          if (codeCounter > 999) {
            candidateCode = 'BK' + Math.random().toString(36).substring(2, 8).toUpperCase();
            break;
          }
        }

        // Update the book with the new code
        const { error: updateError } = await window.supabase
          .from('books')
          .update({ book_code: candidateCode })
          .eq('id', book.id);

        if (updateError) {
          console.error(`Error updating book "${book.title}":`, updateError);
        } else {
          console.log(`✅ Fixed "${book.title}" -> ${candidateCode}`);
          fixed++;
        }
      } catch (error) {
        console.error(`Error processing book "${book.title}":`, error);
      }
    }

    console.log(`🎉 Successfully fixed ${fixed} books!`);
    console.log('Refresh your page to see the changes.');
    
  } catch (error) {
    console.error('Error in fixMissingBookCodes:', error);
  }
}

// Run the fix
fixMissingBookCodes();
