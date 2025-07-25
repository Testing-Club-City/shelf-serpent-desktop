# Legacy Database Migration Module

This module allows you to import data from your old library management system (SQLite) into the Shelf Serpent Archive Manager.

## Features

- Import books, students, borrowings, and categories from your old system
- Map old student records to appropriate classes based on creation year
- Store old book IDs as metadata for reference
- Generate new tracking codes for imported books
- Track migration progress and view detailed reports

## How to Use

### 1. Prepare Your Old Database

Make sure you have a SQLite database file (.db or .sqlite) from your old library system.

### 2. Upload the Database

- Navigate to Admin Panel > Data Management > Legacy Data Migration
- Upload your SQLite database file
- The system will validate the file structure

### 3. Configure Migration Settings

- Select what data to import (books, students, borrowings, categories)
- Configure student class assignments based on creation year
- Choose how to handle book tracking codes and metadata
- Set conflict handling strategy and batch size

### 4. Start Migration

- Click "Start Migration" to begin the import process
- Monitor progress in real-time
- View detailed logs of the migration process

### 5. Review Migration Reports

- After migration completes, view detailed reports of imported data
- Export reports for your records
- Verify that all data was imported correctly

## Database Mapping

| Old System (SQLite) | New System (PostgreSQL) |
|---------------------|-------------------------|
| BookDetails | books + book_copies |
| MemberDetails | students |
| IssueDetails | borrowings (status="borrowed") |
| SubmittedBooks | borrowings (status="returned") |
| Categories | categories |

## Metadata Storage

The migration process stores metadata about imported records in the `migration_metadata` table, which allows you to:

- Track which records were imported from the old system
- Reference old IDs when needed
- Generate reports on imported data

## Technical Details

The migration process uses a combination of:

1. **SQLite Processing**: Reading data from the old database file
2. **Data Transformation**: Converting old schema to new schema
3. **Supabase Integration**: Writing data to the new database
4. **Metadata Tracking**: Recording relationships between old and new records

## Troubleshooting

If you encounter issues during migration:

- Check the migration logs for specific error messages
- Verify that your SQLite file is not corrupted
- Ensure you have sufficient permissions in Supabase
- For large databases, try reducing the batch size

## Support

For assistance with database migration, please contact the system administrator or refer to the main documentation. 