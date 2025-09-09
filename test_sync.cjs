const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Database path for the application
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');

console.log(`Checking database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Connected to the SQLite database.');
});

// Function to check data counts
function checkDataCounts() {
    const tables = ['books', 'students', 'categories', 'borrowings', 'staff'];
    
    tables.forEach(table => {
        db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
            if (err) {
                console.error(`Error counting ${table}:`, err.message);
            } else {
                console.log(`${table}: ${row.count} records`);
            }
        });
    });
}

// Check sync status
function checkSyncStatus() {
    db.all(`SELECT * FROM sync_state`, (err, rows) => {
        if (err) {
            console.error('Error checking sync status:', err.message);
        } else {
            console.log('\nSync Status:');
            rows.forEach(row => {
                console.log(`${row.table_name}: last_sync=${row.last_sync}, synced_records=${row.synced_records}`);
            });
        }
    });
}

// Wait a moment then check
setTimeout(() => {
    console.log('\n=== Current Data Counts ===');
    checkDataCounts();
    
    setTimeout(() => {
        console.log('\n=== Sync Status ===');
        checkSyncStatus();
        
        setTimeout(() => {
            db.close((err) => {
                if (err) {
                    console.error(err.message);
                }
                console.log('\nDatabase connection closed.');
            });
        }, 1000);
    }, 1000);
}, 1000);
