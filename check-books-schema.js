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

async function getSupabaseTableSchema(supabase, tableName) {
  console.log(`🔍 Getting ${tableName} schema from Supabase...`);
  
  // Get a sample record to understand the structure
  const { data: sampleData, error: sampleError } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  
  if (sampleError) {
    console.log(`❌ Error getting sample data: ${sampleError.message}`);
    return null;
  }
  
  if (!sampleData || sampleData.length === 0) {
    console.log(`⚠️ No data found in ${tableName} table`);
    return null;
  }
  
  const columns = Object.keys(sampleData[0]);
  console.log(`📋 ${tableName} columns:`, columns);
  
  return {
    columns,
    sampleRecord: sampleData[0]
  };
}

async function getLocalTableSchema(localDb, tableName) {
  console.log(`🔍 Getting ${tableName} schema from local database...`);
  
  try {
    // Get table info
    const tableInfo = await localDb.all(`PRAGMA table_info(${tableName})`);
    const columns = tableInfo.map(col => col.name);
    
    // Get a sample record
    const sampleData = await localDb.all(`SELECT * FROM ${tableName} LIMIT 1`);
    
    console.log(`📋 Local ${tableName} columns:`, columns);
    
    return {
      columns,
      tableInfo,
      sampleRecord: sampleData[0] || null
    };
  } catch (error) {
    console.log(`❌ Error getting local ${tableName} schema: ${error.message}`);
    return null;
  }
}

async function compareSchemas(localSchema, supabaseSchema, tableName) {
  console.log(`\n🔄 Comparing ${tableName} schemas...`);
  
  if (!localSchema || !supabaseSchema) {
    console.log(`❌ Cannot compare - missing schema data`);
    return;
  }
  
  const localCols = new Set(localSchema.columns);
  const supabaseCols = new Set(supabaseSchema.columns);
  
  const onlyInLocal = [...localCols].filter(col => !supabaseCols.has(col));
  const onlyInSupabase = [...supabaseCols].filter(col => !localCols.has(col));
  const common = [...localCols].filter(col => supabaseCols.has(col));
  
  console.log(`✅ Common columns (${common.length}):`, common);
  
  if (onlyInLocal.length > 0) {
    console.log(`⚠️ Only in local (${onlyInLocal.length}):`, onlyInLocal);
  }
  
  if (onlyInSupabase.length > 0) {
    console.log(`⚠️ Only in Supabase (${onlyInSupabase.length}):`, onlyInSupabase);
  }
  
  return {
    common,
    onlyInLocal,
    onlyInSupabase,
    compatible: onlyInLocal.length === 0 && onlyInSupabase.length === 0
  };
}

async function getDataCounts(localDb, supabase, tableName) {
  console.log(`📊 Getting data counts for ${tableName}...`);
  
  try {
    // Local count
    const localResult = await localDb.get(`SELECT COUNT(*) as count FROM ${tableName} WHERE deleted = 0 OR deleted IS NULL`);
    const localCount = localResult.count;
    
    // Supabase count
    const { count: supabaseCount, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ Error getting Supabase count: ${error.message}`);
      return { localCount, supabaseCount: 'Error' };
    }
    
    console.log(`📈 ${tableName}: ${localCount} (local) ↔ ${supabaseCount} (Supabase)`);
    
    return { localCount, supabaseCount };
  } catch (error) {
    console.log(`❌ Error getting counts: ${error.message}`);
    return { localCount: 'Error', supabaseCount: 'Error' };
  }
}

async function main() {
  console.log('🔍 BOOKS & BOOK COPIES SCHEMA ANALYSIS\n');
  
  const localDb = await getLocalDb();
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const tables = ['books', 'book_copies'];
  const results = {};
  
  for (const tableName of tables) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 ANALYZING TABLE: ${tableName.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    
    // Get schemas
    const localSchema = await getLocalTableSchema(localDb, tableName);
    const supabaseSchema = await getSupabaseTableSchema(supabase, tableName);
    
    // Compare schemas
    const comparison = await compareSchemas(localSchema, supabaseSchema, tableName);
    
    // Get data counts
    const counts = await getDataCounts(localDb, supabase, tableName);
    
    // Show sample records
    if (localSchema?.sampleRecord) {
      console.log(`\n📋 Sample local ${tableName} record:`);
      console.log(JSON.stringify(localSchema.sampleRecord, null, 2));
    }
    
    if (supabaseSchema?.sampleRecord) {
      console.log(`\n📋 Sample Supabase ${tableName} record:`);
      console.log(JSON.stringify(supabaseSchema.sampleRecord, null, 2));
    }
    
    results[tableName] = {
      localSchema,
      supabaseSchema,
      comparison,
      counts
    };
  }
  
  await localDb.close();
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  for (const [tableName, result] of Object.entries(results)) {
    console.log(`\n📚 ${tableName.toUpperCase()}:`);
    console.log(`   Schema Compatible: ${result.comparison?.compatible ? '✅ Yes' : '❌ No'}`);
    console.log(`   Local Records: ${result.counts.localCount}`);
    console.log(`   Supabase Records: ${result.counts.supabaseCount}`);
    
    if (result.counts.localCount > result.counts.supabaseCount) {
      const missing = result.counts.localCount - result.counts.supabaseCount;
      console.log(`   Missing in Supabase: ${missing} records`);
    }
    
    if (result.comparison?.onlyInLocal?.length > 0) {
      console.log(`   Local-only columns: ${result.comparison.onlyInLocal.join(', ')}`);
    }
  }
  
  console.log(`\n💡 Next steps:`);
  console.log(`   1. If schemas are compatible, create sync scripts`);
  console.log(`   2. Sync books first (dependencies)`);
  console.log(`   3. Then sync book_copies`);
  console.log(`   4. Finally retry failed borrowings`);
}

// Run the analysis
main().catch(console.error);