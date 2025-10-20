import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');

try {
  const db = new Database(dbPath, { readonly: true });

  console.log('?? Checking data entry and update timestamps...');

  // Check students table
  console.log('\n?? Students table:');
  const studentTimestamps = db.prepare(`
    SELECT
      MIN(created_at) as earliest_created,
      MAX(created_at) as latest_created,
      MIN(updated_at) as earliest_updated,
      MAX(updated_at) as latest_updated,
      COUNT(*) as total
    FROM students
  `).get();

  console.log(`Total students: ${studentTimestamps.total}`);
  console.log(`Earliest created: ${studentTimestamps.earliest_created}`);
  console.log(`Latest created: ${studentTimestamps.latest_created}`);
  console.log(`Earliest updated: ${studentTimestamps.earliest_updated}`);
  console.log(`Latest updated: ${studentTimestamps.latest_updated}`);

  // Check staff table
  console.log('\n?? Staff table:');
  const staffTimestamps = db.prepare(`
    SELECT
      MIN(created_at) as earliest_created,
      MAX(created_at) as latest_created,
      MIN(updated_at) as earliest_updated,
      MAX(updated_at) as latest_updated,
      COUNT(*) as total
    FROM staff
  `).get();

  console.log(`Total staff: ${staffTimestamps.total}`);
  console.log(`Earliest created: ${staffTimestamps.earliest_created}`);
  console.log(`Latest created: ${staffTimestamps.latest_created}`);
  console.log(`Earliest updated: ${staffTimestamps.earliest_updated}`);
  console.log(`Latest updated: ${staffTimestamps.latest_updated}`);

  // Check sync_log for recent syncs
  console.log('\n?? Recent sync activity:');
  const recentSyncs = db.prepare(`
    SELECT operation, table_name, synced_at, record_count
    FROM sync_log
    WHERE table_name IN ('students', 'staff')
    ORDER BY synced_at DESC
    LIMIT 10
  `).all();

  if (recentSyncs.length > 0) {
    recentSyncs.forEach(sync => {
      console.log(`${sync.synced_at}: ${sync.operation} ${sync.record_count} records in ${sync.table_name}`);
    });
  } else {
    console.log('No recent sync logs found for students/staff');
  }

  // Check activity_logs for user data operations
  console.log('\n?? Recent activity logs:');
  const recentActivities = db.prepare(`
    SELECT action, details, created_at
    FROM activity_logs
    WHERE action LIKE '%student%' OR action LIKE '%staff%' OR action LIKE '%user%'
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  if (recentActivities.length > 0) {
    recentActivities.forEach(activity => {
      console.log(`${activity.created_at}: ${activity.action} - ${activity.details}`);
    });
  } else {
    console.log('No relevant activity logs found');
  }

  db.close();
} catch (error) {
  console.error('Error:', error.message);
}