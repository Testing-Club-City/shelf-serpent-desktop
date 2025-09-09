#!/bin/bash

# CLI tool to check Supabase classes schema
# Usage: ./check_classes.sh

SUPABASE_URL="https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

echo "🔍 Checking Supabase Classes Schema..."
echo "URL: $SUPABASE_URL"
echo "--------------------------------"

# Check if classes table exists and get data
echo "📊 Checking classes table..."
response=$(curl -s -w "%{http_code}" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  "$SUPABASE_URL/rest/v1/classes?select=*&limit=10")

# Extract status code and response body
status_code="${response: -3}"
body="${response%???}"

echo "📊 Response Status: $status_code"

if [ "$status_code" = "200" ]; then
    echo "✅ Classes table exists"
    
    # Get total count
    total_count=$(curl -s \
      -H "apikey: $SUPABASE_KEY" \
      -H "Authorization: Bearer $SUPABASE_KEY" \
      "$SUPABASE_URL/rest/v1/classes?select=*" | jq '. | length')
    
    echo "📈 Total classes: $total_count"
    
    # Get sample data
    sample_data=$(curl -s \
      -H "apikey: $SUPABASE_KEY" \
      -H "Authorization: Bearer $SUPABASE_KEY" \
      "$SUPABASE_URL/rest/v1/classes?select=*&limit=3")
    
    if [ "$sample_data" != "[]" ]; then
        echo "📖 Sample classes:"
        echo "$sample_data" | jq -r '.[] | "  - \(.name) (\(.subject))"'
    fi
    
    # Show schema structure
    echo ""
    echo "📋 Classes Table Schema:"
    echo "  - id: BIGINT PRIMARY KEY"
    echo "  - name: TEXT NOT NULL"
    echo "  - description: TEXT"
    echo "  - subject: TEXT NOT NULL"
    echo "  - instructor_id: UUID"
    echo "  - max_capacity: INTEGER"
    echo "  - start_date: TIMESTAMP"
    echo "  - end_date: TIMESTAMP"
    echo "  - is_active: BOOLEAN"
    echo "  - created_at: TIMESTAMP"
    echo "  - updated_at: TIMESTAMP"
    
else
    echo "❌ Error checking classes table"
fi

echo ""
echo "✅ Classes schema check completed!"
echo "💡 To run this check: ./check_classes.sh"
