
import { supabase } from '@/integrations/supabase/client';

export const fixTrackingCodes = async () => {
  try {
    console.log('Starting tracking code fix...');
    
    // Get all book copies that need fixing
    const { data: bookCopies, error: fetchError } = await supabase
      .from('book_copies')
      .select(`
        id,
        book_id,
        copy_number,
        tracking_code,
        created_at,
        books (
          book_code
        )
      `);

    if (fetchError) {
      console.error('Error fetching book copies:', fetchError);
      return;
    }

    console.log(`Found ${bookCopies?.length} book copies to check`);

    if (!bookCopies) return;

    const updates = [];
    
    for (const copy of bookCopies) {
      const bookCode = copy.books?.book_code;
      
      if (!bookCode) {
        console.log(`Skipping copy ${copy.id} - no book code`);
        continue;
      }

      // Get year from created_at or use current year
      const year = copy.created_at 
        ? new Date(copy.created_at).getFullYear().toString().slice(-2)
        : new Date().getFullYear().toString().slice(-2);

      // Generate proper tracking code: BookCode/CopyNumber/Year
      const paddedCopyNumber = String(copy.copy_number).padStart(3, '0');
      const properTrackingCode = `${bookCode}/${paddedCopyNumber}/${year}`;

      // Only update if tracking code is different
      if (copy.tracking_code !== properTrackingCode) {
        updates.push({
          id: copy.id,
          tracking_code: properTrackingCode
        });
      }
    }

    console.log(`Need to update ${updates.length} tracking codes`);

    // Update in batches
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('book_copies')
          .update({ tracking_code: update.tracking_code })
          .eq('id', update.id);

        if (updateError) {
          console.error(`Error updating copy ${update.id}:`, updateError);
        } else {
          console.log(`Updated copy ${update.id} with tracking code: ${update.tracking_code}`);
        }
      }
    }

    console.log('Tracking code fix completed');
    return { success: true, updated: updates.length };
    
  } catch (error) {
    console.error('Error in fixTrackingCodes:', error);
    return { success: false, error };
  }
};
