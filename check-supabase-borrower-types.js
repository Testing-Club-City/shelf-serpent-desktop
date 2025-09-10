import { createClient } from '@supabase/supabase-js';

// Supabase project credentials
const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBorrowerTypeDistribution() {
  console.log('?? Checking borrower type distribution in Supabase...');
  
  try {
    // Get count of student borrowings
    const { count: studentCount, error: studentError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'student');

    if (studentError) {
      console.error('? Error querying student borrowings:', studentError);
      return;
    }

    // Get count of staff borrowings
    const { count: staffCount, error: staffError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'staff');

    if (staffError) {
      console.error('? Error querying staff borrowings:', staffError);
      return;
    }

    // Get total borrowings
    const { count: totalCount, error: totalError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('? Error querying total borrowings:', totalError);
      return;
    }

    // Get count of null borrower types
    const { count: nullCount, error: nullError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .is('borrower_type', null);

    if (nullError) {
      console.error('? Error querying null borrower types:', nullError);
      return;
    }

    console.log('\n?? SUPABASE BORROWER TYPE DISTRIBUTION:');
    console.log('=' * 50);
    console.log(`Total borrowings: ${totalCount}`);
    console.log(`Student borrowings: ${studentCount}`);
    console.log(`Staff borrowings: ${staffCount}`);
    console.log(`Null borrower_type: ${nullCount}`);
    
    // Calculate percentages
    const studentPercentage = ((studentCount / totalCount) * 100).toFixed(2);
    const staffPercentage = ((staffCount / totalCount) * 100).toFixed(2);
    const nullPercentage = ((nullCount / totalCount) * 100).toFixed(2);
    
    console.log('\n?? PERCENTAGE BREAKDOWN:');
    console.log(`Students: ${studentPercentage}%`);
    console.log(`Staff: ${staffPercentage}%`);
    console.log(`Null: ${nullPercentage}%`);
    
    // Analysis
    if (staffCount === 0) {
      console.log('\n?? ISSUE CONFIRMED: No staff borrowings found in Supabase!');
      console.log('All borrowings are classified as students.');
    } else {
      console.log('\n? Mixed borrower types found in Supabase');
    }
    
    // Get some sample staff borrowings if they exist
    if (staffCount > 0) {
      console.log('\n?? Sample staff borrowings:');
      const { data: staffSamples, error: sampleError } = await supabase
        .from('borrowings')
        .select('id, staff_id, student_id, borrower_type, created_at')
        .eq('borrower_type', 'staff')
        .limit(5);
        
      if (!sampleError && staffSamples) {
        staffSamples.forEach((borrowing, index) => {
          console.log(`  ${index + 1}. ID: ${borrowing.id}`);
          console.log(`     Staff ID: ${borrowing.staff_id}`);
          console.log(`     Student ID: ${borrowing.student_id}`);
          console.log(`     Created: ${borrowing.created_at}`);
        });
      }
    }
    
    // Check for borrowings that have staff_id but wrong borrower_type
    const { count: wrongClassificationCount, error: wrongError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .not('staff_id', 'is', null)
      .neq('borrower_type', 'staff');
      
    if (!wrongError) {
      console.log(`\n?? Borrowings with staff_id but not classified as staff: ${wrongClassificationCount}`);
      if (wrongClassificationCount > 0) {
        console.log('This indicates a data classification issue!');
      }
    }

  } catch (error) {
    console.error('? Error checking Supabase:', error);
  }
}

checkBorrowerTypeDistribution();