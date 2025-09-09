import mc from 'minecraft-protocol';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration (copied from client.ts)
const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false // Disable for server usage
  }
});

// MCP server configuration
const server = mc.createServer({
  'online-mode': false,
  encryption: true,
  host: '0.0.0.0',
  port: 25565,
  version: '1.16.4'
});

server.on('login', (client) => {
  console.log(`${client.username} has joined the server.`);
  
  // Send welcome message
  client.write('chat', { 
    message: JSON.stringify({
      text: 'Welcome to the Supabase Database Analyzer! Use /query <table> <search> to search data.',
      color: 'green'
    })
  });

  client.on('chat', async (data) => {
    const message = data.message;

    if (message.startsWith('/query')) {
      const parts = message.replace('/query ', '').trim().split(' ');
      const tableName = parts[0];
      const searchQuery = parts.slice(1).join(' ');

      try {
        if (!tableName) {
          client.write('chat', { 
            message: JSON.stringify({
              text: 'Usage: /query <table> [search_term]',
              color: 'yellow'
            })
          });
          return;
        }

        // Available tables
        const availableTables = ['books', 'students', 'staff', 'borrowings', 'classes', 'categories', 'fines'];
        
        if (!availableTables.includes(tableName)) {
          client.write('chat', { 
            message: JSON.stringify({
              text: `Available tables: ${availableTables.join(', ')}`,
              color: 'yellow'
            })
          });
          return;
        }

        let query = supabase.from(tableName).select('*').limit(10);
        
        // Add search if provided
        if (searchQuery) {
          // Try to search in common text fields
          if (tableName === 'books') {
            query = query.or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%,isbn.ilike.%${searchQuery}%`);
          } else if (tableName === 'students') {
            query = query.or(`name.ilike.%${searchQuery}%,admission_number.ilike.%${searchQuery}%`);
          } else if (tableName === 'staff') {
            query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
          } else {
            // Generic search on id field
            query = query.eq('id', searchQuery);
          }
        }

        const { data: results, error } = await query;

        if (error) {
          client.write('chat', { 
            message: JSON.stringify({
              text: `Error: ${error.message}`,
              color: 'red'
            })
          });
        } else {
          const count = results.length;
          const summary = `Found ${count} records in ${tableName}`;
          
          client.write('chat', { 
            message: JSON.stringify({
              text: summary,
              color: 'green'
            })
          });
          
          // Show first few results
          results.slice(0, 3).forEach((record, index) => {
            const recordText = JSON.stringify(record, null, 2);
            client.write('chat', { 
              message: JSON.stringify({
                text: `Record ${index + 1}: ${recordText.substring(0, 200)}${recordText.length > 200 ? '...' : ''}`,
                color: 'white'
              })
            });
          });
        }
      } catch (err) {
        client.write('chat', { 
          message: JSON.stringify({
            text: `Unexpected error: ${err.message}`,
            color: 'red'
          })
        });
      }
    } else if (message.startsWith('/help')) {
      client.write('chat', { 
        message: JSON.stringify({
          text: 'Commands: /query <table> [search], /tables, /help',
          color: 'aqua'
        })
      });
    } else if (message.startsWith('/tables')) {
      client.write('chat', { 
        message: JSON.stringify({
          text: 'Available tables: books, students, staff, borrowings, classes, categories, fines',
          color: 'aqua'
        })
      });
    }
  });

  client.on('end', () => {
    console.log(`${client.username} has left the server.`);
  });
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

console.log('?? MCP Supabase Database Analyzer server is running on port 25565');
console.log('?? Connected to Supabase:', supabaseUrl);
console.log('?? Connect with Minecraft client to localhost:25565');