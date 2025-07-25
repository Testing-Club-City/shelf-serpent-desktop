import { MigrationService } from './MigrationService';
import initSqlJs from 'sql.js';
import { supabase } from '../../../integrations/supabase/client';
import * as fs from 'fs';

async function main() {
  try {
    // Initialize SQL.js
    const SQL = await initSqlJs();
    
    // Load the legacy database
    const dbPath = './kisii school.db';
    const dbData = fs.readFileSync(dbPath);
    const db = new SQL.Database(dbData);
    
    // Run migration
    await MigrationService.importBorrowings(db, 100, true, (progress, total) => {
      console.log(`Progress: ${progress}/${total}`);
    });
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main().catch(console.error);
