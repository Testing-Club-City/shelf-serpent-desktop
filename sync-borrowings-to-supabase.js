#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

// Your Supabase credentials
const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

async function getLocalDb() {
  const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');
  console.log(`📁 Using local database: ${dbPath}`);
  
  const db = new sqlite3.Database(dbPath);
  return {
    db,
    all: promisify(db.all.bind(db)),
    get: promisify(db.get.bind(db)),
    run: promisify(db.run.bind(db)),
    close: promisify(db.close.bind(db))
  };
}

async function syncBorrowingsToSupabase(dryRun = true) {
  console.log(`🔄 ${dryRun ? 'DRY RUN - ' : ''}Syncing Borrowings to Supabase\n`);
  
  const localDb = await getLocalDb();
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get all local borrowings
  console.log('📚 Getting local borrowings...');
  const localBorrowings = await localDb.all(`
    SELECT * FROM borrowings 
    WHERE deleted = 0 OR deleted IS NULL
    ORDER BY created_at DESC
  `);
  
  console.log('📊 Local borrowings by status:');
  const statusCounts = await localDb.all(`
    SELECT status, COUNT(*) as count 
    FROM borrowings 
    WHERE deleted = 0 OR deleted IS NULL 
    GROUP BY status
  `);
  statusCounts.forEach(s => console.log(`   ${s.status}: ${s.count}`));
  
  console.log(`📊 Found ${localBorrowings.length} local borrowings`);
  
  // Get existing borrowings from Supabase in batches (to handle large datasets)
  console.log('🌐 Getting existing Supabase borrowings...');
  const existingIds = new Set();
  let offset = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: batch, error } = await supabase
      .from('borrowings')
      .select('id')
      .range(offset, offset + batchSize - 1);
    
    if (error) {
      throw new Error(`Failed to get existing borrowings: ${error.message}`);
    }
    
    if (!batch || batch.length === 0) break;
    
    batch.forEach(b => existingIds.add(b.id));
    offset += batchSize;
    
    console.log(`   📦 Loaded ${existingIds.size} existing IDs...`);
    
    if (batch.length < batchSize) break; // Last batch
  }
  
  console.log(`📊 Found ${existingIds.size} existing borrowings in Supabase`);
  
  // Filter out existing borrowings
  const newBorrowings = localBorrowings.filter(b => !existingIds.has(b.id));
  console.log(`📈 ${newBorrowings.length} borrowings need to be synced`);
  
  // Show breakdown by status for borrowings that need syncing
  if (newBorrowings.length > 0) {
    console.log('\n📊 Borrowings to sync by status:');
    const syncStatusCounts = {};
    newBorrowings.forEach(b => {
      syncStatusCounts[b.status] = (syncStatusCounts[b.status] || 0) + 1;
    });
    Object.entries(syncStatusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
  }
  
  if (newBorrowings.length === 0) {
    console.log('✅ All borrowings are already synced!');
    await localDb.close();
    return;
  }
  
  // Show sample of what will be synced
  console.log('\n📋 Sample borrowings to sync (first 5):');
  newBorrowings.slice(0, 5).forEach((b, i) => {
    console.log(`   ${i + 1}. ID: ${b.id}`);
    console.log(`      Status: ${b.status}`);
    console.log(`      Date: ${b.borrowed_date}`);
    console.log(`      Staff ID: ${b.staff_id || 'N/A'}`);
    console.log(`      Student ID: ${b.student_id || 'N/A'}`);
    console.log('');
  });
  
  const syncResults = {
    total_local: localBorrowings.length,
    existing_remote: existingIds.size,
    to_sync: newBorrowings.length,
    synced: 0,
    errors: [],
    dry_run: dryRun
  };
  
  if (!dryRun) {
    console.log('🚀 Starting actual sync...');
    
    // Sync in batches to avoid overwhelming the API
    const batchSize = 1000; // Larger batches for faster processing
    const totalBatches = Math.ceil(newBorrowings.length / batchSize);
    
    for (let i = 0; i < newBorrowings.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = newBorrowings.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      try {
        const { error: insertError } = await supabase
          .from('borrowings')
          .insert(batch);
        
        if (insertError) {
          console.log(`❌ Batch ${batchNumber} failed: ${insertError.message}`);
          syncResults.errors.push(`Batch ${batchNumber}: ${insertError.message}`);
          
          // Try individual inserts for this batch
          console.log(`🔄 Trying individual inserts for batch ${batchNumber}...`);
          for (const borrowing of batch) {
            try {
              const { error: singleError } = await supabase
                .from('borrowings')
                .insert([borrowing]);
              
              if (!singleError) {
                syncResults.synced++;
                console.log(`   ✅ Synced: ${borrowing.id}`);
              } else {
                console.log(`   ❌ Failed: ${borrowing.id} - ${singleError.message}`);
                syncResults.errors.push(`Individual ${borrowing.id}: ${singleError.message}`);
              }
            } catch (e) {
              console.log(`   ❌ Exception: ${borrowing.id} - ${e.message}`);
              syncResults.errors.push(`Exception ${borrowing.id}: ${e.message}`);
            }
          }
        } else {
          syncResults.synced += batch.length;
          console.log(`   ✅ Batch ${batchNumber} synced successfully`);
        }
        
        // Small delay between batches (reduced for faster processing)
        if (i + batchSize < newBorrowings.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
      } catch (e) {
        console.log(`❌ Batch ${batchNumber} exception: ${e.message}`);
        syncResults.errors.push(`Batch ${batchNumber} exception: ${e.message}`);
      }
    }
    
    // Update local sync status for successfully synced borrowings in batches
    if (syncResults.synced > 0) {
      console.log(`\n🔄 Updating local sync status for ${syncResults.synced} borrowings...`);
      
      // Update in batches to avoid SQL query length limits
      const updateBatchSize = 1000;
      const syncedBorrowings = newBorrowings.slice(0, syncResults.synced);
      
      for (let i = 0; i < syncedBorrowings.length; i += updateBatchSize) {
        const batch = syncedBorrowings.slice(i, i + updateBatchSize);
        const syncedIds = batch.map(b => `'${b.id}'`).join(',');
        
        await localDb.run(`
          UPDATE borrowings 
          SET synced = 1, sync_version = sync_version + 1 
          WHERE id IN (${syncedIds})
        `);
        
        console.log(`   ✅ Updated sync status for batch ${Math.floor(i / updateBatchSize) + 1}`);
      }
      
      console.log('✅ Local sync status updated');
    }
  }
  
  await localDb.close();
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Local Borrowings: ${syncResults.total_local}`);
  console.log(`Existing in Supabase: ${syncResults.existing_remote}`);
  console.log(`Needed Sync: ${syncResults.to_sync}`);
  console.log(`Successfully Synced: ${syncResults.synced}`);
  console.log(`Errors: ${syncResults.errors.length}`);
  console.log(`Dry Run: ${syncResults.dry_run ? 'YES' : 'NO'}`);
  
  if (syncResults.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    syncResults.errors.slice(0, 10).forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
    if (syncResults.errors.length > 10) {
      console.log(`   ... and ${syncResults.errors.length - 10} more errors`);
    }
  }
  
  if (dryRun) {
    console.log('\n💡 This was a dry run. To actually sync, run with --sync flag');
  } else {
    console.log(`\n✅ Sync completed! ${syncResults.synced}/${syncResults.to_sync} borrowings synced`);
  }
  
  return syncResults;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--sync');
  
  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode - no actual changes will be made');
    console.log('💡 Use --sync flag to perform actual sync\n');
  }
  
  try {
    await syncBorrowingsToSupabase(dryRun);
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the sync
main().catch(console.error);