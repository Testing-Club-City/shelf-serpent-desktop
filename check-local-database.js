import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database paths to check - focusing on AppData folder
const dbPaths = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db'),
  path.join(os.homedir(), 'AppData', 'Local', 'library-management-system', 'library.db'),
  path.join(__dirname, 'library.db'),
  path.join(__dirname, 'shelf-serpent.db'),
  path.join(__dirname, 'src-tauri', 'target', 'debug', '_up_', 'library.db')
];

async function checkLocalDatabase() {
  console.log('?? Checking local database for borrowings and legacy book IDs...');
  
  let db = null;
  let dbPath = null;
  
  // Try to find and open a database
  for (const path of dbPaths) {
    try {
      console.log(`Trying database: ${path}`);
      db = new Database(path, { readonly: true });
      dbPath = path;
      console.log(`? Successfully opened database: ${path}`);
      break;
    } catch (error) {
      console.log(`? Could not open ${path}: ${error.message}`);
    }
  }
  
  if (!db) {
    console.log('? Could not open any database file');
    return;
  }
  
  try {
    console.log(`\n?? Analyzing database: ${dbPath}`);
    
    // Check what tables exist
    console.log('\n?? Checking available tables...');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Available tables:', tables.map(t => t.name).join(', '));
    
    // Check if borrowings table exists
    const borrowingsExists = tables.some(t => t.name === 'borrowings');
    const bookCopiesExists = tables.some(t => t.name === 'book_copies');
    const booksExists = tables.some(t => t.name === 'books');
    
    if (!borrowingsExists) {
      console.log('? No borrowings table found in local database');
      console.log('Available tables:', tables.map(t => t.name).join(', '));
      return;
    }
    
    console.log('? Found borrowings table');
    
    // Get borrowings table schema
    console.log('\n?? Borrowings table schema:');
    const borrowingsSchema = db.prepare("PRAGMA table_info(borrowings)").all();
    borrowingsSchema.forEach(col => {
      console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // Get total borrowings count
    const totalBorrowings = db.prepare("SELECT COUNT(*) as count FROM borrowings").get();
    console.log(`\n?? Total borrowings in local database: ${totalBorrowings.count}`);
    
    // Count by borrower type
    const staffBorrowingsCount = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE borrower_type = 'staff'").get();
    const studentBorrowingsCount = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE borrower_type = 'student'").get();
    
    console.log(`?? Staff borrowings: ${staffBorrowingsCount.count}`);
    console.log(`?? Student borrowings: ${studentBorrowingsCount.count}`);
    
    // Count by status
    const activeBorrowingsCount = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE status = 'active'").get();
    const returnedBorrowingsCount = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE status = 'returned'").get();
    
    console.log(`?? Active borrowings: ${activeBorrowingsCount.count}`);
    console.log(`?? Returned borrowings: ${returnedBorrowingsCount.count}`);
    
    if (bookCopiesExists) {
      console.log('\n?? Checking book copies table...');
      
      // Get book_copies table schema
      const bookCopiesSchema = db.prepare("PRAGMA table_info(book_copies)").all();
      const hasLegacyBookId = bookCopiesSchema.some(col => col.name === 'legacy_book_id');
      
      console.log('Book copies table schema:');
      bookCopiesSchema.forEach(col => {
        console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
      });
      
      if (hasLegacyBookId) {
        const totalBookCopies = db.prepare("SELECT COUNT(*) as count FROM book_copies").get();
        const copiesWithLegacyId = db.prepare("SELECT COUNT(*) as count FROM book_copies WHERE legacy_book_id IS NOT NULL").get();
        
        console.log(`\n?? Total book copies: ${totalBookCopies.count}`);
        console.log(`?? Book copies with legacy_book_id: ${copiesWithLegacyId.count}`);
        console.log(`?? Percentage with legacy IDs: ${((copiesWithLegacyId.count / totalBookCopies.count) * 100).toFixed(2)}%`);
        
        // Analyze borrowings with legacy book IDs
        console.log('\n?? Analyzing borrowings linked to legacy book IDs...');
        
        const borrowingsWithLegacy = db.prepare(`
          SELECT 
            b.id,
            b.borrower_type,
            b.status,
            b.borrowed_date,
            b.due_date,
            b.returned_date,
            b.fine_amount,
            bc.legacy_book_id,
            bc.copy_identifier,
            bc.title,
            bc.author
          FROM borrowings b
          LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
          LIMIT 10
        `).all();
        
        console.log('\n?? Sample borrowings with legacy book ID connections:');
        console.log('='.repeat(80));
        
        borrowingsWithLegacy.forEach((record, index) => {
          console.log(`\n${index + 1}. Local Borrowing Record:`);
          console.log(`   Borrowing ID: ${record.id}`);
          console.log(`   Borrower Type: ${record.borrower_type}`);
          console.log(`   Status: ${record.status}`);
          console.log(`   Borrowed Date: ${record.borrowed_date}`);
          console.log(`   Due Date: ${record.due_date}`);
          
          if (record.returned_date) {
            console.log(`   Returned Date: ${record.returned_date}`);
          }
          
          if (record.fine_amount) {
            console.log(`   Fine Amount: ${record.fine_amount}`);
          }
          
          console.log(`   ?? Legacy Book ID: ${record.legacy_book_id || 'None'}`);
          console.log(`   ?? Copy Identifier: ${record.copy_identifier || 'None'}`);
          console.log(`   ?? Book Title: ${record.title || 'Unknown'}`);
          console.log(`   ?? Author: ${record.author || 'Unknown'}`);
        });
        
        // Count borrowings with/without legacy connections
        const borrowingsWithLegacyCount = db.prepare(`
          SELECT COUNT(*) as count 
          FROM borrowings b
          JOIN book_copies bc ON b.book_copy_id = bc.id
          WHERE bc.legacy_book_id IS NOT NULL
        `).get();
        
        const borrowingsWithoutLegacyCount = db.prepare(`
          SELECT COUNT(*) as count 
          FROM borrowings b
          JOIN book_copies bc ON b.book_copy_id = bc.id
          WHERE bc.legacy_book_id IS NULL
        `).get();
        
        console.log(`\n?? Borrowings with legacy book ID connections: ${borrowingsWithLegacyCount.count}`);
        console.log(`? Borrowings without legacy book ID connections: ${borrowingsWithoutLegacyCount.count}`);
        console.log(`?? Connection rate: ${((borrowingsWithLegacyCount.count / totalBorrowings.count) * 100).toFixed(2)}%`);
        
      } else {
        console.log('?? No legacy_book_id column found in book_copies table');
      }
    } else {
      console.log('? No book_copies table found');
    }
    
    // Summary comparison with Supabase
    console.log('\n?? LOCAL vs SUPABASE COMPARISON:');
    console.log('='.repeat(50));
    console.log('LOCAL DATABASE:');
    console.log(`  Total Borrowings: ${totalBorrowings.count}`);
    console.log(`  Staff Borrowings: ${staffBorrowingsCount.count}`);
    console.log(`  Student Borrowings: ${studentBorrowingsCount.count}`);
    console.log(`  Active Borrowings: ${activeBorrowingsCount.count}`);
    console.log(`  Returned Borrowings: ${returnedBorrowingsCount.count}`);
    
    console.log('\nSUPABASE DATABASE (from previous analysis):');
    console.log('  Total Borrowings: 24,191');
    console.log('  Staff Borrowings: 2,552');
    console.log('  Student Borrowings: 21,639');
    
    console.log('\nDATA SYNC STATUS:');
    const localTotal = totalBorrowings.count;
    const supabaseTotal = 24191;
    const difference = Math.abs(localTotal - supabaseTotal);
    const syncPercentage = ((Math.min(localTotal, supabaseTotal) / Math.max(localTotal, supabaseTotal)) * 100).toFixed(2);
    
    console.log(`  Difference: ${difference} records`);
    console.log(`  Sync Status: ${syncPercentage}%`);
    
    if (difference === 0) {
      console.log('  ? Perfect sync between local and remote!');
    } else if (difference < 100) {
      console.log('  ? Very good sync (minor differences)');
    } else if (difference < 1000) {
      console.log('  ?? Good sync (some differences)');
    } else {
      console.log('  ? Significant differences detected');
    }
    
  } catch (error) {
    console.error('? Error analyzing database:', error);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run the analysis
checkLocalDatabase();checkLocalDatabase();