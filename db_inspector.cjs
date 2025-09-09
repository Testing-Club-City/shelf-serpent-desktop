const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Database path - same as in the Rust code
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');

console.log('Database path:', dbPath);
console.log('='.repeat(50));

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Connected to the SQLite database.');
    
    // Check all tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error('Error getting tables:', err.message);
            return;
        }
        
        console.log('\nTables in database:');
        tables.forEach(table => {
            console.log('-', table.name);
        });
        
        // Check each table for data
        let tableIndex = 0;
        
        function checkNextTable() {
            if (tableIndex >= tables.length) {
                db.close();
                return;
            }
            
            const tableName = tables[tableIndex].name;
            console.log(`\n${'='.repeat(30)}`);
            console.log(`TABLE: ${tableName}`);
            console.log(`${'='.repeat(30)}`);
            
            // Get table schema
            db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
                if (err) {
                    console.error(`Error getting schema for ${tableName}:`, err.message);
                    tableIndex++;
                    checkNextTable();
                    return;
                }
                
                console.log('Columns:');
                columns.forEach(col => {
                    console.log(`  ${col.name} (${col.type}) ${col.pk ? '[PRIMARY KEY]' : ''} ${col.notnull ? '[NOT NULL]' : ''}`);
                });
                
                // Get row count
                db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, result) => {
                    if (err) {
                        console.error(`Error counting rows in ${tableName}:`, err.message);
                        tableIndex++;
                        checkNextTable();
                        return;
                    }
                    
                    console.log(`\nRow count: ${result.count}`);
                    
                    if (result.count > 0) {
                        // Show first 5 rows
                        db.all(`SELECT * FROM ${tableName} LIMIT 5`, [], (err, rows) => {
                            if (err) {
                                console.error(`Error getting rows from ${tableName}:`, err.message);
                                tableIndex++;
                                checkNextTable();
                                return;
                            }
                            
                            console.log('\nFirst 5 rows:');
                            rows.forEach((row, index) => {
                                console.log(`Row ${index + 1}:`, JSON.stringify(row, null, 2));
                            });
                            
                            tableIndex++;
                            checkNextTable();
                        });
                    } else {
                        console.log('No data in this table.');
                        tableIndex++;
                        checkNextTable();
                    }
                });
            });
        }
        
        checkNextTable();
    });
});
