import { createClient } from '@supabase/supabase-js';

// Supabase project credentials
const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkActiveBorrowingsByType() {
  console.log('?? Checking ACTIVE borrowings by borrower type in Supabase...');
  
  try {
    // Get count of active student borrowings
    const { count: activeStudentCount, error: activeStudentError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'student')
      .eq('status', 'active');

    if (activeStudentError) {
      console.error('? Error querying active student borrowings:', activeStudentError);
      return;
    }

    // Get count of active staff borrowings
    const { count: activeStaffCount, error: activeStaffError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'staff')
      .eq('status', 'active');

    if (activeStaffError) {
      console.error('? Error querying active staff borrowings:', activeStaffError);
      return;
    }

    // Get total active borrowings
    const { count: totalActiveCount, error: totalActiveError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (totalActiveError) {
      console.error('? Error querying total active borrowings:', totalActiveError);
      return;
    }

    // Get count of returned borrowings by type
    const { count: returnedStudentCount, error: returnedStudentError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'student')
      .eq('status', 'returned');

    const { count: returnedStaffCount, error: returnedStaffError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'staff')
      .eq('status', 'returned');

    console.log('\n?? SUPABASE ACTIVE BORROWINGS BY TYPE:');
    console.log('=' * 60);
    console.log(`Total ACTIVE borrowings: ${totalActiveCount}`);
    console.log(`Active STUDENT borrowings: ${activeStudentCount}`);
    console.log(`Active STAFF borrowings: ${activeStaffCount}`);
    
    // Calculate percentages for active borrowings
    if (totalActiveCount > 0) {
      const activeStudentPercentage = ((activeStudentCount / totalActiveCount) * 100).toFixed(2);
      const activeStaffPercentage = ((activeStaffCount / totalActiveCount) * 100).toFixed(2);
      
      console.log('\n?? ACTIVE BORROWINGS PERCENTAGE:');
      console.log(`Active Students: ${activeStudentPercentage}%`);
      console.log(`Active Staff: ${activeStaffPercentage}%`);
    }

    console.log('\n?? RETURNED BORROWINGS BY TYPE:');
    console.log(`Returned STUDENT borrowings: ${returnedStudentCount || 0}`);
    console.log(`Returned STAFF borrowings: ${returnedStaffCount || 0}`);
    
    // Analysis
    if (activeStaffCount === 0) {
      console.log('\n?? NO ACTIVE STAFF BORROWINGS in Supabase!');
      console.log('All active borrowings are from students.');
    } else {
      console.log('\n? Both student and staff have active borrowings in Supabase');
    }
    
    // Get sample active staff borrowings if they exist
    if (activeStaffCount > 0) {
      console.log('\n?? Sample ACTIVE staff borrowings:');
      const { data: activeStaffSamples, error: activeSampleError } = await supabase
        .from('borrowings')
        .select(`
          id, 
          staff_id, 
          borrower_type, 
          borrowed_date, 
          due_date,
          books (title, author),
          staff (first_name, last_name, staff_id)
        `)
        .eq('borrower_type', 'staff')
        .eq('status', 'active')
        .limit(5);
        
      if (!activeSampleError && activeStaffSamples) {
        activeStaffSamples.forEach((borrowing, index) => {
          console.log(`  ${index + 1}. ${borrowing.staff?.first_name} ${borrowing.staff?.last_name}`);
          console.log(`     Book: ${borrowing.books?.title || 'Unknown'}`);
          console.log(`     Borrowed: ${borrowing.borrowed_date}`);
          console.log(`     Due: ${borrowing.due_date}`);
          console.log(`     Staff ID: ${borrowing.staff?.staff_id}`);
          console.log('     ---');
        });
      }
    }

    // Get sample active student borrowings
    console.log('\n?? Sample ACTIVE student borrowings:');
    const { data: activeStudentSamples, error: studentSampleError } = await supabase
      .from('borrowings')
      .select(`
        id, 
        student_id, 
        borrower_type, 
        borrowed_date, 
        due_date,
        books (title, author),
        students (first_name, last_name, admission_number)
      `)
      .eq('borrower_type', 'student')
      .eq('status', 'active')
      .limit(5);
      
    if (!studentSampleError && activeStudentSamples) {
      activeStudentSamples.forEach((borrowing, index) => {
        console.log(`  ${index + 1}. ${borrowing.students?.first_name} ${borrowing.students?.last_name}`);
        console.log(`     Book: ${borrowing.books?.title || 'Unknown'}`);
        console.log(`     Borrowed: ${borrowing.borrowed_date}`);
        console.log(`     Due: ${borrowing.due_date}`);
        console.log(`     Admission #: ${borrowing.students?.admission_number}`);
        console.log('     ---');
      });
    }

    // Check for status distribution
    console.log('\n?? BORROWING STATUS DISTRIBUTION:');
    const statusDistribution = await Promise.all([
      supabase.from('borrowings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('borrowings').select('*', { count: 'exact', head: true }).eq('status', 'returned'),
      supabase.from('borrowings').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
      supabase.from('borrowings').select('*', { count: 'exact', head: true }).eq('status', 'lost')
    ]);

    console.log(`Active: ${statusDistribution[0].count || 0}`);
    console.log(`Returned: ${statusDistribution[1].count || 0}`);
    console.log(`Overdue: ${statusDistribution[2].count || 0}`);
    console.log(`Lost: ${statusDistribution[3].count || 0}`);

  } catch (error) {
    console.error('? Error checking Supabase active borrowings:', error);
  }
}

checkActiveBorrowingsByType();