#!/bin/bash

# CLI tool to check Supabase schema using curl
# Usage: ./check_schema.sh [table_name]

# Configuration - actual values from codebase
SUPABASE_URL="https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

# Default tables to check
TABLES=("classes" "students" "books" "book_copies" "borrowings" "categories" "fines" "group_borrowings" "theft_reports")

check_table() {
    local table_name=$1
    echo ""
    echo "=== $table_name ==="
    
    # Check if table exists and get schema
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        "$SUPABASE_URL/rest/v1/$table_name?select=*&limit=1" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY")
    
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTP_STATUS:.*//')
    
    if [ "$http_status" = "200" ]; then
        if [ "$body" = "[]" ] || [ "$body" = "" ]; then
            echo "✅ $table_name exists but has no data"
        else
            echo "✅ $table_name exists with data"
            echo "Columns:"
            echo "$body" | jq -r '.[0] | keys_unsorted[]' 2>/dev/null || echo "  (install jq for better formatting)"
            
            # Get count
            count=$(curl -s "$SUPABASE_URL/rest/v1/$table_name?select=*" \
                -H "apikey: $SUPABASE_KEY" \
                -H "Authorization: Bearer $SUPABASE_KEY" | jq length 2>/dev/null || echo "unknown")
            echo "Total records: $count"
        fi
    elif [ "$http_status" = "404" ]; then
        echo "❌ $table_name does not exist"
    else
        echo "❌ Error checking $table_name (HTTP $http_status)"
    fi
}

# Check if configuration is set
if [[ "$SUPABASE_URL" == *"your-supabase-url"* ]] || [[ "$SUPABASE_KEY" == *"your-anon-key"* ]]; then
    echo "❌ Please update SUPABASE_URL and SUPABASE_KEY in this file"
    echo "Replace 'your-supabase-url' and 'your-anon-key' with actual values"
    exit 1
fi

# Main execution
if [ $# -eq 0 ]; then
    echo "🔍 Checking all tables in Supabase..."
    for table in "${TABLES[@]}"; do
        check_table "$table"
    done
else
    echo "🔍 Checking specific table: $1"
    check_table "$1"
fi

echo ""
echo "✅ Schema check completed!"

# Make executable: chmod +x check_schema.sh
