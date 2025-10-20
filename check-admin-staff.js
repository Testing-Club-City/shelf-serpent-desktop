import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');

try {
  const db = new Database(dbPath, { readonly: true });

  console.log('?? Checking staff table schema for admin info...');

  // Get staff table schema
  const staffSchema = db.prepare("PRAGMA table_info(staff)").all();
  console.log('Staff table columns:');
  staffSchema.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });

  // Check if there's a role column or similar
  const hasRole = staffSchema.some(col => col.name.toLowerCase().includes('role'));
  const hasAdmin = staffSchema.some(col => col.name.toLowerCase().includes('admin'));

  if (hasRole) {
    console.log('\n?? Role column found, checking admin roles...');
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM staff WHERE LOWER(role) = 'admin'").get();
    console.log(`Admin staff: ${adminCount.count}`);
  } else if (hasAdmin) {
    console.log('\n?? Admin column found, checking admin staff...');
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM staff WHERE is_admin = 1 OR admin = 1").get();
    console.log(`Admin staff: ${adminCount.count}`);
  } else {
    console.log('\n?? No role or admin column found in staff table');
    // Maybe check for specific staff names or something, but unlikely
  }

  db.close();
} catch (error) {
  console.error('Error:', error.message);
}