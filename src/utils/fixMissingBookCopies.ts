
import { supabase } from '@/integrations/supabase/client';

export const diagnoseMissingBookCopies = async () => {
  try {
    console.log('=== DIAGNOSING MISSING BOOK COPIES ===');
    
    // Get total books count
    const { data: allBooks, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, book_code, total_copies, available_copies');
      
    if (booksError) {
      console.error('Error fetching books:', booksError);
      return;
    }
    
    console.log('Total books in database:', allBooks?.length);
    
    // Get all book copies
    const { data: allCopies, error: copiesError } = await supabase
      .from('book_copies')
      .select('book_id, id');
      
    if (copiesError) {
      console.error('Error fetching book copies:', copiesError);
      return;
    }
    
    console.log('Total book copies in database:', allCopies?.length);
    
    // Group copies by book_id
    const copiesByBook = allCopies?.reduce((acc, copy) => {
      acc[copy.book_id] = (acc[copy.book_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    // Find books without copies
    const booksWithoutCopies = allBooks?.filter(book => !copiesByBook[book.id]) || [];
    const booksWithInsufficientCopies = allBooks?.filter(book => {
      const actualCopies = copiesByBook[book.id] || 0;
      return actualCopies < (book.total_copies || 1);
    }) || [];
    
    console.log('Books without any copies:', booksWithoutCopies.length);
    console.log('Books with insufficient copies:', booksWithInsufficientCopies.length);
    
    if (booksWithoutCopies.length > 0) {
      console.log('Sample books without copies:', booksWithoutCopies.slice(0, 5));
    }
    
    if (booksWithInsufficientCopies.length > 0) {
      console.log('Sample books with insufficient copies:', booksWithInsufficientCopies.slice(0, 5));
    }
    
    return {
      totalBooks: allBooks?.length || 0,
      totalCopies: allCopies?.length || 0,
      booksWithoutCopies: booksWithoutCopies.length,
      booksWithInsufficientCopies: booksWithInsufficientCopies.length,
      booksWithoutCopiesList: booksWithoutCopies,
      booksWithInsufficientCopiesList: booksWithInsufficientCopies
    };
    
  } catch (error) {
    console.error('Diagnosis error:', error);
  }
};

export const fixMissingBookCopies = async () => {
  try {
    console.log('=== FIXING MISSING BOOK COPIES ===');
    
    // Call the database function to create missing copies
    const { data, error } = await supabase.rpc('create_missing_book_copies');
    
    if (error) {
      console.error('Error calling create_missing_book_copies function:', error);
      throw error;
    }
    
    console.log('Missing book copies creation results:', data);
    
    // Get updated counts after the fix
    const { data: updatedCopies, error: countError } = await supabase
      .from('book_copies')
      .select('id');
      
    if (!countError) {
      console.log('Total book copies after fix:', updatedCopies?.length || 0);
    }
    
    // Return the results
    return data;
    
  } catch (error) {
    console.error('Fix missing copies error:', error);
    throw error;
  }
};

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).diagnoseMissingBookCopies = diagnoseMissingBookCopies;
  (window as any).fixMissingBookCopies = fixMissingBookCopies;
}
