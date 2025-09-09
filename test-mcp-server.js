#!/usr/bin/env node

/**
 * Test script for the Supabase MCP Server
 * This script tests the various tools provided by the MCP server
 */

import { spawn } from 'child_process';
import { Readable, Writable } from 'stream';

class MCPTester {
  constructor() {
    this.server = null;
    this.messageId = 1;
  }

  async startServer() {
    console.log('🚀 Starting Supabase MCP Server...');
    
    this.server = spawn('node', ['supabase-mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Server started');
  }

  async sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params
    };

    const requestString = JSON.stringify(request) + '\n';
    
    console.log(`📤 Sending request: ${method}`);
    console.log(`   Params: ${JSON.stringify(params, null, 2)}`);
    
    this.server.stdin.write(requestString);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const handleData = (data) => {
        clearTimeout(timeout);
        this.server.stdout.removeListener('data', handleData);
        
        try {
          const response = JSON.parse(data.toString());
          console.log(`📥 Response received:`);
          console.log(JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      };

      this.server.stdout.on('data', handleData);
    });
  }

  async testListTools() {
    console.log('\n🔧 Testing: List Tools');
    try {
      const response = await this.sendRequest('tools/list');
      console.log(`✅ Found ${response.result?.tools?.length || 0} tools`);
      return response.result?.tools || [];
    } catch (error) {
      console.error(`❌ List tools failed: ${error.message}`);
      return [];
    }
  }

  async testAnalyzeTableSchema() {
    console.log('\n📊 Testing: Analyze Table Schema');
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'analyze_table_schema',
        arguments: {
          table_name: 'borrowings'
        }
      });
      console.log('✅ Table schema analysis completed');
      return response;
    } catch (error) {
      console.error(`❌ Schema analysis failed: ${error.message}`);
      return null;
    }
  }

  async testSearchTableData() {
    console.log('\n🔍 Testing: Search Table Data');
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'search_table_data',
        arguments: {
          table_name: 'students',
          search_query: 'John',
          limit: 3
        }
      });
      console.log('✅ Table search completed');
      return response;
    } catch (error) {
      console.error(`❌ Table search failed: ${error.message}`);
      return null;
    }
  }

  async testAnalyzeDuplicates() {
    console.log('\n🔄 Testing: Analyze Duplicates');
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'analyze_duplicates',
        arguments: {
          table_name: 'borrowings',
          duplicate_columns: 'borrower_id,book_id'
        }
      });
      console.log('✅ Duplicate analysis completed');
      return response;
    } catch (error) {
      console.error(`❌ Duplicate analysis failed: ${error.message}`);
      return null;
    }
  }

  async testBorrowingPatterns() {
    console.log('\n📈 Testing: Borrowing Patterns');
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'analyze_borrowing_patterns',
        arguments: {
          analysis_type: 'duplicate_borrowings'
        }
      });
      console.log('✅ Borrowing pattern analysis completed');
      return response;
    } catch (error) {
      console.error(`❌ Borrowing pattern analysis failed: ${error.message}`);
      return null;
    }
  }

  async testGetTableStats() {
    console.log('\n📋 Testing: Get Table Stats');
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'get_table_stats',
        arguments: {
          table_name: 'books'
        }
      });
      console.log('✅ Table stats retrieval completed');
      return response;
    } catch (error) {
      console.error(`❌ Table stats failed: ${error.message}`);
      return null;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting MCP Server Tests\n');
    
    try {
      await this.startServer();
      
      // Test all functionality
      const tools = await this.testListTools();
      await this.testAnalyzeTableSchema();
      await this.testSearchTableData();
      await this.testAnalyzeDuplicates();
      await this.testBorrowingPatterns();
      await this.testGetTableStats();
      
      console.log('\n🎉 All tests completed!');
      console.log(`📊 Total tools available: ${tools.length}`);
      
    } catch (error) {
      console.error(`\n💥 Test suite failed: ${error.message}`);
    } finally {
      if (this.server) {
        console.log('\n🛑 Stopping server...');
        this.server.kill();
      }
    }
  }

  async stopServer() {
    if (this.server) {
      this.server.kill();
      console.log('✅ Server stopped');
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MCPTester();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, stopping...');
    await tester.stopServer();
    process.exit(0);
  });
  
  tester.runAllTests().catch(console.error);
}
