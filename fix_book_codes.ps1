# PowerShell script to fix missing book codes
# This calls the database function to create missing book codes

Write-Host "🔧 Fixing missing book codes..." -ForegroundColor Yellow

# Note: This assumes you have access to run SQL commands on your Supabase instance
# You would need to replace the connection details with your actual database info

$sql = @"
-- SQL to fix missing book codes
UPDATE books 
SET book_code = CASE 
    WHEN LENGTH(title) >= 3 THEN UPPER(LEFT(REGEXP_REPLACE(title, '[^A-Za-z]', '', 'g'), 3))
    ELSE 'BK'
END
WHERE book_code IS NULL OR book_code = '';

-- Alternative: Use the database function if available
SELECT * FROM create_missing_book_copies();
"@

Write-Host "SQL Commands to run:" -ForegroundColor Green
Write-Host $sql
Write-Host ""
Write-Host "⚠️  You'll need to run these SQL commands in your Supabase SQL editor." -ForegroundColor Yellow
Write-Host "🌐 Go to: https://supabase.com/dashboard → Your Project → SQL Editor" -ForegroundColor Cyan
