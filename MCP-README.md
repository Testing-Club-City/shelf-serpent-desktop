# Supabase MCP Server

A Model Context Protocol (MCP) server for analyzing the Supabase database used in the Library Management System.

## Features

This MCP server provides comprehensive tools for analyzing and querying the Supabase database:

### 🔍 **Database Analysis Tools**

1. **`analyze_table_schema`** - Analyze table structure and schema
2. **`search_table_data`** - Search and retrieve data with filtering
3. **`analyze_duplicates`** - Find duplicate records based on specific columns
4. **`get_table_stats`** - Get statistical information about tables
5. **`analyze_borrowing_patterns`** - Analyze borrowing patterns and relationships
6. **`check_data_integrity`** - Check data integrity and relationships
7. **`run_custom_query`** - Run custom queries with advanced filtering

### 📊 **Supported Tables**

- `books` - Book catalog
- `students` - Student records
- `staff` - Staff records
- `borrowings` - Borrowing transactions
- `classes` - Class information
- `categories` - Book categories
- `fines` - Fine records
- `book_copies` - Book copy inventory

## Installation

1. Install dependencies:
```bash
npm install --package-lock-only --package-lock-json=mcp-package.json
```

2. Start the MCP server:
```bash
node supabase-mcp-server.js
```

## Usage Examples

### Analyze Table Schema
```json
{
  "tool": "analyze_table_schema",
  "arguments": {
    "table_name": "borrowings"
  }
}
```

### Search for Books
```json
{
  "tool": "search_table_data",
  "arguments": {
    "table_name": "books",
    "search_query": "Harry Potter",
    "limit": 5
  }
}
```

### Find Duplicate Borrowings
```json
{
  "tool": "analyze_duplicates",
  "arguments": {
    "table_name": "borrowings",
    "duplicate_columns": "borrower_id,book_id,status"
  }
}
```

### Check for Active Borrowings
```json
{
  "tool": "analyze_borrowing_patterns",
  "arguments": {
    "analysis_type": "active_borrowings"
  }
}
```

### Check Data Integrity
```json
{
  "tool": "check_data_integrity",
  "arguments": {
    "check_type": "orphaned_borrowings"
  }
}
```

## Configuration

The server connects to Supabase using the configuration from the main application:

- **URL**: `https://ddlzenlqkofefdwdefzm.supabase.co`
- **Key**: Uses the anonymous key from the application

## Integration

This MCP server can be integrated with:

- **Claude Desktop** - Add to MCP configuration
- **VS Code Extensions** - Use with MCP-compatible extensions  
- **Command Line Tools** - Direct stdio communication
- **Custom Applications** - Any MCP-compatible client

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│  MCP Server      │───▶│   Supabase DB   │
│  (Claude/IDE)   │    │  (Analysis       │    │  (PostgreSQL)   │
│                 │    │   Tools)         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Error Handling

The server includes comprehensive error handling:
- Connection errors to Supabase
- Invalid table names
- Malformed queries
- Network timeouts
- Authentication issues

## Development

To run in development mode:
```bash
npm run dev
```

This will start the server with file watching for automatic restarts.

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check Supabase URL and key
2. **Table Not Found**: Verify table name spelling
3. **Permission Denied**: Check Supabase RLS policies
4. **Query Timeout**: Reduce query complexity or add indexes

### Debug Mode

Set environment variable for detailed logging:
```bash
DEBUG=mcp:* node supabase-mcp-server.js
```

## Security

- Uses read-only anonymous key
- No sensitive data stored locally
- All queries are logged for audit
- Respects Supabase Row Level Security (RLS)
