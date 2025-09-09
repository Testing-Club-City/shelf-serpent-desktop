# PowerShell script to check Supabase schema
# Usage: ./check_schema.ps1

$SupabaseUrl = "https://ddlzenlqkofefdwdefzm.supabase.co"
$SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

$Tables = @("classes", "students", "books", "book_copies", "borrowings", "categories", "fines", "group_borrowings", "theft_reports")

function Check-TableSchema {
    param($TableName)
    
    Write-Host ""
    Write-Host "=== $TableName ===" -ForegroundColor Cyan
    
    try {
        $headers = @{
            "apikey" = $SupabaseKey
            "Authorization" = "Bearer $SupabaseKey"
        }
        
        $response = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/$TableName?select=*&limit=1" -Headers $headers
        
        if ($response.Count -gt 0) {
            Write-Host "✅ $TableName exists" -ForegroundColor Green
            Write-Host "Columns found:"
            $response[0].PSObject.Properties.Name | ForEach-Object {
                Write-Host "  - $_" -ForegroundColor Yellow
            }
            
            # Get total count
            $countResponse = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/$TableName?select=*" -Headers $headers
            Write-Host "Total records: $($countResponse.Count)" -ForegroundColor Green
        } else {
            Write-Host "✅ $TableName exists but has no data" -ForegroundColor Yellow
        }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "❌ $TableName does not exist" -ForegroundColor Red
        } else {
            Write-Host "❌ Error checking $TableName: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "🔍 Checking Supabase Schema..." -ForegroundColor Magenta
Write-Host "URL: $SupabaseUrl" -ForegroundColor Gray

foreach ($table in $Tables) {
    Check-TableSchema $table
}

Write-Host ""
Write-Host "✅ Schema check completed!" -ForegroundColor Green
