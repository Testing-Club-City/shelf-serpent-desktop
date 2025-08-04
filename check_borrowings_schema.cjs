const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Connect to the local database
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');
console.log('🔍 Checking database at:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });
    
    // Check if borrowings table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='borrowings'").all();
    
    if (tables.length === 0) {
        console.log('❌ Borrowings table does not exist!');
        process.exit(1);
    }
    
    console.log('✅ Borrowings table exists');
    
    // Get table schema
    const schema = db.prepare("PRAGMA table_info(borrowings)").all();
    
    console.log('\n📊 Borrowings table schema:');
    console.log('Column Name | Type | Not Null | Default | Primary Key');
    console.log('------------|------|----------|---------|------------');
    
    schema.forEach(col => {
        console.log(`${col.name.padEnd(11)} | ${col.type.padEnd(4)} | ${col.notnull ? 'YES' : 'NO'} ${col.notnull ? '   ' : '    '} | ${(col.dflt_value || 'NULL').toString().padEnd(7)} | ${col.pk ? 'YES' : 'NO'}`);
    });
    
    // Check for specific columns we're trying to use
    const columnNames = schema.map(col => col.name);
    
    console.log('\n🔍 Column check:');
    console.log('✅ id:', columnNames.includes('id'));
    console.log('✅ student_id:', columnNames.includes('student_id'));
    console.log('✅ book_id:', columnNames.includes('book_id'));
    console.log('❓ borrowed_at:', columnNames.includes('borrowed_at'));
    console.log('❓ borrow_date:', columnNames.includes('borrow_date'));
    console.log('❓ due_date:', columnNames.includes('due_date'));
    console.log('❓ returned_at:', columnNames.includes('returned_at'));
    console.log('❓ return_date:', columnNames.includes('return_date'));
    console.log('✅ status:', columnNames.includes('status'));
    console.log('✅ fine_amount:', columnNames.includes('fine_amount'));
    console.log('✅ created_at:', columnNames.includes('created_at'));
    console.log('✅ updated_at:', columnNames.includes('updated_at'));
    
    db.close();
    
} catch (error) {
    console.error('❌ Error checking database:', error.message);
    process.exit(1);
}
