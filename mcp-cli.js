#!/usr/bin/env node

/**
 * Simple CLI tool to interact with the Supabase MCP Server
 * Usage: node mcp-cli.js <tool_name> [arguments...]
 */

import { spawn } from 'child_process';
import readline from 'readline';

class MCPClient {
  constructor() {
    this.server = null;
    this.messageId = 1;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async startServer() {
    console.log('🚀 Starting Supabase MCP Server...\n');
    
    this.server = spawn('node', ['supabase-mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.server.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message.includes('running on stdio')) {
        console.log('✅ MCP Server is ready!\n');
      }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params
    };

    const requestString = JSON.stringify(request) + '\n';
    this.server.stdin.write(requestString);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout after 10 seconds'));
      }, 10000);

      const handleData = (data) => {
        clearTimeout(timeout);
        this.server.stdout.removeListener('data', handleData);
        
        try {
          const lines = data.toString().trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const response = JSON.parse(lastLine);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      };

      this.server.stdout.on('data', handleData);
    });
  }

  async showMenu() {
    console.log('📋 Available Commands:');
    console.log('1. List all available tools');
    console.log('2. Analyze table schema');
    console.log('3. Search table data');
    console.log('4. Find duplicate records');
    console.log('5. Get table statistics');
    console.log('6. Analyze borrowing patterns');
    console.log('7. Check data integrity');
    console.log('8. Run custom query');
    console.log('9. Quick duplicate borrowings check');
    console.log('0. Exit');
    console.log('');
  }

  async getUserChoice() {
    return new Promise((resolve) => {
      this.rl.question('👉 Enter your choice (0-9): ', (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async getUserInput(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async handleChoice(choice) {
    try {
      switch (choice) {
        case '1':
          await this.listTools();
          break;
        case '2':
          await this.analyzeTableSchema();
          break;
        case '3':
          await this.searchTableData();
          break;
        case '4':
          await this.findDuplicates();
          break;
        case '5':
          await this.getTableStats();
          break;
        case '6':
          await this.analyzeBorrowingPatterns();
          break;
        case '7':
          await this.checkDataIntegrity();
          break;
        case '8':
          await this.runCustomQuery();
          break;
        case '9':
          await this.quickDuplicateCheck();
          break;
        case '0':
          return false;
        default:
          console.log('❌ Invalid choice. Please try again.\n');
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
    }
    return true;
  }

  async listTools() {
    console.log('\n🔧 Listing available tools...');
    const response = await this.sendRequest('tools/list');
    
    if (response.result?.tools) {
      console.log(`\n✅ Found ${response.result.tools.length} tools:\n`);
      response.result.tools.forEach((tool, index) => {
        console.log(`${index + 1}. ${tool.name}`);
        console.log(`   Description: ${tool.description}\n`);
      });
    } else {
      console.log('❌ No tools found');
    }
  }

  async analyzeTableSchema() {
    const tableName = await this.getUserInput('\n📊 Enter table name (books, students, staff, borrowings, etc.): ');
    
    console.log(`\n🔍 Analyzing schema for table: ${tableName}`);
    const response = await this.sendRequest('tools/call', {
      name: 'analyze_table_schema',
      arguments: { table_name: tableName }
    });
    
    if (response.result?.content) {
      console.log('\n✅ Schema Analysis Result:');
      console.log(response.result.content[0].text);
    } else if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    }
    console.log('');
  }

  async searchTableData() {
    const tableName = await this.getUserInput('\n🔍 Enter table name: ');
    const searchQuery = await this.getUserInput('Enter search term (or press Enter for all): ');
    const limit = await this.getUserInput('Enter limit (default 5): ') || '5';
    
    console.log(`\n🔍 Searching ${tableName} for "${searchQuery || 'all records'}"...`);
    const response = await this.sendRequest('tools/call', {
      name: 'search_table_data',
      arguments: { 
        table_name: tableName,
        search_query: searchQuery,
        limit: parseInt(limit)
      }
    });
    
    if (response.result?.content) {
      console.log('\n✅ Search Results:');
      console.log(response.result.content[0].text);
    } else if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    }
    console.log('');
  }

  async findDuplicates() {
    const tableName = await this.getUserInput('\n🔄 Enter table name: ');
    const columns = await this.getUserInput('Enter columns to check for duplicates (comma-separated): ');
    
    console.log(`\n🔍 Checking for duplicates in ${tableName}...`);
    const response = await this.sendRequest('tools/call', {
      name: 'analyze_duplicates',
      arguments: { 
        table_name: tableName,
        duplicate_columns: columns
      }
    });
    
    if (response.result?.content) {
      console.log('\n✅ Duplicate Analysis:');
      console.log(response.result.content[0].text);
    } else if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    }
    console.log('');
  }

  async getTableStats() {
    const tableName = await this.getUserInput('\n📋 Enter table name: ');
    
    console.log(`\n📊 Getting statistics for ${tableName}...`);
    const response = await this.sendRequest('tools/call', {
      name: 'get_table_stats',
      arguments: { table_name: tableName }
    });
    
    if (response.result?.content) {
      console.log('\n✅ Table Statistics:');
      console.log(response.result.content[0].text);
    } else if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    }
    console.log('');
  }

  async analyzeBorrowingPatterns() {
    console.log('\n📈 Borrowing Pattern Analysis Options:');
    console.log('1. active_borrowings - Show all active borrowings');
    console.log('2. duplicate_borrowings - Find duplicate borrowing records');
    
    const choice = await this.getUserInput('Enter choice (1-2): ');
    const analysisTypes = {
      '1': 'active_borrowings',
      '2': 'duplicate_borrowings'
    };
    
    const analysisType = analysisTypes[choice];
    if (!analysisType) {
      console.log('❌ Invalid choice');
      return;
    }
    
    console.log(`\n🔍 Running ${analysisType} analysis...`);
    const response = await this.sendRequest('tools/call', {
      name: 'analyze_borrowing_patterns',
      arguments: { analysis_type: analysisType }
    });
    
    if (response.result?.content) {
      console.log('\n✅ Borrowing Pattern Analysis:');
      console.log(response.result.content[0].text);
    } else if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    }
    console.log('');
  }

  async checkDataIntegrity() {
    console.log('\n🔍 Data Integrity Check Options:');
    console.log('1. orphaned_borrowings - Check for borrowings without valid references');
    
    const choice = await this.getUserInput('Enter choice: ');
    const checkTypes = {
      '1': 'orphaned_borrowings'
    };
    
    const checkType = checkTypes[choice];
    if (!checkType) {
      console.log('❌ Invalid choice');
      return;
    }
    
    console.log(`\n🔍 Running ${checkType} check...`);
    const response = await this.sendRequest('tools/call', {
      name: 'check_data_integrity',
      arguments: { check_type: checkType }
    });
    
    if (response.result?.content) {
      console.log('\n✅ Data Integrity Check:');
      console.log(response.result.content[0].text);
    } else if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    }
    console.log('');
  }

  async runCustomQuery() {
    const tableName = await this.getUserInput('\n🔧 Enter table name: ');
    const columns = await this.getUserInput('Enter columns to select (default: *): ') || '*';
    const limit = await this.getUserInput('Enter limit (default: 10): ') || '10';
    
    console.log(`\n🔍 Running custom query on ${tableName}...`);
    const response = await this.sendRequest('tools/call', {
      name: 'run_custom_query',
      arguments: { 
        table_name: tableName,
        select_columns: columns,
        limit: parseInt(limit)
      }
    });
    
    if (response.result?.content) {
      console.log('\n✅ Custom Query Results:');
      console.log(response.result.content[0].text);
    } else if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    }
    console.log('');
  }

  async quickDuplicateCheck() {
    console.log('\n⚡ Quick Duplicate Borrowings Check...');
    const response = await this.sendRequest('tools/call', {
      name: 'analyze_borrowing_patterns',
      arguments: { analysis_type: 'duplicate_borrowings' }
    });
    
    if (response.result?.content) {
      console.log('\n✅ Quick Duplicate Check Results:');
      console.log(response.result.content[0].text);
    } else if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    }
    console.log('');
  }

  async run() {
    try {
      await this.startServer();
      
      console.log('🎯 Supabase Database Analyzer - Interactive CLI');
      console.log('===============================================\n');
      
      let continueRunning = true;
      while (continueRunning) {
        await this.showMenu();
        const choice = await this.getUserChoice();
        continueRunning = await this.handleChoice(choice);
      }
      
      console.log('👋 Goodbye!');
    } catch (error) {
      console.error(`💥 Fatal error: ${error.message}`);
    } finally {
      if (this.server) {
        this.server.kill();
      }
      this.rl.close();
    }
  }
}

// Run the CLI if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new MCPClient();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    if (client.server) {
      client.server.kill();
    }
    client.rl.close();
    process.exit(0);
  });
  
  client.run().catch(console.error);
}
