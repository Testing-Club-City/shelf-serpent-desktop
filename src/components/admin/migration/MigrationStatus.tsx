import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ArrowRight,
  Loader2,
  BookOpen,
  Users,
  FileText,
  Database,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MigrationService } from './MigrationService';

interface MigrationStatusProps {
  file: File | null;
  migrationInProgress: boolean;
  onMigrationComplete: (stats: {
    books: number;
    students: number;
    borrowings: number;
    categories: number;
    fines: number;
    errors: number;
  }) => void;
}

// Replace the SQLiteWorker class with a simpler implementation
// Browser-compatible promisify function
const promisify = (fn: Function) => {
  return (...args: any[]) => {
    return new Promise((resolve, reject) => {
      fn(...args, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };
};

// Add TypeScript declaration for the global initSqlJs function
declare function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<any>;

class SQLiteWorker {
  public db: any = null;
  private file: File | null = null;
  private initPromise: Promise<any> | null = null;
  
  constructor() {
    // Initialize SQL.js when needed
    this.initPromise = this.initSQLJS();
  }
  
  // Initialize SQL.js library with improved error handling and path resolution
  private async initSQLJS() {
    try {
      console.log('Initializing SQL.js...');
      
      // Try loading from local first with more robust path handling
      try {
        // Check if the script is already loaded
        if (!document.querySelector('script[src*="sql-wasm.js"]')) {
          await this.loadScript('/sql-wasm.js');
        }
        console.log('SQL.js script loaded from local path');
      } catch (localError) {
        console.warn('Failed to load SQL.js from local path, trying CDN:', localError);
        // Fallback to CDN with explicit version
        await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js');
        console.log('SQL.js script loaded from CDN');
      }
      
      // Check if initSqlJs is available
      if (typeof initSqlJs !== 'function') {
        throw new Error('SQL.js initialization function not found after loading script');
      }
      
      console.log('Initializing SQL.js with WASM file...');
      
      // Initialize SQL.js with better path resolution
      const SQL = await initSqlJs({
        locateFile: (file: string) => {
          if (file.endsWith('.wasm')) {
            // Try to use an absolute path to avoid path resolution issues
            const wasmPath = '/sql-wasm.wasm';
            console.log(`Resolving SQL.js WASM file from: ${wasmPath}`);
            return wasmPath;
          }
          return file;
        }
      }).catch((wasmError: any) => {
        console.error('Failed to initialize SQL.js with local WASM, trying CDN:', wasmError);
        // Fallback to CDN with explicit version for WASM file
        return initSqlJs({
          locateFile: (file: string) => {
            const cdnPath = `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`;
            console.log(`Resolving SQL.js file from CDN: ${cdnPath}`);
            return cdnPath;
          }
        });
      });
      
      console.log('SQL.js initialized successfully');
      return SQL;
    } catch (error) {
      console.error('Failed to initialize SQL.js:', error);
      throw new Error(`SQL.js initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Load a script dynamically
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }
  
  // Read file as ArrayBuffer
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
  
  // Get tables from database
  async getTables(): Promise<{ tables: string[] }> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      // Query to get all table names
      const result = this.db.exec(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
      `);
      
      if (!result || result.length === 0) {
        return { tables: [] };
      }
      
      // Extract table names from result
      const tables = result[0].values.map((row: any[]) => row[0] as string);
      return { tables };
    } catch (error) {
      console.error('Error getting tables:', error);
      return { tables: [] };
    }
  }
  
  // Get count of records in a table
  async getTableCount(table: string): Promise<{ count: number }> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      // Query to get count
      const result = this.db.exec(`SELECT COUNT(*) as count FROM ${table}`);
      
      if (!result || result.length === 0) {
        return { count: 0 };
      }
      
      return { count: result[0].values[0][0] as number };
    } catch (error) {
      console.error(`Error getting count for table ${table}:`, error);
      return { count: 0 };
    }
  }

  // Open and initialize the database with improved error handling
  async openDatabase(file: File) {
    console.log('Opening database:', file.name);
    this.file = file;
    
    try {
      // Wait for SQL.js to initialize
      const SQL = await this.initPromise;
      if (!SQL) {
        throw new Error('SQL.js initialization failed');
      }
      
      // Read the file as an ArrayBuffer
      const buffer = await this.readFileAsArrayBuffer(file);
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('Failed to read database file or file is empty');
      }
      
      console.log(`Database file read successfully: ${buffer.byteLength} bytes`);
      
      // Create a database from the file with try/catch for better error reporting
      try {
        this.db = new SQL.Database(new Uint8Array(buffer));
        console.log('Database opened successfully');
      } catch (dbError) {
        console.error('Error creating database from buffer:', dbError);
        throw new Error(`Failed to create database: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }
      
      // Verify database by running a simple query
      try {
        const testResult = this.db.exec("SELECT sqlite_version()");
        console.log('Database verification successful:', testResult);
      } catch (verifyError) {
        console.error('Database verification failed:', verifyError);
        // Continue anyway as this is just a verification step
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error opening database:', error);
      return { success: false, error };
    }
  }

  async getRecords(table: string, offset: number, limit: number) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      // Query to get records with pagination
      const result = this.db.exec(`SELECT * FROM ${table} LIMIT ${limit} OFFSET ${offset}`);
      
      if (!result || result.length === 0) {
        return { records: [] };
      }
      
      // Convert the result to an array of objects
      const columns = result[0].columns;
      const records = result[0].values.map((row: any) => {
        const record: Record<string, any> = {};
        columns.forEach((column: string, index: number) => {
          record[column] = row[index];
        });
        return record;
      });
      
      return { records };
    } catch (error) {
      console.error(`Error getting records from table ${table}:`, error);
      return { records: [] };
    }
  }
  
  // Method used by MigrationService
  async exec(query: string) {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      // Execute the query
      const result = this.db.exec(query);
      
      if (!result || result.length === 0) {
        return { rows: [] };
      }
      
      // Convert the result to an array of objects
      const columns = result[0].columns;
      const rows = result[0].values.map((row: any) => {
        const record: Record<string, any> = {};
        columns.forEach((column: string, index: number) => {
          record[column] = row[index];
        });
        return record;
      });
      
      return { rows };
    } catch (error) {
      console.error('Error executing query:', query, error);
      return { rows: [] };
    }
  }

  // Add a method specifically for checking if fines and borrowings tables exist
  async checkBorrowingAndFinesTables(): Promise<{
    borrowingsTable: string | null,
    finesTable: string | null,
    borrowingsCount: number,
    finesCount: number
  }> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      // Get all tables
      const { tables } = await this.getTables();
      
      // Find borrowings and fines related tables
      const borrowingsTable = tables.find(t => 
        t.toLowerCase().includes('borrow') || 
        t.toLowerCase().includes('issue') ||
        t.toLowerCase().includes('loan')
      ) || null;
      
      const finesTable = tables.find(t => 
        t.toLowerCase().includes('fine') || 
        t.toLowerCase().includes('penalty') ||
        t.toLowerCase().includes('charge')
      ) || null;
      
      // Get counts if tables exist
      let borrowingsCount = 0;
      let finesCount = 0;
      
      if (borrowingsTable) {
        const countResult = await this.getTableCount(borrowingsTable);
        borrowingsCount = countResult.count;
      }
      
      if (finesTable) {
        const countResult = await this.getTableCount(finesTable);
        finesCount = countResult.count;
      }
      
      return {
        borrowingsTable,
        finesTable,
        borrowingsCount,
        finesCount
      };
    } catch (error) {
      console.error('Error checking borrowing and fines tables:', error);
      return {
        borrowingsTable: null,
        finesTable: null,
        borrowingsCount: 0,
        finesCount: 0
      };
    }
  }
}

type MigrationStep = {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message?: string;
  progress: number;
  total: number;
};

const MigrationStatus = ({ file, migrationInProgress, onMigrationComplete }: MigrationStatusProps) => {
  const [steps, setSteps] = useState<MigrationStep[]>([
    { id: 'init', name: 'Initialization', status: 'pending', progress: 0, total: 1 },
    { id: 'categories', name: 'Categories', status: 'pending', progress: 0, total: 0 },
    { id: 'books', name: 'Books', status: 'pending', progress: 0, total: 0 },
    { id: 'students', name: 'Students', status: 'pending', progress: 0, total: 0 },
    { id: 'borrowings', name: 'Borrowings', status: 'pending', progress: 0, total: 0 },
    { id: 'cleanup', name: 'Finalization', status: 'pending', progress: 0, total: 1 }
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [stats, setStats] = useState({
    books: 0,
    students: 0,
    borrowings: 0,
    categories: 0,
    fines: 0,
    errors: 0
  });
  
  const sqliteWorker = useRef<SQLiteWorker | null>(null);
  const { toast } = useToast();
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to the bottom of logs when new logs are added
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };
  
  const updateStep = (stepId: string, updates: Partial<MigrationStep>) => {
    setSteps(prevSteps => 
      prevSteps.map(step => 
        step.id === stepId ? { ...step, ...updates } : step
      )
    );
  };
  
  const updateOverallProgress = () => {
    // Calculate overall progress based on all steps
    const totalItems = steps.reduce((acc, step) => acc + step.total, 0);
    const completedItems = steps.reduce((acc, step) => acc + step.progress, 0);
    
    const progress = totalItems > 0 ? Math.floor((completedItems / totalItems) * 100) : 0;
    setOverallProgress(progress);
  };
  
  // Start the migration process
  useEffect(() => {
    if (migrationInProgress && file && !isComplete && !error) {
      const runMigration = async () => {
        try {
          // Initialize SQLite worker
          sqliteWorker.current = new SQLiteWorker();
          
          // Step 1: Initialize
          updateStep('init', { status: 'in_progress' });
          addLog('Starting migration process...');
          
          // Open the database
          addLog(`Opening database file: ${file.name}`);
          const openResult = await sqliteWorker.current.openDatabase(file);
          
          if (!openResult.success) {
            const errorMessage = openResult.error instanceof Error 
              ? openResult.error.message 
              : String(openResult.error);
            addLog(`ERROR: Failed to open database: ${errorMessage}`);
            throw new Error(`Failed to open database: ${errorMessage}`);
          }
          
          // Get table information
          addLog('Reading database structure...');
          const { tables } = await sqliteWorker.current.getTables();
          
          if (!tables || tables.length === 0) {
            addLog('ERROR: No tables found in the database');
            throw new Error('No tables found in the database');
          }
          
          addLog(`Found ${tables.length} tables: ${tables.join(', ')}`);
          
          // Specifically check for borrowings and fines tables
          const borrowingFinesInfo = await sqliteWorker.current.checkBorrowingAndFinesTables();
          if (borrowingFinesInfo.borrowingsTable) {
            addLog(`Found borrowings table: ${borrowingFinesInfo.borrowingsTable} with ${borrowingFinesInfo.borrowingsCount} records`);
          } else {
            addLog('WARNING: No borrowings table found. Borrowing migration may be skipped.');
          }
          
          if (borrowingFinesInfo.finesTable) {
            addLog(`Found fines table: ${borrowingFinesInfo.finesTable} with ${borrowingFinesInfo.finesCount} records`);
          } else {
            addLog('WARNING: No fines table found. Fines will be generated from borrowing data if possible.');
          }
          
          // Get record counts
          const counts: Record<string, number> = {};
          for (const table of tables) {
            try {
              const { count } = await sqliteWorker.current.getTableCount(table);
              counts[table] = count;
              addLog(`Table ${table}: ${count} records`);
            } catch (countError) {
              addLog(`WARNING: Could not get count for table ${table}: ${countError instanceof Error ? countError.message : String(countError)}`);
              counts[table] = 0;
            }
          }
          
          // Determine which tables to use based on the available tables
          const categoryTable = tables.find(t => t.toLowerCase().includes('categor')) || '';
          const bookTable = tables.find(t => t.toLowerCase().includes('book') && !t.toLowerCase().includes('submit')) || '';
          const studentTable = tables.find(t => 
            t.toLowerCase().includes('member') || 
            t.toLowerCase().includes('student') || 
            t.toLowerCase().includes('user')
          ) || '';
          const activeBorrowingTable = borrowingFinesInfo.borrowingsTable || 
            tables.find(t => 
              t.toLowerCase().includes('issue') || 
              t.toLowerCase().includes('borrow')
            ) || '';
          const historicalBorrowingTable = tables.find(t => 
            t.toLowerCase().includes('submit') || 
            t.toLowerCase().includes('return')
          ) || '';
          
          addLog(`Using tables: 
            - Categories: ${categoryTable || 'None found'}
            - Books: ${bookTable || 'None found'}
            - Students: ${studentTable || 'None found'}
            - Active Borrowings: ${activeBorrowingTable || 'None found'}
            - Historical Borrowings: ${historicalBorrowingTable || 'None found'}`);
          
          // Update step totals based on record counts
          updateStep('categories', { total: counts[categoryTable] || 0 });
          updateStep('books', { total: counts[bookTable] || 0 });
          updateStep('students', { total: counts[studentTable] || 0 });
          updateStep('borrowings', { 
            total: (counts[activeBorrowingTable] || 0) + (counts[historicalBorrowingTable] || 0)
          });
          
          // Complete initialization step
          updateStep('init', { status: 'completed', progress: 1 });
          addLog('Initialization complete. Starting data migration...');
          
          // Get migration settings from localStorage
          const settingsJson = localStorage.getItem('migrationSettings');
          const settings = settingsJson ? JSON.parse(settingsJson) : {};
          const batchSize = settings.batchSize || 100;
          
          // Step 2: Import Categories
          setCurrentStepIndex(1);
          updateStep('categories', { status: 'in_progress' });
          addLog('Importing categories...');
          
          // Import categories using MigrationService
          if (settings.importCategories !== false && categoryTable) {
            try {
              // Use the MigrationService to import categories
              const importedCategories = await MigrationService.importCategories(
                sqliteWorker.current, 
                batchSize,
                (progress, total) => {
                  updateStep('categories', { progress });
                  setStats(prev => ({ ...prev, categories: progress }));
                  updateOverallProgress();
                }
              );
              
              addLog(`Successfully imported ${importedCategories} categories`);
              setStats(prev => ({ ...prev, categories: importedCategories }));
            } catch (categoryError) {
              addLog(`Error importing categories: ${categoryError instanceof Error ? categoryError.message : String(categoryError)}`);
              console.error('Error importing categories:', categoryError);
            }
          } else {
            addLog('Skipping category import - no category table found or import disabled in settings');
          }
          
          // Complete categories step
          updateStep('categories', { status: 'completed' });
          addLog('Category import complete.');
          
          // Step 3: Import Books
          setCurrentStepIndex(2);
          updateStep('books', { status: 'in_progress' });
          addLog('Importing books...');
          
          // Import books using MigrationService
          if (settings.importBooks !== false && bookTable) {
            try {
              // Use the MigrationService to import books
              const importedBooks = await MigrationService.importBooks(
                sqliteWorker.current,
                batchSize,
                settings.generateNewTrackingCodes !== false,
                settings.storeOldBookIdsAsMetadata !== false,
                (progress, total) => {
                  updateStep('books', { progress });
                  setStats(prev => ({ ...prev, books: progress }));
                  updateOverallProgress();
                }
              );
              
              addLog(`Successfully imported ${importedBooks} books`);
              setStats(prev => ({ ...prev, books: importedBooks }));
            } catch (bookError) {
              addLog(`Error importing books: ${bookError instanceof Error ? bookError.message : String(bookError)}`);
              console.error('Error importing books:', bookError);
            }
          } else {
            addLog('Skipping book import - no book table found or import disabled in settings');
          }
          
          // Complete books step
          updateStep('books', { status: 'completed' });
          addLog('Book import complete.');
          
          // Step 4: Import Students
          setCurrentStepIndex(3);
          updateStep('students', { status: 'in_progress' });
          addLog('Importing students...');
          
          // Import students using MigrationService
          if (settings.importStudents !== false && studentTable) {
            try {
              // Use the MigrationService to import students
              const importedStudents = await MigrationService.importStudents(
                sqliteWorker.current,
                batchSize,
                settings.studentClassAssignment || {
                  '2022': 'Form 4, Section A',
                  '2023': 'Form 3, Section A',
                  '2024': 'Form 2, Section A',
                  'other': 'graduated'
                },
                (progress, total) => {
                  updateStep('students', { progress });
                  setStats(prev => ({ ...prev, students: progress }));
                  updateOverallProgress();
                }
              );
              
              addLog(`Successfully imported ${importedStudents} students`);
              setStats(prev => ({ ...prev, students: importedStudents }));
            } catch (studentError) {
              addLog(`Error importing students: ${studentError instanceof Error ? studentError.message : String(studentError)}`);
              console.error('Error importing students:', studentError);
            }
          } else {
            addLog('Skipping student import - no student table found or import disabled in settings');
          }
          
          // Complete students step
          updateStep('students', { status: 'completed' });
          addLog('Student import complete.');
          
          // Step 5: Import Borrowings
          setCurrentStepIndex(4);
          updateStep('borrowings', { status: 'in_progress' });
          addLog('Importing borrowings...');
          
          // Import borrowings using MigrationService
          if (settings.importBorrowings !== false && (activeBorrowingTable || historicalBorrowingTable)) {
            try {
              // Use the MigrationService to import borrowings
              const importedBorrowings = await MigrationService.importBorrowings(
                sqliteWorker.current,
                batchSize,
                settings.importOnlyActiveBorrowings === true,
                (progress, total) => {
                  updateStep('borrowings', { progress });
                  setStats(prev => ({ ...prev, borrowings: progress }));
                  updateOverallProgress();
                }
              );
              
              addLog(`Successfully imported ${importedBorrowings} borrowings`);
              setStats(prev => ({ ...prev, borrowings: importedBorrowings }));
              
              // Check if we need to generate fines from borrowings
              if (importedBorrowings > 0) {
                addLog('Generating fines from borrowing data...');
                try {
                  // Call the actual implementation to generate fines
                  const generatedFines = await MigrationService.generateFinesFromBorrowings(
                    (progress, total) => {
                      // We could update a separate fines step here, but for now just log progress
                      const percentage = Math.floor((progress / total) * 100);
                      addLog(`Generating fines: ${progress}/${total} (${percentage}%)`);
                    }
                  );
                  
                  addLog(`Successfully generated ${generatedFines} fines from borrowing data`);
                  // Update stats to include fines
                  setStats(prev => ({ ...prev, fines: generatedFines }));
                } catch (finesError) {
                  addLog(`WARNING: Error generating fines: ${finesError instanceof Error ? finesError.message : String(finesError)}`);
                  console.error('Error generating fines:', finesError);
                }
              }
            } catch (borrowingError) {
              addLog(`Error importing borrowings: ${borrowingError instanceof Error ? borrowingError.message : String(borrowingError)}`);
              console.error('Error importing borrowings:', borrowingError);
            }
          } else {
            addLog('Skipping borrowing import - no borrowing tables found or import disabled in settings');
          }
          
          // Complete borrowings step
          updateStep('borrowings', { status: 'completed' });
          addLog('Borrowing import complete.');
          
          // Step 6: Cleanup and Finalize
          setCurrentStepIndex(5);
          updateStep('cleanup', { status: 'in_progress' });
          addLog('Finalizing migration...');
          
          // Clean up resources
          if (sqliteWorker.current && sqliteWorker.current.db) {
            try {
              sqliteWorker.current.db.close();
              addLog('Database connection closed');
            } catch (closeError) {
              console.error('Error closing database:', closeError);
            }
          }
          
          // Complete cleanup step
          updateStep('cleanup', { status: 'completed', progress: 1 });
          addLog('Migration complete!');
          
          // Mark migration as complete
          setIsComplete(true);
          setOverallProgress(100);
          
          // Notify parent component
          onMigrationComplete(stats);
          
          // Show success toast
          toast({
            title: 'Migration Complete',
            description: `Successfully imported ${stats.books} books, ${stats.students} students, ${stats.borrowings} borrowings, ${stats.categories} categories, and ${stats.fines} fines.`,
            variant: 'default',
          });
          
        } catch (err) {
          console.error('Migration error:', err);
          setError(err instanceof Error ? err.message : 'Unknown error occurred');
          
          // Update current step status
          const currentStep = steps[currentStepIndex];
          updateStep(currentStep.id, { 
            status: 'error',
            message: err instanceof Error ? err.message : 'Unknown error occurred'
          });
          
          addLog(`ERROR: ${err instanceof Error ? err.message : 'Unknown error occurred'}`);
          
          // Show error toast
          toast({
            title: 'Migration Failed',
            description: err instanceof Error ? err.message : 'Unknown error occurred',
            variant: 'destructive',
          });
          
          // Update error stats
          setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        }
      };
      
      runMigration();
    }
  }, [migrationInProgress, file, isComplete, error, onMigrationComplete, toast]);
  
  // Update overall progress when steps change
  useEffect(() => {
    updateOverallProgress();
  }, [steps]);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-300" />;
    }
  };
  
  const getStepIcon = (stepId: string) => {
    switch (stepId) {
      case 'init':
        return <Database className="h-5 w-5" />;
      case 'categories':
        return <FileText className="h-5 w-5" />;
      case 'books':
        return <BookOpen className="h-5 w-5" />;
      case 'students':
        return <Users className="h-5 w-5" />;
      case 'borrowings':
        return <ArrowRight className="h-5 w-5" />;
      case 'cleanup':
        return <CheckCircle className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium">Migration Progress</h3>
            <Badge variant={isComplete ? "default" : error ? "destructive" : "secondary"}>
              {isComplete ? 'Complete' : error ? 'Failed' : 'In Progress'}
            </Badge>
          </div>
          
          <Progress value={overallProgress} className="h-2 mb-2" />
          
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{overallProgress}% Complete</span>
            <span>
              {stats.books} Books, {stats.students} Students, {stats.categories} Categories, {stats.fines} Fines
            </span>
          </div>
        </CardContent>
      </Card>
      
      {/* Steps Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Migration Steps</h3>
            
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getStatusIcon(step.status)}
                  </div>
                  
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex items-center gap-1.5">
                        {getStepIcon(step.id)}
                        <span className="font-medium">{step.name}</span>
                      </span>
                      
                      {step.status === 'in_progress' && (
                        <Badge variant="outline" className="ml-auto">
                          {Math.round((step.progress / (step.total || 1)) * 100)}%
                        </Badge>
                      )}
                    </div>
                    
                    {step.status === 'in_progress' && step.total > 0 && (
                      <Progress 
                        value={Math.round((step.progress / step.total) * 100)} 
                        className="h-1"
                      />
                    )}
                    
                    {step.status === 'error' && step.message && (
                      <p className="text-sm text-red-500 mt-1">{step.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Migration Logs */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Migration Logs</h3>
            
            <ScrollArea className="h-[300px] border rounded-md p-2 bg-muted/20">
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap break-all">
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Migration Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default MigrationStatus; 