
import { supabase } from '@/integrations/supabase/client';

export const debugBookCopies = async () => {
  try {
    console.log('=== DEBUGGING BOOK COPIES DATABASE ===');
    
    // Get all book copies with their book info
    const { data: allCopies, error: allError } = await supabase
      .from('book_copies')
      .select(`
        *,
        books (
          id,
          title,
          author,
          book_code,
          isbn,
          available_copies,
          total_copies
        )
      `)
      .order('book_id, copy_number');

    if (allError) {
      console.error('Error fetching all book copies:', allError);
      return;
    }

    console.log('Total book copies in database:', allCopies?.length);
    
    // Filter for Kiswahili Mufti specifically
    const kiswahiliCopies = allCopies?.filter(copy => 
      copy.books?.title?.toLowerCase().includes('kiswahili')
    ) || [];
    
    console.log('Kiswahili Mufti copies found:', kiswahiliCopies.length);
    console.log('Kiswahili Mufti copies detail:', kiswahiliCopies);
    
    // Check status distribution
    const statusCounts = allCopies?.reduce((acc, copy) => {
      acc[copy.status] = (acc[copy.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Status distribution across all copies:', statusCounts);
    
    // Check available copies specifically
    const { data: availableCopies, error: availableError } = await supabase
      .from('book_copies')
      .select(`
        *,
        books (
          id,
          title,
          author,
          book_code,
          isbn
        )
      `)
      .eq('status', 'available')
      .order('book_id, copy_number');
      
    if (availableError) {
      console.error('Error fetching available copies:', availableError);
      return;
    }
    
    console.log('Available copies count:', availableCopies?.length);
    
    const availableKiswahili = availableCopies?.filter(copy => 
      copy.books?.title?.toLowerCase().includes('kiswahili')
    ) || [];
    
    console.log('Available Kiswahili Mufti copies:', availableKiswahili.length);
    console.log('Available Kiswahili Mufti copies detail:', availableKiswahili);
    
    // Check if there are any tracking code issues
    const copiesWithoutTracking = allCopies?.filter(copy => !copy.tracking_code) || [];
    console.log('Copies without tracking codes:', copiesWithoutTracking.length);
    
    if (copiesWithoutTracking.length > 0) {
      console.log('Copies missing tracking codes:', copiesWithoutTracking);
    }
    
    console.log('=== END DATABASE DEBUG ===');
    
    return {
      totalCopies: allCopies?.length || 0,
      kiswahiliCopies: kiswahiliCopies.length,
      availableCopies: availableCopies?.length || 0,
      availableKiswahili: availableKiswahili.length,
      statusCounts,
      copiesWithoutTracking: copiesWithoutTracking.length
    };
    
  } catch (error) {
    console.error('Debug function error:', error);
  }
};

// Call this function from the browser console to debug
if (typeof window !== 'undefined') {
  (window as any).debugBookCopies = debugBookCopies;
}
