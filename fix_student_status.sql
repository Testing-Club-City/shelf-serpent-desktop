-- Fix Student Status Issue in Shelf Serpent Desktop
-- This script changes 'graduated' status to 'inactive' to match UI expectations
-- Run this in your SQLite database client

-- First, let's see the current status distribution
SELECT 'BEFORE FIX - Status Distribution:' as info;
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM students), 1) as percentage
FROM students 
GROUP BY status
ORDER BY count DESC;

-- Show how many students will be affected
SELECT 'Students to be updated:' as info;
SELECT COUNT(*) as students_with_graduated_status 
FROM students 
WHERE status = 'graduated';

-- Apply the fix: Change 'graduated' status to 'inactive'
UPDATE students 
SET status = 'inactive', 
    updated_at = datetime('now') 
WHERE status = 'graduated';

-- Show the results after the fix
SELECT 'AFTER FIX - Status Distribution:' as info;
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM students), 1) as percentage
FROM students 
GROUP BY status
ORDER BY count DESC;

-- Verify no 'graduated' status remains
SELECT 'Verification - Students with graduated status:' as info;
SELECT COUNT(*) as remaining_graduated_students 
FROM students 
WHERE status = 'graduated';

-- Show some examples of the fixed records
SELECT 'Sample of fixed student records:' as info;
SELECT 
    admission_number,
    first_name,
    last_name,
    class_grade,
    status,
    updated_at
FROM students 
WHERE status = 'inactive'
ORDER BY updated_at DESC
LIMIT 5;
