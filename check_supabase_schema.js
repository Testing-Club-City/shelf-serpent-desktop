#!/usr/bin/env node

// CLI tool to check Supabase schema directly
// Usage: node check_supabase_schema.js

const https = require('https');

// Supabase configuration - actual values from your codebase
const SUPABASE_URL = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

// Tables to check
const TABLES = [
  'classes',
  'students', 
  'books',
  'book_copies',
  'borrowings',
  'categories',
  'fines',
  'group_borrowings',
  'theft_reports'
];

async function checkTableSchema(tableName) {
  console.log(`\n=== ${tableName.toUpperCase()} ===`);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL.replace('https://', ''),
      path: `/rest/v1/${tableName}?limit=1`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.length > 0) {
            console.log(`✅ ${tableName} exists`);
            console.log('Columns found:');
            Object.keys(json[0]).forEach(col => {
              console.log(`  - ${col}`);
            });
            console.log(`Total records: ${json.length}`);
          } else {
            console.log(`✅ ${tableName} exists but no data`);
          }
        } catch (e) {
          console.log(`❌ Error checking ${tableName}: ${e.message}`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Error checking ${tableName}: ${error.message}`);
      reject(error);
    });

    req.end();
  });
}

async function checkSchema() {
  console.log('🔍 Checking Supabase Schema...');
  console.log('URL:', SUPABASE_URL);
  console.log('Key:', SUPABASE_KEY.substring(0, 8) + '...');
  
  try {
    for (const table of TABLES) {
      await checkTableSchema(table);
    }
    
    console.log('\n✅ Schema check completed!');
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }
}

// Check if running as script
if (require.main === module) {
  // Check if config is set
  if (SUPABASE_URL.includes('your-supabase-url') || SUPABASE_KEY.includes('your-anon-key')) {
    console.log('❌ Please update SUPABASE_URL and SUPABASE_KEY in this file');
    console.log('Replace "your-supabase-url" and "your-anon-key" with actual values');
    process.exit(1);
  }
  
  checkSchema();
}

module.exports = { checkSchema };
