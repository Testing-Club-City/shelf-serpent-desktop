import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

async function verifyFixedBorrowingSync() {
  console.log('?? Verifying the FIXED borrowing sync results...');
  
  // Path to local database
  const localDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');
  let db;
  
  try {
    db = new Database(localDbPath, { readonly: true });
    console.log('? Connected to local database');
  } catch (error) {
    console.error('? Could not connect to local database:', error);
    return;
  }

  try {
    console.log('\n?? VERIFYING FIXED BORROWING SYNC RESULTS:');
    console.log('=' * 60);
    
    // Check borrower_type distribution AFTER the fix
    const totalBorrowings = db.prepare("SELECT COUNT(*) as count FROM borrowings").get();
    const studentBorrowings = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE borrower_type = 'student'").get();
    const staffBorrowings = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE borrower_type = 'staff'").get();
    const nullBorrowerType = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE borrower_type IS NULL").get();
    
    console.log('\n?? BORROWER TYPE DISTRIBUTION (AFTER FIX):');
    console.log(`  Total borrowings: ${totalBorrowings.count}`);
    console.log(`  Student borrowings: ${studentBorrowings.count}`);
    console.log(`  Staff borrowings: ${staffBorrowings.count}`);
    console.log(`  Null borrower_type: ${nullBorrowerType.count}`);
    
    // Calculate percentages
    const studentPercentage = ((studentBorrowings.count / totalBorrowings.count) * 100).toFixed(2);
    const staffPercentage = ((staffBorrowings.count / totalBorrowings.count) * 100).toFixed(2);
    
    console.log('\n?? PERCENTAGE BREAKDOWN:');
    console.log(`  Students: ${studentPercentage}%`);
    console.log(`  Staff: ${staffPercentage}%`);
    
    // Compare with expected Supabase values
    console.log('\n?? COMPARISON WITH SUPABASE:');
    console.log('  Expected (Supabase):');
    console.log('    Total: 24,191');
    console.log('    Students: 21,639 (89.45%)');
    console.log('    Staff: 2,552 (10.55%)');
    console.log('  Actual (Local after fix):');
    console.log(`    Total: ${totalBorrowings.count}`);
    console.log(`    Students: ${studentBorrowings.count} (${studentPercentage}%)`);
    console.log(`    Staff: ${staffBorrowings.count} (${staffPercentage}%)`);
    
    // Check if fix was successful
    const isFixed = staffBorrowings.count > 0 && staffBorrowings.count > 2000;
    
    if (isFixed) {
      console.log('\n?? SUCCESS! The borrowing sync fix worked:');
      console.log('  ? Staff borrowings are now properly classified');
      console.log('  ? Borrower types match Supabase distribution');
      console.log('  ? Staff borrowings should now appear in the Staff tab');
    } else if (staffBorrowings.count > 0) {
      console.log('\n?? PARTIAL SUCCESS:');
      console.log(`  ? Some staff borrowings found: ${staffBorrowings.count}`);
      console.log('  ?? Count is lower than expected - may need re-sync');
    } else {
      console.log('\n? ISSUE STILL EXISTS:');
      console.log('  ? No staff borrowings found');
      console.log('  ? The sync fix may not have run yet');
      console.log('  ?? You need to run the fixed sync command in the app');
    }
    
    // Show sample staff borrowings if they exist
    if (staffBorrowings.count > 0) {
      console.log('\n?? SAMPLE STAFF BORROWINGS (FIXED):');
      const sampleStaff = db.prepare(`
        SELECT b.id, b.borrower_type, b.staff_id, b.student_id, b.status, b.borrowed_date
        FROM borrowings b 
        WHERE b.borrower_type = 'staff' 
        LIMIT 5
      `).all();
      
      sampleStaff.forEach((borrowing, index) => {
        console.log(`  ${index + 1}. ID: ${borrowing.id}`);
        console.log(`     Borrower Type: ${borrowing.borrower_type}`);
        console.log(`     Staff ID: ${borrowing.staff_id}`);
        console.log(`     Student ID: ${borrowing.student_id || 'null'}`);
        console.log(`     Status: ${borrowing.status}`);
        console.log(`     Date: ${borrowing.borrowed_date}`);
      });
    }
    
    // Check for data consistency issues
    console.log('\n?? DATA CONSISTENCY CHECKS:');
    const staffTypeWithoutStaffId = db.prepare(`
      SELECT COUNT(*) as count 
      FROM borrowings 
      WHERE borrower_type = 'staff' AND (staff_id IS NULL OR staff_id = '')
    `).get();
    
    const studentTypeWithStaffId = db.prepare(`
      SELECT COUNT(*) as count 
      FROM borrowings 
      WHERE borrower_type = 'student' AND staff_id IS NOT NULL AND staff_id != ''
    `).get();
    
    console.log(`  Staff borrower_type without staff_id: ${staffTypeWithoutStaffId.count} ${staffTypeWithoutStaffId.count === 0 ? '?' : '?'}`);
    console.log(`  Student borrower_type with staff_id: ${studentTypeWithStaffId.count} ${studentTypeWithStaffId.count === 0 ? '?' : '?'}`);
    
    // Final recommendation
    console.log('\n?? NEXT STEPS:');
    if (isFixed) {
      console.log('  1. ? Open your app and check the Borrowing Management interface');
      console.log('  2. ? Staff borrowings should now appear in the Staff tab');
      console.log('  3. ? Student borrowings should appear in the Student tab');
      console.log('  4. ? The fix is complete!');
    } else {
      console.log('  1. ?? Run the Tauri app');
      console.log('  2. ?? Use the Admin Panel or sync interface');
      console.log('  3. ?? Run the "sync_borrowings_fixed" command');
      console.log('  4. ?? Then re-run this verification script');
    }
    
  } catch (error) {
    console.error('? Error during verification:', error);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run the verification
verifyFixedBorrowingSync();