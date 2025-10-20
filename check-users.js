import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');

try {
  const db = new Database(dbPath, { readonly: true });

  console.log('?? Checking local database for users (students and staff)...');

  // Check what tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Available tables:', tables.map(t => t.name).join(', '));

  let totalUsers = 0;

  // Check students table
  const studentsTable = tables.find(t => t.name === 'students');
  if (studentsTable) {
    const studentCount = db.prepare("SELECT COUNT(*) as count FROM students").get();
    console.log(`Total students: ${studentCount.count}`);
    totalUsers += studentCount.count;
  } else {
    console.log('?? No students table found');
  }

  // Check staff table
  const staffTable = tables.find(t => t.name === 'staff');
  if (staffTable) {
    const staffCount = db.prepare("SELECT COUNT(*) as count FROM staff").get();
    console.log(`Total staff: ${staffCount.count}`);
    totalUsers += staffCount.count;

    // Check for admin staff - assuming there's a role or is_admin column
    try {
      const adminStaffCount = db.prepare("SELECT COUNT(*) as count FROM staff WHERE role = 'admin' OR role = 'Admin' OR is_admin = 1").get();
      console.log(`Admin staff: ${adminStaffCount.count}`);
    } catch (error) {
      console.log('Could not query admin staff (column may not exist)');
    }
  } else {
    console.log('?? No staff table found');
  }

  console.log(`\n?? Total users (students + staff): ${totalUsers}`);

  db.close();
} catch (error) {
  console.error('Error:', error.message);
}