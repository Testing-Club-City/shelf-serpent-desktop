import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

async function fixBorrowingSyncQuery() {
  console.log('?? Fixing the borrowing sync query to include staff_id and borrower_type...');
  
  // Path to local database
  const localDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');
  let db;
  
  try {
    db = new Database(localDbPath, { readonly: false });
    console.log('? Connected to local database');
  } catch (error) {
    console.error('? Could not connect to local database:', error);
    return;
  }

  try {
    console.log('\n?? ANALYZING THE SYNC ISSUE:');
    console.log('=' * 60);
    
    // Check current schema
    const borrowingsSchema = db.prepare("PRAGMA table_info(borrowings)").all();
    console.log('\n?? Current borrowings table schema:');
    borrowingsSchema.forEach(col => {
      console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // Check for missing columns
    const hasStaffId = borrowingsSchema.some(col => col.name === 'staff_id');
    const hasBorrowerType = borrowingsSchema.some(col => col.name === 'borrower_type');
    
    console.log(`\n?? Schema analysis:`);
    console.log(`  staff_id column exists: ${hasStaffId ? '?' : '?'}`);
    console.log(`  borrower_type column exists: ${hasBorrowerType ? '?' : '?'}`);
    
    if (!hasStaffId) {
      console.log('\n?? Adding missing staff_id column...');
      db.exec(`ALTER TABLE borrowings ADD COLUMN staff_id TEXT`);
      console.log('? Added staff_id column');
    }
    
    if (!hasBorrowerType) {
      console.log('\n?? Adding missing borrower_type column...');
      db.exec(`ALTER TABLE borrowings ADD COLUMN borrower_type TEXT DEFAULT 'student'`);
      console.log('? Added borrower_type column');
    }
    
    // Now, manually fetch data from Supabase and fix the local records
    console.log('\n?? Fetching borrowing data from Supabase to fix local records...');
    
    // Since we can't make HTTP requests from this script, let's create a Rust command fix
    console.log('\n?? THE FIX NEEDED IN RUST CODE:');
    console.log('=' * 60);
    
    console.log('? CURRENT SYNC QUERY (BROKEN):');
    console.log(`
INSERT INTO borrowings (
    id, student_id, book_id, borrowed_date, due_date, returned_date,
    status, fine_amount, notes, created_at, updated_at,
    book_copy_id, condition_at_issue, condition_at_return, is_lost,
    tracking_code, return_notes, issued_by, returned_by, fine_paid
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    console.log('\n? CORRECTED SYNC QUERY (FIXED):');
    console.log(`
INSERT INTO borrowings (
    id, student_id, staff_id, book_id, borrowed_date, due_date, returned_date,
    status, fine_amount, notes, created_at, updated_at,
    book_copy_id, condition_at_issue, condition_at_return, is_lost,
    tracking_code, return_notes, issued_by, returned_by, fine_paid,
    borrower_type
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    console.log('\n?? BINDING CHANGES NEEDED:');
    console.log(`
// Current binding (missing staff_id and borrower_type):
.bind(student_id)
.bind(book_id)
...

// Fixed binding (includes staff_id and borrower_type):
.bind(student_id)
.bind(staff_id)  // <- ADD THIS
.bind(book_id)
...
.bind(borrower_type)  // <- ADD THIS AT THE END
    `);
    
    console.log('\n?? EXTRACTION CHANGES NEEDED:');
    console.log(`
// Add these lines in the sync function:
let staff_id = borrowing["staff_id"].as_str();
let borrower_type = borrowing["borrower_type"].as_str().unwrap_or("student");
    `);
    
    // For now, let's manually fix some records that we know should be staff
    console.log('\n?? Manually fixing known staff borrowings...');
    
    // Look for records that have patterns suggesting they're staff borrowings
    const suspiciousRecords = db.prepare(`
      SELECT id, student_id, notes, created_at
      FROM borrowings 
      WHERE borrower_type = 'student' 
      AND (
        notes LIKE '%staff%' OR 
        notes LIKE '%teacher%' OR 
        notes LIKE '%STAFF%' OR
        student_id IN (
          SELECT id FROM staff WHERE id IS NOT NULL
        )
      )
      LIMIT 10
    `).all();
    
    console.log(`\nFound ${suspiciousRecords.length} potentially misclassified records:`);
    suspiciousRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record.id}`);
      console.log(`     Student ID: ${record.student_id}`);
      console.log(`     Notes: ${record.notes || 'None'}`);
      console.log(`     Created: ${record.created_at}`);
    });
    
    // Create a summary of what needs to be done
    console.log('\n?? SUMMARY OF REQUIRED FIXES:');
    console.log('=' * 60);
    console.log('1. ? Schema: Added missing columns (staff_id, borrower_type)');
    console.log('2. ?? Rust Code: Update sync query to include staff_id and borrower_type');
    console.log('3. ?? Rust Code: Update binding to include staff_id and borrower_type values');
    console.log('4. ?? Re-sync: Run the borrowings sync after fixing the Rust code');
    console.log('5. ? Verify: Check that staff borrowings appear in staff tab');
    
    console.log('\n?? NEXT STEPS:');
    console.log('1. Update the Rust sync code in fixed_borrowings_sync.rs');
    console.log('2. Recompile the Tauri application');
    console.log('3. Run the sync command again');
    console.log('4. Verify staff borrowings show correctly in the app');
    
  } catch (error) {
    console.error('? Error during fix process:', error);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run the fix analysis
fixBorrowingSyncQuery();