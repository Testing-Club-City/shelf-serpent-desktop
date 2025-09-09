import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

// Path to local database
const localDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');

function countStaffBorrowings() {
  let db;
  try {
    db = new Database(localDbPath, { readonly: true });
    console.log('? Connected to local database:', localDbPath);
  } catch (error) {
    console.error('? Could not connect to local database:', error);
    return;
  }

  try {
    // Count staff borrowings using borrower_type
    const staffCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM borrowings
      WHERE borrower_type = 'staff'
    `).get();
    console.log(`Staff borrowings (borrower_type = 'staff'): ${staffCount.count}`);

    // Optionally, show a few sample staff borrowings
    const staffSamples = db.prepare(`
      SELECT id, staff_id, book_id, borrowed_date, due_date
      FROM borrowings
      WHERE borrower_type = 'staff'
      LIMIT 5
    `).all();
    if (staffSamples.length > 0) {
      console.log('Sample staff borrowings:');
      staffSamples.forEach(b => {
        console.log(`  ID: ${b.id}, Staff ID: ${b.staff_id}, Book ID: ${b.book_id}, Borrowed: ${b.borrowed_date}, Due: ${b.due_date}`);
      });
    } else {
      console.log('No staff borrowings found.');
    }
  } catch (error) {
    console.error('? Error analyzing staff borrowings:', error);
  } finally {
    if (db) db.close();
  }
}

countStaffBorrowings();
