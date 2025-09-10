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

async function checkActualSyncStatus() {
  console.log('🔍 Checking Actual Sync Status Between Local and Supabase\n');
  
  const localDb = await getLocalDb();
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get local borrowings sample
  console.log('📚 Getting local borrowings sample...');
  const localSample = await localDb.all(`
    SELECT id, status, borrowed_date, created_at, synced, sync_version
    FROM borrowings 
    WHERE deleted = 0 OR deleted IS NULL
    ORDER BY created_at DESC
    LIMIT 20
  `);
  
  console.log(`📊 Sample of ${localSample.length} recent local borrowings:`);
  localSample.forEach((b, i) => {
    console.log(`   ${i + 1}. ${b.id} - ${b.status} - ${b.borrowed_date} (synced: ${b.synced})`);
  });
  
  // Check if these exist in Supabase
  console.log('\n🌐 Checking if these exist in Supabase...');
  const sampleIds = localSample.map(b => b.id);
  
  const { data: existingInSupabase, error } = await supabase
    .from('borrowings')
    .select('id, status, borrowed_date')
    .in('id', sampleIds);
  
  if (error) {
    console.error('❌ Error checking Supabase:', error.message);
    return;
  }
  
  const supabaseIds = new Set(existingInSupabase?.map(b => b.id) || []);
  
  console.log(`📊 Found ${supabaseIds.size}/${sampleIds.length} of these borrowings in Supabase`);
  
  // Show which ones are missing
  const missing = localSample.filter(b => !supabaseIds.has(b.id));
  if (missing.length > 0) {
    console.log(`\n❌ Missing from Supabase (${missing.length}):`);
    missing.forEach((b, i) => {
      console.log(`   ${i + 1}. ${b.id} - ${b.status} - ${b.borrowed_date} (local synced: ${b.synced})`);
    });
  }
  
  // Get comprehensive stats
  console.log('\n📊 Comprehensive Statistics:');
  
  // Local stats
  const localStats = await localDb.get(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN synced = 1 THEN 1 END) as marked_synced,
      COUNT(CASE WHEN synced = 0 OR synced IS NULL THEN 1 END) as marked_unsynced,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned,
      MIN(created_at) as oldest,
      MAX(created_at) as newest
    FROM borrowings 
    WHERE deleted = 0 OR deleted IS NULL
  `);
  
  console.log('📍 Local Database:');
  console.log(`   Total: ${localStats.total}`);
  console.log(`   Marked as Synced: ${localStats.marked_synced}`);
  console.log(`   Marked as Unsynced: ${localStats.marked_unsynced}`);
  console.log(`   Active: ${localStats.active}`);
  console.log(`   Returned: ${localStats.returned}`);
  console.log(`   Date Range: ${localStats.oldest} to ${localStats.newest}`);
  
  // Supabase stats
  const { count: supabaseTotal, error: countError } = await supabase
    .from('borrowings')
    .select('*', { count: 'exact', head: true });
  
  if (!countError) {
    console.log('\n🌐 Supabase Database:');
    console.log(`   Total: ${supabaseTotal}`);
    console.log(`   Gap: ${localStats.total - supabaseTotal} borrowings not in Supabase`);
    
    // Get Supabase date range
    const { data: supabaseDateRange } = await supabase
      .from('borrowings')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1);
    
    const { data: supabaseDateRangeMax } = await supabase
      .from('borrowings')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (supabaseDateRange?.[0] && supabaseDateRangeMax?.[0]) {
      console.log(`   Date Range: ${supabaseDateRange[0].created_at} to ${supabaseDateRangeMax[0].created_at}`);
    }
  }
  
  // Check for recent borrowings that should be synced
  console.log('\n🕒 Checking recent borrowings (last 7 days):');
  const recentLocal = await localDb.all(`
    SELECT id, status, borrowed_date, created_at, synced
    FROM borrowings 
    WHERE (deleted = 0 OR deleted IS NULL)
      AND created_at >= datetime('now', '-7 days')
    ORDER BY created_at DESC
    LIMIT 50
  `);
  
  if (recentLocal.length > 0) {
    console.log(`📊 Found ${recentLocal.length} recent local borrowings`);
    
    const recentIds = recentLocal.map(b => b.id);
    const { data: recentInSupabase } = await supabase
      .from('borrowings')
      .select('id')
      .in('id', recentIds);
    
    const recentSupabaseIds = new Set(recentInSupabase?.map(b => b.id) || []);
    const recentMissing = recentLocal.filter(b => !recentSupabaseIds.has(b.id));
    
    console.log(`📊 ${recentSupabaseIds.size}/${recentLocal.length} recent borrowings are in Supabase`);
    console.log(`❌ ${recentMissing.length} recent borrowings are missing from Supabase`);
    
    if (recentMissing.length > 0) {
      console.log('\n📋 Recent missing borrowings (first 10):');
      recentMissing.slice(0, 10).forEach((b, i) => {
        console.log(`   ${i + 1}. ${b.id} - ${b.status} - ${b.created_at} (synced: ${b.synced})`);
      });
    }
  }
  
  await localDb.close();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SYNC STATUS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Local Total: ${localStats.total}`);
  console.log(`Supabase Total: ${supabaseTotal || 0}`);
  console.log(`Missing from Supabase: ${localStats.total - (supabaseTotal || 0)}`);
  console.log(`Local marked as synced: ${localStats.marked_synced}`);
  console.log(`Actual sync accuracy: ${((supabaseTotal || 0) / localStats.total * 100).toFixed(1)}%`);
  
  if (localStats.total - (supabaseTotal || 0) > 0) {
    console.log('\n💡 Recommendation: Run the sync script to push missing borrowings to Supabase');
    console.log('   Command: node sync-borrowings-to-supabase.js --sync');
  } else {
    console.log('\n✅ All borrowings appear to be synced!');
  }
}

async function main() {
  try {
    await checkActualSyncStatus();
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the check
main().catch(console.error);