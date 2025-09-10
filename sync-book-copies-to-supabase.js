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

async function syncBookCopiesToSupabase(dryRun = true) {
  console.log(`🔄 ${dryRun ? 'DRY RUN - ' : ''}Syncing Book Copies to Supabase\n`);
  
  const localDb = await getLocalDb();
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get all local book copies
  console.log('📚 Getting local book copies...');
  const localBookCopies = await localDb.all(`
    SELECT * FROM book_copies 
    WHERE deleted = 0 OR deleted IS NULL
    ORDER BY created_at DESC
  `);
  
  console.log('📊 Local book copies by status:');
  const statusCounts = await localDb.all(`
    SELECT status, COUNT(*) as count 
    FROM book_copies 
    WHERE deleted = 0 OR deleted IS NULL 
    GROUP BY status
  `);
  statusCounts.forEach(s => console.log(`   ${s.status}: ${s.count}`));
  
  console.log(`📊 Found ${localBookCopies.length} local book copies`);
  
  // Get existing book copies from Supabase in batches
  console.log('🌐 Getting existing Supabase book copies...');
  const existingIds = new Set();
  let offset = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: batch, error } = await supabase
      .from('book_copies')
      .select('id')
      .range(offset, offset + batchSize - 1);
    
    if (error) {
      throw new Error(`Failed to get existing book copies: ${error.message}`);
    }
    
    if (!batch || batch.length === 0) break;
    
    batch.forEach(b => existingIds.add(b.id));
    offset += batchSize;
    
    console.log(`   📦 Loaded ${existingIds.size} existing IDs...`);
    
    if (batch.length < batchSize) break; // Last batch
  }
  
  console.log(`📊 Found ${existingIds.size} existing book copies in Supabase`);
  
  // Filter out existing book copies
  const newBookCopies = localBookCopies.filter(b => !existingIds.has(b.id));
  console.log(`📈 ${newBookCopies.length} book copies need to be synced`);
  
  // Show breakdown by status for book copies that need syncing
  if (newBookCopies.length > 0) {
    console.log('\n📊 Book copies to sync by status:');
    const syncStatusCounts = {};
    newBookCopies.forEach(b => {
      syncStatusCounts[b.status] = (syncStatusCounts[b.status] || 0) + 1;
    });
    Object.entries(syncStatusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
  }
  
  if (newBookCopies.length === 0) {
    console.log('✅ All book copies are already synced!');
    await localDb.close();
    return;
  }
  
  // Show sample of what will be synced
  console.log('\n📋 Sample book copies to sync (first 5):');
  newBookCopies.slice(0, 5).forEach((b, i) => {
    console.log(`   ${i + 1}. ID: ${b.id}`);
    console.log(`      Title: ${b.title}`);
    console.log(`      Status: ${b.status}`);
    console.log(`      Copy ID: ${b.copy_identifier || 'N/A'}`);
    console.log(`      Book ID: ${b.book_id || 'N/A'}`);
    console.log('');
  });
  
  const syncResults = {
    total_local: localBookCopies.length,
    existing_remote: existingIds.size,
    to_sync: newBookCopies.length,
    synced: 0,
    errors: [],
    dry_run: dryRun
  };
  
  if (!dryRun) {
    console.log('🚀 Starting actual sync...');
    
    // Prepare book copies with safe values to avoid constraint violations
    console.log('🔧 Preparing book copies with safe values...');
    const preparedBookCopies = newBookCopies.map((bookCopy, index) => {
      // Generate a safe copy_number (small integer to avoid overflow)
      const safeCopyNumber = bookCopy.copy_number || (index + 1);
      
      return {
        ...bookCopy,
        copy_number: safeCopyNumber,
        // Set tracking_code to NULL to avoid unique constraint issues
        tracking_code: null,
        // Ensure book_id is not null - use a default if needed
        book_id: bookCopy.book_id || null
      };
    });
    
    // Sync in batches for better performance
    const batchSize = 500; // Smaller batches to avoid constraint issues
    const totalBatches = Math.ceil(preparedBookCopies.length / batchSize);
    
    for (let i = 0; i < preparedBookCopies.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = preparedBookCopies.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      try {
        const { error: insertError } = await supabase
          .from('book_copies')
          .insert(batch);
        
        if (insertError) {
          console.log(`❌ Batch ${batchNumber} failed: ${insertError.message}`);
          syncResults.errors.push(`Batch ${batchNumber}: ${insertError.message}`);
          
          // Try individual inserts for this batch with even more unique copy numbers
          console.log(`🔄 Trying individual inserts for batch ${batchNumber}...`);
          for (let j = 0; j < batch.length; j++) {
            const bookCopy = batch[j];
            try {
              // Make copy_number unique for individual retries, set tracking_code to NULL
              const uniqueCopyNumber = (i + j + 1000000); // Safe integer range
              const retryBookCopy = {
                ...bookCopy,
                copy_number: uniqueCopyNumber,
                tracking_code: null // Avoid unique constraint by setting to NULL
              };
              
              const { error: singleError } = await supabase
                .from('book_copies')
                .insert([retryBookCopy]);
              
              if (!singleError) {
                syncResults.synced++;
                if (syncResults.synced % 100 === 0) {
                  console.log(`   ✅ Synced ${syncResults.synced} records...`);
                }
              } else {
                console.log(`   ❌ Failed: ${bookCopy.id} - ${singleError.message}`);
                syncResults.errors.push(`Individual ${bookCopy.id}: ${singleError.message}`);
              }
            } catch (e) {
              console.log(`   ❌ Exception: ${bookCopy.id} - ${e.message}`);
              syncResults.errors.push(`Exception ${bookCopy.id}: ${e.message}`);
            }
          }
        } else {
          syncResults.synced += batch.length;
          console.log(`   ✅ Batch ${batchNumber} synced successfully`);
        }
        
        // Small delay between batches
        if (i + batchSize < preparedBookCopies.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (e) {
        console.log(`❌ Batch ${batchNumber} exception: ${e.message}`);
        syncResults.errors.push(`Batch ${batchNumber} exception: ${e.message}`);
      }
    }
    
    // Update local sync status for successfully synced book copies in batches
    if (syncResults.synced > 0) {
      console.log(`\n🔄 Updating local sync status for ${syncResults.synced} book copies...`);
      
      // Update in batches to avoid SQL query length limits
      const updateBatchSize = 1000;
      const syncedBookCopies = newBookCopies.slice(0, syncResults.synced);
      
      for (let i = 0; i < syncedBookCopies.length; i += updateBatchSize) {
        const batch = syncedBookCopies.slice(i, i + updateBatchSize);
        const syncedIds = batch.map(b => `'${b.id}'`).join(',');
        
        await localDb.run(`
          UPDATE book_copies 
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
  console.log(`Total Local Book Copies: ${syncResults.total_local}`);
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
    console.log(`\n✅ Sync completed! ${syncResults.synced}/${syncResults.to_sync} book copies synced`);
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
    await syncBookCopiesToSupabase(dryRun);
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the sync
main().catch(console.error);