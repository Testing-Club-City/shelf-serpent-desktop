import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, 
  Upload, 
  AlertCircle, 
  Play, 
  FileText, 
  Check, 
  BookCopy, 
  UsersRound, 
  Clock, 
  DollarSign,
  Activity,
  TrendingUp,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Info,
  Target,
  Zap,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import initSqlJs from 'sql.js';
import { MigrationService } from './MigrationService';

// Types for migration process
interface MigrationStats {
  active: number;
  historical: number;
  total: number;
  booksFailed: number;
  studentsFailed: number;
  fines: number;
}

interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
}

interface BorrowingTables {
  activeTable: string;
  historicalTable: string;
}

interface PreviewData {
  activeBorrowings: any[];
  historicalBorrowings: any[];
}

const ProfessionalBorrowingMigrationPanel = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [dbStructure, setDbStructure] = useState<any>(null);
  const [mappedFields, setMappedFields] = useState<any>({});
  const [SQL, setSQL] = useState<any>(null);
  const [db, setDb] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>({});
  const [progress, setProgress] = useState(0);
  const [migrationStats, setMigrationStats] = useState<MigrationStats>({
    active: 0,
    historical: 0,
    total: 0,
    booksFailed: 0,
    studentsFailed: 0,
    fines: 0
  });
  const [borrowingTables, setBorrowingTables] = useState<BorrowingTables>({
    activeTable: '',
    historicalTable: ''
  });
  const [previewData, setPreviewData] = useState<PreviewData>({
    activeBorrowings: [],
    historicalBorrowings: []
  });
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Initialize SQL.js
  useEffect(() => {
    async function initSQL() {
      try {
        const sqljs = await initSqlJs({
          locateFile: file => `https://sql.js.org/dist/${file}`
        });
        setSQL(sqljs);
      } catch (err) {
        console.error('Error initializing SQL.js:', err);
        setError('Failed to initialize SQL engine. Please check your connection and try again.');
      }
    }
    initSQL();
  }, []);

  // Initialize processing steps
  const initializeProcessingSteps = (hasActive: boolean, hasHistorical: boolean) => {
    const steps: ProcessingStep[] = [
      {
        id: 'initialize',
        title: 'Initialize Migration',
        status: 'pending',
        progress: 0,
        message: 'Validating prerequisites and database connections'
      },
      {
        id: 'analyze-structure',
        title: 'Analyze Database Structure',
        status: 'pending',
        progress: 0,
        message: 'Identifying borrowing and historical tables'
      }
    ];

    if (hasActive) {
      steps.push({
        id: 'active-borrowings',
        title: 'Process Active Borrowings',
        status: 'pending',
        progress: 0,
        message: 'Importing current borrowing records'
      });
    }

    if (hasHistorical) {
      steps.push({
        id: 'historical-borrowings',
        title: 'Process Historical Records',
        status: 'pending',
        progress: 0,
        message: 'Importing returned books and generating fines'
      });
    }

    steps.push(
      {
        id: 'book-status',
        title: 'Update Book Status',
        status: 'pending',
        progress: 0,
        message: 'Updating book availability based on borrowings'
      },
      {
        id: 'generate-fines',
        title: 'Generate Fines',
        status: 'pending',
        progress: 0,
        message: 'Creating fine records for overdue books'
      },
      {
        id: 'finalize',
        title: 'Finalize Migration',
        status: 'pending',
        progress: 0,
        message: 'Completing migration and generating reports'
      }
    );

    setProcessingSteps(steps);
  };

  // Update step status
  const updateStepStatus = (stepId: string, status: ProcessingStep['status'], progress: number, message: string) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, progress, message } : step
    ));
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  // Analyze database structure
  const analyzeDatabase = async () => {
    if (!file || !SQL) {
      setError('Please select a valid SQLite database file');
      return;
    }

    setIsAnalyzing(true);
    setProgress(10);
    
    try {
      const fileBuffer = await file.arrayBuffer();
      const uInt8Array = new Uint8Array(fileBuffer);
      
      try {
        // Create a database from the file
        const database = new SQL.Database(uInt8Array);
        setDb(database);
        setProgress(30);
        
        // Analyze table structure
        const structure = analyzeTableStructure(database);
        setDbStructure(structure);
        
        setProgress(50);
        
        // Detect borrowing tables
        const tables = detectBorrowingTables(database);
        setBorrowingTables(tables);
        
        setProgress(70);
        
        // Get preview data
        const preview = getPreviewData(database, tables);
        setPreviewData(preview);
        
        // Auto-map fields based on structure analysis
        const mappings = autoMapFields(structure);
        setMappedFields(mappings);
        
        setProgress(100);
        setActiveTab('preview');
        
        toast({
          title: 'Database Analysis Complete',
          description: `Found ${Object.keys(structure).length} tables with borrowing-related data`,
          variant: 'default',
        });
      } catch (dbError: any) {
        console.error('Database creation error:', dbError);
        setError(`Error analyzing database: ${dbError.message || 'Invalid SQLite file'}`);
      }
    } catch (fileError: any) {
      console.error('File reading error:', fileError);
      setError(`Error reading file: ${fileError.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Detect borrowing tables
  const detectBorrowingTables = (database: any): BorrowingTables => {
    try {
      const tablesResult = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tables = tablesResult[0]?.values.map(row => ({ name: String(row[0]) })) || [];
      
      console.log('🔍 DEBUG: All tables found in database:', tables.map(t => t.name));
      
      // Find active borrowing table - be more flexible with detection
      const activeTable = tables.find((t: any) => {
        const tableName = t.name.toLowerCase();
        return tableName.includes('issue') || 
               tableName.includes('borrow') ||
               tableName.includes('checkout') ||
               tableName === 'borrowing' ||
               tableName.includes('lending') ||
               tableName.includes('loan');
      })?.name || '';
      
      // Find historical borrowing table - be more flexible
      const historicalTable = tables.find((t: any) => {
        const tableName = t.name.toLowerCase();
        return tableName.includes('submit') || 
               tableName.includes('return') ||
               tableName.includes('history') ||
               tableName.includes('past') ||
               tableName.includes('completed') ||
               tableName.includes('finished');
      })?.name || '';
      
      console.log('🔍 DEBUG: Active table detected:', activeTable);
      console.log('🔍 DEBUG: Historical table detected:', historicalTable);
      
      // If no specific tables found, let's check for any table that might contain borrowing data
      if (!activeTable && !historicalTable) {
        console.log('🔍 DEBUG: No obvious borrowing tables found, checking all tables for borrowing-like data...');
        
        for (const table of tables) {
          try {
            const columnsResult = database.exec(`PRAGMA table_info(${table.name})`);
            const columns = columnsResult[0]?.values.map(col => col[1].toLowerCase()) || [];
            console.log(`🔍 DEBUG: Table ${table.name} columns:`, columns);
            
            // Check if table has borrowing-related columns
            const hasBorrowingColumns = columns.some(col => 
              col.includes('issue') || col.includes('borrow') || 
              col.includes('member') || col.includes('student') ||
              col.includes('book') || col.includes('due') ||
              col.includes('return') || col.includes('submit')
            );
            
            if (hasBorrowingColumns) {
              console.log(`🔍 DEBUG: Table ${table.name} seems to contain borrowing data`);
              
              // Check if it has data
              const dataResult = database.exec(`SELECT COUNT(*) FROM ${table.name}`);
              const count = dataResult[0]?.values[0][0] || 0;
              console.log(`🔍 DEBUG: Table ${table.name} has ${count} records`);
            }
          } catch (error) {
            console.log(`🔍 DEBUG: Error checking table ${table.name}:`, error);
          }
        }
      }
      
      return {
        activeTable: String(activeTable),
        historicalTable: String(historicalTable)
      };
    } catch (error) {
      console.error('Error detecting borrowing tables:', error);
      return { activeTable: '', historicalTable: '' };
    }
  };

  // Get preview data
  const getPreviewData = (database: any, tables: BorrowingTables): PreviewData => {
    const preview: PreviewData = {
      activeBorrowings: [],
      historicalBorrowings: []
    };
    
    console.log('🔍 DEBUG: Getting preview data for tables:', tables);
    
    try {
      // Get active borrowings preview
      if (tables.activeTable) {
        console.log(`🔍 DEBUG: Querying active table: ${tables.activeTable}`);
        const activeResult = database.exec(`SELECT * FROM ${tables.activeTable} LIMIT 5`);
        console.log(`🔍 DEBUG: Active table query result:`, activeResult);
        
        if (activeResult[0]) {
          const columns = activeResult[0].columns;
          const values = activeResult[0].values;
          console.log(`🔍 DEBUG: Active table columns:`, columns);
          console.log(`🔍 DEBUG: Active table sample data:`, values);
          
          preview.activeBorrowings = values.map(row => 
            Object.fromEntries(columns.map((col, i) => [col, row[i]]))
          );
        }
      }
      
      // Get historical borrowings preview
      if (tables.historicalTable) {
        console.log(`🔍 DEBUG: Querying historical table: ${tables.historicalTable}`);
        const historicalResult = database.exec(`SELECT * FROM ${tables.historicalTable} LIMIT 5`);
        console.log(`🔍 DEBUG: Historical table query result:`, historicalResult);
        
        if (historicalResult[0]) {
          const columns = historicalResult[0].columns;
          const values = historicalResult[0].values;
          console.log(`🔍 DEBUG: Historical table columns:`, columns);
          console.log(`🔍 DEBUG: Historical table sample data:`, values);
          
          preview.historicalBorrowings = values.map(row => 
            Object.fromEntries(columns.map((col, i) => [col, row[i]]))
          );
        }
      }
    } catch (error) {
      console.error('🔍 DEBUG: Error getting preview data:', error);
    }
    
    console.log('🔍 DEBUG: Final preview data:', preview);
    return preview;
  };

  // Analyze table structure
  const analyzeTableStructure = (database: any) => {
    try {
      // Get all table names
      const tableQuery = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
      
      if (!tableQuery || !tableQuery[0] || !tableQuery[0].values) {
        throw new Error('Could not retrieve tables from database');
      }
      
      const tables = tableQuery[0].values.map(table => table[0]);
      const structure: any = {};
      
      // Analyze each table
      for (const tableName of tables) {
        try {
          // Get columns for this table
          const columnsQuery = database.exec(`PRAGMA table_info(${tableName})`);
          
          if (columnsQuery && columnsQuery[0] && columnsQuery[0].values) {
            const columns = columnsQuery[0].values.map(col => ({
              name: col[1],
              type: col[2],
              notNull: col[3] === 1,
              defaultValue: col[4],
              primaryKey: col[5] === 1,
            }));
            
            // Add table info to structure
            structure[tableName] = {
              columns,
              rowCount: getRowCount(database, tableName),
              hasBorrowingData: detectBorrowingData(columns),
            };
          }
        } catch (tableError) {
          console.error(`Error analyzing table ${tableName}:`, tableError);
        }
      }
      
      return structure;
    } catch (error) {
      console.error('Error in analyzeTableStructure:', error);
      return {};
    }
  };

  // Get row count for a table
  const getRowCount = (database: any, tableName: string) => {
    try {
      const result = database.exec(`SELECT COUNT(*) FROM ${tableName}`);
      return result[0].values[0][0];
    } catch {
      return 0;
    }
  };

  // Detect if a table has borrowing-related data
  const detectBorrowingData = (columns: any[]) => {
    const relevantColumns = [
      'borrow', 'loan', 'issue', 'book', 'member', 'student', 
      'date', 'due', 'return', 'fine', 'status'
    ];
    
    const columnNames = columns.map(col => col.name.toLowerCase());
    
    return relevantColumns.some(term => 
      columnNames.some(colName => colName.includes(term))
    );
  };

  // Get sample data for tables
  const getSampleData = (database: any) => {
    const data: any = {};
    
    if (!database || !dbStructure) return data;
    
    Object.keys(dbStructure).forEach(tableName => {
      try {
        if (dbStructure[tableName].hasBorrowingData) {
          const result = database.exec(`SELECT * FROM ${tableName} LIMIT 5`);
          if (result && result[0]) {
            data[tableName] = {
              columns: result[0].columns,
              values: result[0].values,
            };
          }
        }
      } catch (error) {
        console.error(`Error getting sample data for ${tableName}:`, error);
      }
    });
    
    return data;
  };

  // Auto-map fields based on structure
  const autoMapFields = (structure: any) => {
    const mappings: any = {};
    const borrowingTables = Object.keys(structure).filter(
      table => structure[table].hasBorrowingData
    );
    
    for (const table of borrowingTables) {
      const columns = structure[table].columns;
      const columnNames = columns.map((col: any) => col.name.toLowerCase());
      
      // Map book-related fields
      if (columnNames.includes('bookid') || columnNames.includes('book_id')) {
        mappings.bookId = {
          table,
          column: columns.find((col: any) => 
            ['bookid', 'book_id'].includes(col.name.toLowerCase())
          ).name,
          confidence: 'high'
        };
      }
      
      // Map member/student fields
      if (columnNames.includes('memberid') || columnNames.includes('member_id') ||
          columnNames.includes('studentid') || columnNames.includes('student_id')) {
        mappings.memberId = {
          table,
          column: columns.find((col: any) => 
            ['memberid', 'member_id', 'studentid', 'student_id'].includes(col.name.toLowerCase())
          ).name,
          confidence: 'high'
        };
      }
      
      // Map dates
      for (const dateType of ['issue', 'borrow', 'return', 'due']) {
        const dateColumn = columns.find((col: any) => 
          col.name.toLowerCase().includes(dateType) && 
          (col.name.toLowerCase().includes('date') || col.type.toLowerCase().includes('date'))
        );
        
        if (dateColumn) {
          mappings[`${dateType}Date`] = {
            table,
            column: dateColumn.name,
            confidence: 'medium'
          };
        }
      }
      
      // Map fines
      const fineColumn = columns.find((col: any) => 
        col.name.toLowerCase().includes('fine') ||
        col.name.toLowerCase().includes('fee') ||
        col.name.toLowerCase().includes('charge')
      );
      
      if (fineColumn) {
        mappings.fine = {
          table,
          column: fineColumn.name,
          confidence: 'medium'
        };
      }
      
      // Map status
      const statusColumn = columns.find((col: any) => 
        col.name.toLowerCase().includes('status') ||
        col.name.toLowerCase().includes('state')
      );
      
      if (statusColumn) {
        mappings.status = {
          table,
          column: statusColumn.name,
          confidence: 'medium'
        };
      }
    }
    
    return mappings;
  };

  // Run migration process
  const runMigration = async () => {
    if (!db || (!borrowingTables.activeTable && !borrowingTables.historicalTable)) {
      toast({
        title: 'Error',
        description: 'No borrowing tables found in the database.',
        variant: 'destructive'
      });
      return;
    }

    setIsMigrating(true);
    setProgress(0);
    setStartDate(new Date());
    setActiveTab('migration');
    
    // Initialize processing steps
    initializeProcessingSteps(!!borrowingTables.activeTable, !!borrowingTables.historicalTable);
    
    try {
      let activeCount = 0;
      let historicalCount = 0;
      let failedBooks = 0;
      let failedStudents = 0;
      let finesCount = 0;
      
      // Step 1: Initialize
      updateStepStatus('initialize', 'processing', 10, 'Validating database connections...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStepStatus('initialize', 'completed', 100, 'Database validation complete');
      
      // Step 2: Analyze structure
      updateStepStatus('analyze-structure', 'processing', 50, 'Analyzing database structure...');
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStepStatus('analyze-structure', 'completed', 100, 'Database structure analyzed');
      
      // Step 3: Import active borrowings
      if (borrowingTables.activeTable) {
        updateStepStatus('active-borrowings', 'processing', 0, 'Starting active borrowings import...');
        
        activeCount = await MigrationService.importBorrowings(
          db,
          100, // batch size
          true, // only active borrowings
          (progress, total) => {
            const percentage = Math.floor((progress / total) * 100);
            updateStepStatus('active-borrowings', 'processing', percentage, 
              `Imported ${progress} of ${total} active borrowings`);
          }
        );
        
        updateStepStatus('active-borrowings', 'completed', 100, 
          `Successfully imported ${activeCount} active borrowings`);
        
        failedBooks = MigrationService.failedMappings.books.length;
        failedStudents = MigrationService.failedMappings.students.length;
      }
      
      // Step 4: Import historical borrowings
      if (borrowingTables.historicalTable) {
        updateStepStatus('historical-borrowings', 'processing', 0, 'Starting historical records import...');
        
        const result = await MigrationService.importHistoricalBorrowingsAndFines(
          db,
          "100", // batch size
          (progress, total) => {
            const percentage = Math.floor((progress / total) * 100);
            updateStepStatus('historical-borrowings', 'processing', percentage,
              `Processed ${progress} of ${total} historical records`);
          }
        );
        
        historicalCount = result.borrowings;
        finesCount = result.fines;
        
        updateStepStatus('historical-borrowings', 'completed', 100,
          `Imported ${historicalCount} records and ${finesCount} fines`);
      }
      
      // Step 5: Update book status
      updateStepStatus('book-status', 'processing', 50, 'Updating book availability...');
      await MigrationService.updateBookStatusFromBorrowings();
      updateStepStatus('book-status', 'completed', 100, 'Book status updated successfully');
      
      // Step 6: Generate additional fines
      updateStepStatus('generate-fines', 'processing', 0, 'Generating fines for overdue books...');
      const additionalFines = await MigrationService.generateFinesFromBorrowings(
        (progress, total) => {
          const percentage = Math.floor((progress / total) * 100);
          updateStepStatus('generate-fines', 'processing', percentage,
            `Generated ${progress} of ${total} fines`);
        }
      );
      finesCount += additionalFines;
      updateStepStatus('generate-fines', 'completed', 100, 
        `Generated ${additionalFines} additional fines`);
      
      // Step 7: Finalize
      updateStepStatus('finalize', 'processing', 50, 'Finalizing migration...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStepStatus('finalize', 'completed', 100, 'Migration completed successfully');
      
      // Set final stats
      setMigrationStats({
        active: activeCount,
        historical: historicalCount,
        total: activeCount + historicalCount,
        booksFailed: failedBooks,
        studentsFailed: failedStudents,
        fines: finesCount
      });
      
      setProgress(100);
      setEndDate(new Date());
      
      toast({
        title: 'Migration Complete',
        description: `Successfully migrated ${activeCount + historicalCount} borrowings and ${finesCount} fines.`,
        variant: 'default'
      });
    } catch (error: any) {
      console.error('Error during migration:', error);
      toast({
        title: 'Migration Error',
        description: error.message || 'An unknown error occurred during migration.',
        variant: 'destructive'
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" disabled={isMigrating}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Database
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!db}>
            <FileText className="mr-2 h-4 w-4" />
            Preview Data
          </TabsTrigger>
          <TabsTrigger value="migration" disabled={!borrowingTables.activeTable && !borrowingTables.historicalTable}>
            <Play className="mr-2 h-4 w-4" />
            Run Migration
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!endDate}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Results
          </TabsTrigger>
        </TabsList>
        
        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Upload Legacy Database</CardTitle>
              <CardDescription>
                Upload your SQLite database file to begin the borrowing records migration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Input 
                  type="file" 
                  accept=".db,.sqlite,.sqlite3,.db3"
                  onChange={handleFileChange}
                />
                <p className="text-sm text-gray-500">
                  Supported formats: .db, .sqlite, .sqlite3
                </p>
              </div>
              
              <Button 
                onClick={analyzeDatabase} 
                disabled={!file || isAnalyzing}
                className="mt-4"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Analyze Database
                  </>
                )}
              </Button>
              
              {isAnalyzing && (
                <Progress value={progress} className="mt-2" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Database Preview & Analysis
              </CardTitle>
              <CardDescription>
                Review the detected borrowing tables and sample data before migration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Migration Overview</AlertTitle>
                <AlertDescription className="text-blue-700">
                  <div className="mt-2 space-y-1">
                    <p>• Match books and students using existing ID mappings</p>
                    <p>• Import active borrowings and update book copy status</p>
                    <p>• Import historical borrowings as returned records</p>
                    <p>• Generate fine records for overdue returns</p>
                    <p>• Update book availability based on borrowing status</p>
                  </div>
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Active Borrowings */}
                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center text-green-800">
                      <Activity className="h-5 w-5 mr-2" />
                      Active Borrowings
                    </CardTitle>
                    {borrowingTables.activeTable && (
                      <Badge variant="outline" className="self-start">
                        {borrowingTables.activeTable}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    {borrowingTables.activeTable ? (
                      <div className="space-y-3">
                        <div className="text-sm text-green-700">
                          Found {previewData.activeBorrowings.length} sample records
                        </div>
                        <div className="max-h-32 overflow-auto bg-white rounded p-2 border">
                          <pre className="text-xs">
                            {JSON.stringify(previewData.activeBorrowings.slice(0, 2), null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Active Borrowings Table</AlertTitle>
                        <AlertDescription>
                          Could not detect an active borrowings table in your database.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
                
                {/* Historical Borrowings */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center text-blue-800">
                      <Clock className="h-5 w-5 mr-2" />
                      Historical Records
                    </CardTitle>
                    {borrowingTables.historicalTable && (
                      <Badge variant="outline" className="self-start">
                        {borrowingTables.historicalTable}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    {borrowingTables.historicalTable ? (
                      <div className="space-y-3">
                        <div className="text-sm text-blue-700">
                          Found {previewData.historicalBorrowings.length} sample records
                        </div>
                        <div className="max-h-32 overflow-auto bg-white rounded p-2 border">
                          <pre className="text-xs">
                            {JSON.stringify(previewData.historicalBorrowings.slice(0, 2), null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Historical Table</AlertTitle>
                        <AlertDescription>
                          Could not detect a historical borrowings table. This is optional.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (db) {
                      console.log('🔍 MANUAL DEBUG: Checking database structure...');
                      const tables = detectBorrowingTables(db);
                      console.log('🔍 MANUAL DEBUG: Detected tables:', tables);
                      const preview = getPreviewData(db, tables);
                      console.log('🔍 MANUAL DEBUG: Preview data:', preview);
                    }
                  }}
                >
                  Debug Database
                </Button>
                <Button onClick={runMigration} disabled={isMigrating || (!borrowingTables.activeTable && !borrowingTables.historicalTable)}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Migration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Migration Tab */}
        <TabsContent value="migration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Migration Progress
              </CardTitle>
              <CardDescription>
                Real-time migration progress and detailed step tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isMigrating && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="font-medium">Migration in Progress</span>
                    </div>
                    <Badge variant="outline">{progress}%</Badge>
                  </div>
                  
                  <Progress value={progress} className="h-2" />
                  
                  <div className="space-y-3">
                    {processingSteps.map((step) => (
                      <div key={step.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {step.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                            {step.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                            {step.status === 'pending' && <Clock className="h-4 w-4 text-gray-400" />}
                            <span className="font-medium">{step.title}</span>
                          </div>
                          <Badge variant={
                            step.status === 'completed' ? 'default' : 
                            step.status === 'processing' ? 'secondary' : 
                            step.status === 'error' ? 'destructive' : 'outline'
                          }>
                            {step.status === 'processing' ? `${step.progress}%` : step.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">{step.message}</div>
                        {step.status === 'processing' && (
                          <Progress value={step.progress} className="mt-2 h-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {!isMigrating && !endDate && (
                <div className="text-center py-8">
                  <Target className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Ready to Start Migration</h3>
                  <p className="text-gray-600 mb-4">
                    Click "Start Migration" in the Preview tab to begin the process
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <h3 className="text-xl font-semibold">Migration Completed Successfully</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Borrowing Records Stats */}
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center text-green-800">
                  <BookCopy className="h-5 w-5 mr-2" />
                  Borrowing Records
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Active Borrowings:</span>
                  <Badge variant="outline" className="font-mono">{migrationStats.active}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Historical Records:</span>
                  <Badge variant="outline" className="font-mono">{migrationStats.historical}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Imported:</span>
                  <Badge className="font-mono text-base px-3 py-1">{migrationStats.total}</Badge>
                </div>
              </CardContent>
            </Card>
            
            {/* Fines & Issues */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center text-blue-800">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Fines & Issues
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Fines Generated:</span>
                  <Badge variant="outline" className="font-mono">{migrationStats.fines}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Books Not Found:</span>
                  <Badge variant={migrationStats.booksFailed > 0 ? "destructive" : "outline"}>
                    {migrationStats.booksFailed}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Students Not Found:</span>
                  <Badge variant={migrationStats.studentsFailed > 0 ? "destructive" : "outline"}>
                    {migrationStats.studentsFailed}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Timing Info */}
          {startDate && endDate && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Migration Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Duration:</span>
                    <span className="text-gray-600">
                      {Math.round((endDate.getTime() - startDate.getTime()) / 1000)} seconds
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Started:</span>
                    <span className="text-gray-600">{startDate.toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Completed:</span>
                    <span className="text-gray-600">{endDate.toLocaleTimeString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Next Steps</AlertTitle>
            <AlertDescription className="text-green-700">
              <div className="mt-2 space-y-1">
                <p>✓ Verify borrowing records in the Borrowings management section</p>
                <p>✓ Review generated fines in the Fines section</p>
                <p>✓ Check that book availability has been updated correctly</p>
                <p>✓ Test the borrowing system with the imported data</p>
              </div>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfessionalBorrowingMigrationPanel;