#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

class SupabaseMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'supabase-analyzer',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'analyze_table_schema',
            description: 'Analyze the schema and structure of a Supabase table',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Name of the table to analyze',
                  enum: ['books', 'students', 'staff', 'borrowings', 'classes', 'categories', 'fines', 'book_copies']
                }
              },
              required: ['table_name']
            }
          },
          {
            name: 'search_table_data',
            description: 'Search and retrieve data from a Supabase table',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Name of the table to search',
                  enum: ['books', 'students', 'staff', 'borrowings', 'classes', 'categories', 'fines', 'book_copies']
                },
                search_query: {
                  type: 'string',
                  description: 'Search term or filter criteria'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of records to return',
                  default: 10
                },
                columns: {
                  type: 'string',
                  description: 'Comma-separated list of columns to select (default: all)',
                  default: '*'
                }
              },
              required: ['table_name']
            }
          },
          {
            name: 'analyze_duplicates',
            description: 'Find duplicate records in a table based on specific columns',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Name of the table to analyze for duplicates',
                  enum: ['books', 'students', 'staff', 'borrowings', 'classes', 'categories', 'fines', 'book_copies']
                },
                duplicate_columns: {
                  type: 'string',
                  description: 'Comma-separated list of columns to check for duplicates'
                }
              },
              required: ['table_name', 'duplicate_columns']
            }
          },
          {
            name: 'get_table_stats',
            description: 'Get statistical information about a table',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Name of the table to get stats for',
                  enum: ['books', 'students', 'staff', 'borrowings', 'classes', 'categories', 'fines', 'book_copies']
                }
              },
              required: ['table_name']
            }
          },
          {
            name: 'analyze_borrowing_patterns',
            description: 'Analyze borrowing patterns and relationships',
            inputSchema: {
              type: 'object',
              properties: {
                analysis_type: {
                  type: 'string',
                  description: 'Type of borrowing analysis',
                  enum: ['active_borrowings', 'overdue_books', 'popular_books', 'borrower_stats', 'duplicate_borrowings']
                }
              },
              required: ['analysis_type']
            }
          },
          {
            name: 'check_data_integrity',
            description: 'Check data integrity and relationships between tables',
            inputSchema: {
              type: 'object',
              properties: {
                check_type: {
                  type: 'string',
                  description: 'Type of integrity check',
                  enum: ['orphaned_borrowings', 'missing_references', 'invalid_dates', 'inconsistent_status']
                }
              },
              required: ['check_type']
            }
          },
          {
            name: 'run_custom_query',
            description: 'Run a custom Supabase query with advanced filtering',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Name of the table to query'
                },
                select_columns: {
                  type: 'string',
                  description: 'Columns to select',
                  default: '*'
                },
                filter_conditions: {
                  type: 'string',
                  description: 'Filter conditions in Supabase PostgREST format'
                },
                order_by: {
                  type: 'string',
                  description: 'Column to order by'
                },
                limit: {
                  type: 'number',
                  description: 'Limit number of results',
                  default: 50
                }
              },
              required: ['table_name']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'analyze_table_schema':
            return await this.analyzeTableSchema(args.table_name);
          
          case 'search_table_data':
            return await this.searchTableData(args.table_name, args.search_query, args.limit, args.columns);
          
          case 'analyze_duplicates':
            return await this.analyzeDuplicates(args.table_name, args.duplicate_columns);
          
          case 'get_table_stats':
            return await this.getTableStats(args.table_name);
          
          case 'analyze_borrowing_patterns':
            return await this.analyzeBorrowingPatterns(args.analysis_type);
          
          case 'check_data_integrity':
            return await this.checkDataIntegrity(args.check_type);
          
          case 'run_custom_query':
            return await this.runCustomQuery(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async analyzeTableSchema(tableName) {
    try {
      // Get sample data to infer schema
      const { data: sampleData, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(5);

      if (error) throw error;

      // Get count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      let schemaInfo = `Table: ${tableName}\n`;
      schemaInfo += `Total Records: ${count}\n\n`;

      if (sampleData && sampleData.length > 0) {
        schemaInfo += 'Columns:\n';
        const firstRecord = sampleData[0];
        Object.keys(firstRecord).forEach(column => {
          const value = firstRecord[column];
          const type = typeof value;
          schemaInfo += `- ${column}: ${type} ${value === null ? '(nullable)' : ''}\n`;
        });

        schemaInfo += '\nSample Data:\n';
        sampleData.forEach((record, index) => {
          schemaInfo += `Record ${index + 1}: ${JSON.stringify(record, null, 2)}\n`;
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: schemaInfo
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to analyze schema: ${error.message}`);
    }
  }

  async searchTableData(tableName, searchQuery, limit = 10, columns = '*') {
    try {
      let query = supabase.from(tableName).select(columns).limit(limit);

      if (searchQuery) {
        // Apply search filters based on table type
        switch (tableName) {
          case 'books':
            query = query.or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%,isbn.ilike.%${searchQuery}%`);
            break;
          case 'students':
            query = query.or(`name.ilike.%${searchQuery}%,admission_number.ilike.%${searchQuery}%`);
            break;
          case 'staff':
            query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
            break;
          case 'borrowings':
            query = query.or(`borrower_name.ilike.%${searchQuery}%,book_title.ilike.%${searchQuery}%`);
            break;
          default:
            // Try to search by ID if it's a number
            if (!isNaN(searchQuery)) {
              query = query.eq('id', parseInt(searchQuery));
            }
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      let result = `Search Results for "${searchQuery || 'all'}" in ${tableName}:\n`;
      result += `Found ${data.length} records\n\n`;

      data.forEach((record, index) => {
        result += `Record ${index + 1}:\n${JSON.stringify(record, null, 2)}\n\n`;
      });

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async analyzeDuplicates(tableName, duplicateColumns) {
    try {
      const columns = duplicateColumns.split(',').map(col => col.trim());
      
      // Get all data for the specified columns
      const { data, error } = await supabase
        .from(tableName)
        .select(`id,${duplicateColumns}`)
        .order('id');

      if (error) throw error;

      // Find duplicates
      const seen = new Map();
      const duplicates = [];

      data.forEach(record => {
        const key = columns.map(col => record[col]).join('|');
        if (seen.has(key)) {
          duplicates.push({
            duplicate_key: key,
            records: [seen.get(key), record]
          });
        } else {
          seen.set(key, record);
        }
      });

      let result = `Duplicate Analysis for ${tableName} on columns: ${duplicateColumns}\n`;
      result += `Total records: ${data.length}\n`;
      result += `Duplicate groups found: ${duplicates.length}\n\n`;

      if (duplicates.length > 0) {
        duplicates.forEach((dup, index) => {
          result += `Duplicate Group ${index + 1} (key: ${dup.duplicate_key}):\n`;
          dup.records.forEach(record => {
            result += `  ID ${record.id}: ${JSON.stringify(record, null, 2)}\n`;
          });
          result += '\n';
        });
      } else {
        result += 'No duplicates found!\n';
      }

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Duplicate analysis failed: ${error.message}`);
    }
  }

  async getTableStats(tableName) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      // Get latest records
      const { data: latestRecords, error: latestError } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      let result = `Statistics for ${tableName}:\n`;
      result += `Total Records: ${count}\n\n`;

      if (latestRecords && latestRecords.length > 0) {
        result += 'Latest 5 Records:\n';
        latestRecords.forEach((record, index) => {
          result += `${index + 1}. ${JSON.stringify(record, null, 2)}\n`;
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Stats retrieval failed: ${error.message}`);
    }
  }

  async analyzeBorrowingPatterns(analysisType) {
    try {
      let result = '';

      switch (analysisType) {
        case 'active_borrowings':
          const { data: activeBorrowings, error: activeError } = await supabase
            .from('borrowings')
            .select('*')
            .eq('status', 'active');

          if (activeError) throw activeError;

          result = `Active Borrowings Analysis:\n`;
          result += `Total active borrowings: ${activeBorrowings.length}\n\n`;
          
          activeBorrowings.slice(0, 10).forEach((borrowing, index) => {
            result += `${index + 1}. ${borrowing.borrower_name} - ${borrowing.book_title}\n`;
            result += `   Borrowed: ${borrowing.date_borrowed}\n`;
            result += `   Due: ${borrowing.date_due}\n\n`;
          });
          break;

        case 'duplicate_borrowings':
          const { data: allBorrowings, error: borrowError } = await supabase
            .from('borrowings')
            .select('*')
            .order('id');

          if (borrowError) throw borrowError;

          // Find duplicates by borrower and book
          const borrowingMap = new Map();
          const duplicateBorrowings = [];

          allBorrowings.forEach(borrowing => {
            const key = `${borrowing.borrower_id}|${borrowing.book_id}|${borrowing.status}`;
            if (borrowingMap.has(key)) {
              duplicateBorrowings.push({
                key,
                original: borrowingMap.get(key),
                duplicate: borrowing
              });
            } else {
              borrowingMap.set(key, borrowing);
            }
          });

          result = `Duplicate Borrowings Analysis:\n`;
          result += `Total borrowings: ${allBorrowings.length}\n`;
          result += `Potential duplicates: ${duplicateBorrowings.length}\n\n`;

          if (duplicateBorrowings.length > 0) {
            duplicateBorrowings.slice(0, 10).forEach((dup, index) => {
              result += `Duplicate ${index + 1}:\n`;
              result += `  Original: ID ${dup.original.id} - ${dup.original.borrower_name} - ${dup.original.book_title}\n`;
              result += `  Duplicate: ID ${dup.duplicate.id} - ${dup.duplicate.borrower_name} - ${dup.duplicate.book_title}\n\n`;
            });
          }
          break;

        default:
          throw new Error(`Unknown analysis type: ${analysisType}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Borrowing pattern analysis failed: ${error.message}`);
    }
  }

  async checkDataIntegrity(checkType) {
    try {
      let result = '';

      switch (checkType) {
        case 'orphaned_borrowings':
          // Check for borrowings without valid book or borrower references
          const { data: borrowings, error: borrowError } = await supabase
            .from('borrowings')
            .select('*');

          if (borrowError) throw borrowError;

          const orphaned = borrowings.filter(b => !b.book_id || !b.borrower_id);

          result = `Orphaned Borrowings Check:\n`;
          result += `Total borrowings: ${borrowings.length}\n`;
          result += `Orphaned records: ${orphaned.length}\n\n`;

          if (orphaned.length > 0) {
            orphaned.slice(0, 10).forEach((record, index) => {
              result += `${index + 1}. ID: ${record.id}\n`;
              result += `   Book ID: ${record.book_id || 'MISSING'}\n`;
              result += `   Borrower ID: ${record.borrower_id || 'MISSING'}\n\n`;
            });
          }
          break;

        default:
          throw new Error(`Unknown check type: ${checkType}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Data integrity check failed: ${error.message}`);
    }
  }

  async runCustomQuery(args) {
    try {
      let query = supabase.from(args.table_name).select(args.select_columns || '*');

      if (args.filter_conditions) {
        // Apply filters - this is a simplified version
        // In a real implementation, you'd parse the filter conditions properly
        query = query.filter(args.filter_conditions);
      }

      if (args.order_by) {
        query = query.order(args.order_by);
      }

      if (args.limit) {
        query = query.limit(args.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      let result = `Custom Query Results:\n`;
      result += `Table: ${args.table_name}\n`;
      result += `Records found: ${data.length}\n\n`;

      data.forEach((record, index) => {
        result += `Record ${index + 1}:\n${JSON.stringify(record, null, 2)}\n\n`;
      });

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Custom query failed: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Supabase MCP server running on stdio');
  }
}

const server = new SupabaseMCPServer();
server.run().catch(console.error);
