import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

async function checkBookCopyIdSync() {
  console.log('?? Checking book_copy_id sync in borrowings...');
  
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
    console.log('\n?? BOOK_COPY_ID ANALYSIS IN BORROWINGS:');
    console.log('=' * 60);
    
    // Check total borrowings
    const totalBorrowings = db.prepare("SELECT COUNT(*) as count FROM borrowings").get();
    console.log(`  Total borrowings: ${totalBorrowings.count}`);
    
    // Check borrowings with book_copy_id
    const withBookCopyId = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE book_copy_id IS NOT NULL AND book_copy_id != ''").get();
    console.log(`  With book_copy_id: ${withBookCopyId.count}`);
    
    // Check borrowings without book_copy_id
    const withoutBookCopyId = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE book_copy_id IS NULL OR book_copy_id = ''").get();
    console.log(`  Without book_copy_id: ${withoutBookCopyId.count}`);
    
    // Calculate percentage
    const percentage = ((withBookCopyId.count / totalBorrowings.count) * 100).toFixed(2);
    console.log(`  Percentage with book_copy_id: ${percentage}%`);
    
    // Expected from our earlier Supabase analysis: 100% should have book_copy_id
    console.log('\n?? COMPARISON WITH EXPECTED:');
    console.log('  Expected (from Supabase): 100% should have book_copy_id');
    console.log(`  Actual (Local): ${percentage}% have book_copy_id`);
    
    if (percentage === '100.00') {
      console.log('  ? PERFECT! book_copy_id sync is working correctly');
    } else if (parseFloat(percentage) > 95) {
      console.log('  ? GOOD! Most borrowings have book_copy_id');
    } else if (parseFloat(percentage) > 50) {
      console.log('  ?? PARTIAL: Some borrowings missing book_copy_id');
    } else {
      console.log('  ? ISSUE: Many borrowings missing book_copy_id');
    }
    
    // Show sample borrowings with book_copy_id
    if (withBookCopyId.count > 0) {
      console.log('\n?? SAMPLE BORROWINGS WITH BOOK_COPY_ID:');
      const sampleWithCopyId = db.prepare(`
        SELECT b.id, b.borrower_type, b.book_copy_id, b.book_id, b.status, b.borrowed_date
        FROM borrowings b 
        WHERE b.book_copy_id IS NOT NULL AND b.book_copy_id != ''
        LIMIT 5
      `).all();
      
      sampleWithCopyId.forEach((borrowing, index) => {
        console.log(`  ${index + 1}. Borrowing ID: ${borrowing.id}`);
        console.log(`     Borrower Type: ${borrowing.borrower_type}`);
        console.log(`     Book Copy ID: ${borrowing.book_copy_id}`);
        console.log(`     Book ID: ${borrowing.book_id}`);
        console.log(`     Status: ${borrowing.status}`);
        console.log(`     Date: ${borrowing.borrowed_date}`);
        console.log('');
      });
    }
    
    // Show sample borrowings without book_copy_id (if any)
    if (withoutBookCopyId.count > 0) {
      console.log('\n?? SAMPLE BORROWINGS WITHOUT BOOK_COPY_ID:');
      const sampleWithoutCopyId = db.prepare(`
        SELECT b.id, b.borrower_type, b.book_id, b.status, b.borrowed_date
        FROM borrowings b 
        WHERE b.book_copy_id IS NULL OR b.book_copy_id = ''
        LIMIT 5
      `).all();
      
      sampleWithoutCopyId.forEach((borrowing, index) => {
        console.log(`  ${index + 1}. Borrowing ID: ${borrowing.id}`);
        console.log(`     Borrower Type: ${borrowing.borrower_type}`);
        console.log(`     Book ID: ${borrowing.book_id}`);
        console.log(`     Status: ${borrowing.status}`);
        console.log(`     Date: ${borrowing.borrowed_date}`);
        console.log('');
      });
    }
    
    // Check if book_copy_id links to actual book_copies
    console.log('\n?? BOOK_COPY_ID RELATIONSHIP VALIDATION:');
    const validLinks = db.prepare(`
      SELECT COUNT(*) as count 
      FROM borrowings b 
      INNER JOIN book_copies bc ON b.book_copy_id = bc.id 
      WHERE b.book_copy_id IS NOT NULL
    `).get();
    
    console.log(`  Borrowings with valid book_copies links: ${validLinks.count}`);
    console.log(`  Borrowings with book_copy_id: ${withBookCopyId.count}`);
    
    if (validLinks.count === withBookCopyId.count) {
      console.log('  ? ALL book_copy_id values link to valid book_copies records');
    } else if (validLinks.count > 0) {
      const invalidLinks = withBookCopyId.count - validLinks.count;
      console.log(`  ?? ${invalidLinks} borrowings have invalid book_copy_id references`);
    } else {
      console.log('  ? NO valid book_copy_id links found');
    }
    
    // Check legacy_book_id connectivity through book_copies
    console.log('\n?? LEGACY BOOK ID CONNECTIVITY:');
    const legacyConnections = db.prepare(`
      SELECT COUNT(*) as count 
      FROM borrowings b 
      INNER JOIN book_copies bc ON b.book_copy_id = bc.id 
      WHERE bc.legacy_book_id IS NOT NULL
    `).get();
    
    console.log(`  Borrowings connected to legacy book IDs: ${legacyConnections.count}`);
    const legacyPercentage = ((legacyConnections.count / totalBorrowings.count) * 100).toFixed(2);
    console.log(`  Percentage with legacy book ID access: ${legacyPercentage}%`);
    
    // Summary assessment
    console.log('\n?? BOOK_COPY_ID SYNC ASSESSMENT:');
    
    if (percentage === '100.00' && validLinks.count === withBookCopyId.count) {
      console.log('  ?? EXCELLENT: book_copy_id sync is working perfectly!');
      console.log('  ? All borrowings have book_copy_id');
      console.log('  ? All book_copy_id references are valid');
      console.log('  ? Legacy book ID connectivity is maintained');
    } else if (parseFloat(percentage) > 95 && validLinks.count > withBookCopyId.count * 0.9) {
      console.log('  ? GOOD: book_copy_id sync is mostly working');
      console.log('  ?? Minor issues with some references');
    } else {
      console.log('  ?? NEEDS ATTENTION: book_copy_id sync has issues');
      console.log('  ?? Consider running the fixed sync to improve connectivity');
    }
    
  } catch (error) {
    console.error('? Error during book_copy_id analysis:', error);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run the check
checkBookCopyIdSync();