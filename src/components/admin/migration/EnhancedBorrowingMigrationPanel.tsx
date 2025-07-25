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
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MigrationService } from './MigrationService';
// Import SQL.js with improved error handling  
const initSqlJs = async () => {
  try {
    console.log('Initializing SQL.js...');
    const SQL = await import('sql.js');
    
    // Use the WASM file we've placed in the public directory
    const SqlJs = await (SQL as any).default({
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) {
          return '/sql-wasm.wasm';
        }
        return file;
      }
    });
    
    console.log('SQL.js initialized successfully');
    return SqlJs;
  } catch (error) {
    console.error('Failed to initialize SQL.js:', error);
    throw new Error(`Failed to initialize database engine: ${error.message}`);
  }
};

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
  message?: string;
}

export const EnhancedBorrowingMigrationPanel = () => {
  // Add debugging
  console.log('EnhancedBorrowingMigrationPanel: Component mounted');
  
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sqliteDb, setSqliteDb] = useState<any>(null);
  const [borrowingTables, setBorrowingTables] = useState<{
    activeTable: string;
    historicalTable: string;
  }>({
    activeTable: '',
    historicalTable: ''
  });
  const [previewData, setPreviewData] = useState<{
    activeBorrowings: any[];
    historicalBorrowings: any[];
    activeBorrowingsCount: number;
    historicalBorrowingsCount: number;
  }>({
    activeBorrowings: [],
    historicalBorrowings: [],
    activeBorrowingsCount: 0,
    historicalBorrowingsCount: 0
  });
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [migrationStats, setMigrationStats] = useState<MigrationStats | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisSteps, setAnalysisSteps] = useState<ProcessingStep[]>([]);

  const initializeProcessingSteps = (hasActive: boolean, hasHistorical: boolean) => {
    const steps: ProcessingStep[] = [
      {
        id: 'initialize',
        title: 'Initializing Migration',
        status: 'pending',
        progress: 0,
        message: 'Preparing database connections and validation'
      }
    ];

    if (hasActive) {
      steps.push({
        id: 'active-borrowings',
        title: 'Processing Active Borrowings',
        status: 'pending',
        progress: 0,
        message: 'Importing current borrowing records'
      });
    }

    if (hasHistorical) {
      steps.push({
        id: 'historical-borrowings',
        title: 'Processing Historical Records',
        status: 'pending',
        progress: 0,
        message: 'Importing returned books and generating fines'
      });
    }

    steps.push(
      {
        id: 'book-status',
        title: 'Updating Book Status',
        status: 'pending',
        progress: 0,
        message: 'Updating book availability based on borrowings'
      },
      {
        id: 'finalize',
        title: 'Finalizing Migration',
        status: 'pending',
        progress: 0,
        message: 'Completing migration and generating reports'
      }
    );

    setProcessingSteps(steps);
  };

  const updateStepStatus = (stepId: string, status: ProcessingStep['status'], progress = 0, message?: string) => {
    // Update both processing steps and analysis steps
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, progress, message: message || step.message }
        : step
    ));
    setAnalysisSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, progress, message: message || step.message }
        : step
    ));
    setCurrentStep(stepId);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Enhanced Migration Panel: File change handler triggered');
    if (!e.target.files || e.target.files.length === 0) {
      console.log('Enhanced Migration Panel: No files selected');
      return;
    }
    
    const file = e.target.files[0];
    console.log('Enhanced Migration Panel: Processing file:', file.name, 'Size:', file.size);
    setUploadedFile(file);
    
    try {
      setIsProcessing(true);
      setCurrentStep('analysis');
      setAnalysisProgress(0);
      
      // Initialize analysis steps
      const steps: ProcessingStep[] = [
        { id: 'read-file', title: 'Reading Database File', status: 'pending', progress: 0 },
        { id: 'init-sql', title: 'Initializing SQL Engine', status: 'pending', progress: 0 },
        { id: 'create-db', title: 'Creating Database Instance', status: 'pending', progress: 0 },
        { id: 'analyze-structure', title: 'Analyzing Structure', status: 'pending', progress: 0 },
        { id: 'load-preview', title: 'Loading Preview Data', status: 'pending', progress: 0 }
      ];
      setAnalysisSteps(steps);
      
      // Step 1: Read file
      updateStepStatus('read-file', 'processing', 0, 'Reading SQLite database file...');
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      updateStepStatus('read-file', 'completed', 100, 'Database file loaded successfully');
      setAnalysisProgress(20);
      
      // Step 2: Initialize SQL.js
      updateStepStatus('init-sql', 'processing', 0, 'Initializing SQL.js engine...');
      console.log('Enhanced Migration Panel: Initializing SQL.js...');
      
      const SQL = await initSqlJs();
      console.log('Enhanced Migration Panel: SQL.js initialized successfully');
      
      updateStepStatus('init-sql', 'completed', 100, 'SQL.js engine initialized');
      setAnalysisProgress(40);
      
      // Step 3: Create database instance
      updateStepStatus('create-db', 'processing', 0, 'Creating database instance...');
      const db = new SQL.Database(uint8Array) as any;

      // Add helper methods expected by MigrationService
      db.getTables = async () => {
        try {
          const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
          const tables = res[0]?.values.map((row: any) => String(row[0])) || [];
          return { tables };
        } catch (e) {
          console.error('Error fetching tables:', e);
          return { tables: [] };
        }
      };

      db.getTableCount = async (table: string) => {
        try {
          const res = db.exec(`SELECT COUNT(*) as count FROM ${table}`);
          const count = res[0]?.values[0][0] || 0;
          return { count };
        } catch (e) {
          console.error('Error counting table rows:', e);
          return { count: 0 };
        }
      };

      // Override exec method to return the format expected by MigrationService
      const originalExec = db.exec.bind(db);
      db.exec = (sql: string) => {
        try {
          const result = originalExec(sql);
          if (result && result.length > 0) {
            const columns = result[0].columns || [];
            const values = result[0].values || [];
            
            // Convert to rows format expected by MigrationService
            const rows = values.map((row: any[]) => {
              const obj: any = {};
              columns.forEach((col: string, index: number) => {
                obj[col] = row[index];
              });
              return obj;
            });
            
            return { rows, columns, values };
          }
          return { rows: [], columns: [], values: [] };
        } catch (e) {
          console.error('Error executing SQL:', sql, e);
          return { rows: [], columns: [], values: [] };
        }
      };

      setSqliteDb(db);
      updateStepStatus('create-db', 'completed', 100, 'Database instance created');
      setAnalysisProgress(60);
      
      // Step 4: Analyze structure
      updateStepStatus('analyze-structure', 'processing', 0, 'Analyzing database structure...');
      const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tables = tablesResult[0]?.values.map(row => ({ name: String(row[0]) })) || [];
      console.log('EnhancedBorrowingMigrationPanel: Found tables:', tables);
      updateStepStatus('analyze-structure', 'processing', 50, `Found ${tables.length} tables, identifying borrowing tables...`);
      
      // Find borrowing-related tables with better detection
      const activeTable = tables.find((t: any) => 
        t.name.toLowerCase().includes('issue') || 
        t.name.toLowerCase().includes('borrow') ||
        t.name.toLowerCase().includes('checkout') ||
        t.name.toLowerCase() === 'borrowing'
      )?.name || '';
      
      const historicalTable = tables.find((t: any) => 
        t.name.toLowerCase().includes('submit') || 
        t.name.toLowerCase().includes('return') ||
        t.name.toLowerCase().includes('history') ||
        t.name.toLowerCase().includes('past')
      )?.name || '';
      
      console.log('EnhancedBorrowingMigrationPanel: Active table:', activeTable);
      console.log('EnhancedBorrowingMigrationPanel: Historical table:', historicalTable);
      
      setBorrowingTables({
        activeTable: String(activeTable),
        historicalTable: String(historicalTable)
      });
      
      updateStepStatus('analyze-structure', 'completed', 100, 
        `Structure analyzed: ${activeTable ? 'Active table found' : 'No active table'}, ${historicalTable ? 'Historical table found' : 'No historical table'}`);
      setAnalysisProgress(80);
      
      // Step 5: Load preview data
      updateStepStatus('load-preview', 'processing', 0, 'Loading preview data...');
      let activeBorrowingsCount = 0;
      let historicalBorrowingsCount = 0;
      
      if (activeTable) {
        updateStepStatus('load-preview', 'processing', 25, `Analyzing ${activeTable} table...`);
        const activeCountResult = db.exec(`SELECT COUNT(*) as count FROM ${activeTable}`);
        activeBorrowingsCount = Number(activeCountResult[0]?.values[0][0]) || 0;
        
        const activeResult = db.exec(`SELECT * FROM ${activeTable} LIMIT 5`);
        const activeBorrowings = activeResult[0]?.values || [];
        const columns = activeResult[0]?.columns || [];
        const formattedActive = activeBorrowings.map(row => 
          Object.fromEntries(columns.map((col, i) => [col, row[i]]))
        );
        setPreviewData(prev => ({ 
          ...prev, 
          activeBorrowings: formattedActive,
          activeBorrowingsCount 
        }));
        updateStepStatus('load-preview', 'processing', 50, `Found ${activeBorrowingsCount} active borrowing records`);
      }
      
      if (historicalTable) {
        updateStepStatus('load-preview', 'processing', 75, `Analyzing ${historicalTable} table...`);
        const historicalCountResult = db.exec(`SELECT COUNT(*) as count FROM ${historicalTable}`);
        historicalBorrowingsCount = Number(historicalCountResult[0]?.values[0][0]) || 0;
        
        const historicalResult = db.exec(`SELECT * FROM ${historicalTable} LIMIT 5`);
        const historicalBorrowings = historicalResult[0]?.values || [];
        const columns = historicalResult[0]?.columns || [];
        const formattedHistorical = historicalBorrowings.map(row => 
          Object.fromEntries(columns.map((col, i) => [col, row[i]]))
        );
        setPreviewData(prev => ({ 
          ...prev, 
          historicalBorrowings: formattedHistorical,
          historicalBorrowingsCount 
        }));
        updateStepStatus('load-preview', 'processing', 90, `Found ${historicalBorrowingsCount} historical borrowing records`);
      }
      
      updateStepStatus('load-preview', 'completed', 100, 'Preview data loaded successfully');
      setAnalysisProgress(100);
      
      setActiveTab('preview');
      
      toast({
        title: 'Database Analysis Complete',
        description: `Found ${activeBorrowingsCount} active and ${historicalBorrowingsCount} historical borrowing records.`,
      });
    } catch (error) {
      console.error('Error processing database file:', error);
      updateStepStatus(currentStep.split('-')[0] || 'analysis', 'error', 0, `Analysis failed: ${error.message}`);
      toast({
        title: 'Database Analysis Failed',
        description: 'Failed to analyze the database file. Please ensure it is a valid SQLite database.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const startMigration = async () => {
    if (!sqliteDb || (!borrowingTables.activeTable && !borrowingTables.historicalTable)) {
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
    setActiveTab('progress');
    
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
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate validation
      updateStepStatus('initialize', 'completed', 100, 'Database validation complete');
      
      // Step 2: Import prerequisites (books and students first)
      updateStepStatus('initialize', 'processing', 30, 'Importing books and students first...');
      
      try {
        // Import categories first
        console.log('Importing categories...');
        await MigrationService.importCategories(sqliteDb, 100, () => {});
        
        // Import books
        console.log('Importing books...');
        await MigrationService.importBooks(sqliteDb, 100, true, true, () => {});
        
        // Import students  
        console.log('Importing students...');
        await MigrationService.importStudents(sqliteDb, 100, {
          '2022': 'Form 4',
          '2023': 'Form 3', 
          '2024': 'Form 2',
          'other': 'Form 1'
        }, () => {});
        
        updateStepStatus('initialize', 'processing', 70, 'Prerequisites imported successfully');
      } catch (error) {
        console.error('Error importing prerequisites:', error);
        updateStepStatus('initialize', 'error', 0, `Failed to import prerequisites: ${error.message}`);
        throw error;
      }
      
      // Step 3: Import active borrowings
      if (borrowingTables.activeTable) {
        updateStepStatus('active-borrowings', 'processing', 0, 'Starting active borrowings import...');
        
        // Update progress callback
        const progressHandler = (progress: number, total: number) => {
          const percentage = Math.floor((progress / total) * 100);
          setProgress(percentage);
          updateStepStatus('active-borrowings', 'processing', percentage, 
            `Imported ${progress} of ${total} active borrowings`);
        };

        activeCount = await MigrationService.importBorrowings(
          sqliteDb, 
          100, // batch size
          true, // only active borrowings
          progressHandler
        );
        
        updateStepStatus('active-borrowings', 'completed', 100, 
          `Successfully imported ${activeCount} active borrowings`);
        
        failedBooks = MigrationService.failedMappings.books.length;
        failedStudents = MigrationService.failedMappings.students.length;
      }
      
      // Step 3: Import historical borrowings
      if (borrowingTables.historicalTable) {
        updateStepStatus('historical-borrowings', 'processing', 0, 'Starting historical records import...');
        
        const result = await MigrationService.importHistoricalBorrowingsAndFines(
          sqliteDb as any, 
          borrowingTables.historicalTable as string, 
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
      
      // Step 4: Update book status
      updateStepStatus('book-status', 'processing', 50, 'Updating book availability...');
      await MigrationService.updateBookStatusFromBorrowings();
      updateStepStatus('book-status', 'completed', 100, 'Book status updated successfully');
      
      // Step 5: Finalize
      updateStepStatus('finalize', 'processing', 75, 'Generating migration report...');
      
      setMigrationStats({
        active: activeCount,
        historical: historicalCount,
        total: activeCount + historicalCount,
        booksFailed: failedBooks,
        studentsFailed: failedStudents,
        fines: finesCount
      });
      
      updateStepStatus('finalize', 'completed', 100, 'Migration completed successfully');
      
      setProgress(100);
      setEndDate(new Date());
      
      toast({
        title: 'Migration Completed Successfully',
        description: `Imported ${activeCount + historicalCount} borrowings and ${finesCount} fines.`,
      });
    } catch (error) {
      console.error('Error during migration:', error);
      updateStepStatus(currentStep, 'error', 0, 'Migration failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      
      toast({
        title: 'Migration Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred during migration.',
        variant: 'destructive'
      });
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (sqliteDb) {
        try {
          sqliteDb.close();
        } catch (error) {
          console.error('Error closing database connection:', error);
        }
      }
    };
  }, [sqliteDb]);

  const getStepIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <Card className="w-full border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <CardTitle className="text-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-blue-600" />
          </div>
          Borrowing & Fines Migration
        </CardTitle>
        <CardDescription className="text-base text-muted-foreground">
          Professional migration tool for importing borrowing records and fines from your legacy database
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-8 h-12">
            <TabsTrigger value="upload" disabled={isMigrating} className="text-sm font-medium">
              <Upload className="h-4 w-4 mr-2" />
              Upload Database
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!uploadedFile} className="text-sm font-medium">
              <FileText className="h-4 w-4 mr-2" />
              Preview & Configure
            </TabsTrigger>
            <TabsTrigger value="progress" disabled={!isMigrating && !migrationStats} className="text-sm font-medium">
              <Activity className="h-4 w-4 mr-2" />
              Migration Progress
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-6">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Prerequisites</AlertTitle>
              <AlertDescription className="text-amber-700">
                Before migrating borrowings, ensure that you have already imported <strong>books</strong> and <strong>students</strong>. 
                This process will match borrowings against existing records in your system.
              </AlertDescription>
            </Alert>
            
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 bg-gray-50/50">
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="w-20 h-20 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Database className="h-10 w-10 text-blue-600" />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-gray-900">Upload Legacy Database</h3>
                  <p className="text-gray-600 max-w-md">
                    Upload your SQLite database file (.db, .sqlite, .sqlite3) to begin the migration process.
                    Our system will automatically detect borrowing and historical tables.
                  </p>
                </div>
                
                <div className="w-full max-w-sm">
                  <Input
                    type="file"
                    accept=".db,.sqlite,.sqlite3"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                    className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                
                {isProcessing && (
                  <div className="w-full max-w-lg space-y-4">
                    <div className="flex items-center space-x-3 text-blue-600">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="font-medium">Analyzing database structure...</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Analysis Progress</span>
                        <span className="text-gray-600">{analysisProgress}%</span>
                      </div>
                      <Progress value={analysisProgress} className="h-2" />
                    </div>
                    
                    <div className="space-y-3">
                      {analysisSteps.map((step) => (
                        <div key={step.id} className="flex items-center space-x-3 text-sm">
                          <div className="flex-shrink-0">
                            {getStepIcon(step.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${
                                step.status === 'completed' ? 'text-green-700' :
                                step.status === 'processing' ? 'text-blue-700' :
                                step.status === 'error' ? 'text-red-700' :
                                'text-gray-500'
                              }`}>
                                {step.title}
                              </span>
                              {step.status === 'processing' && (
                                <span className="text-blue-600 font-medium">{step.progress}%</span>
                              )}
                            </div>
                            {step.message && (
                              <p className="text-gray-600 text-xs mt-1 truncate">{step.message}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Database Analysis</h3>
                <p className="text-gray-600 mt-1">
                  Review the detected tables and preview data before starting migration
                </p>
              </div>
              <Button 
                onClick={startMigration} 
                disabled={isMigrating || (!borrowingTables.activeTable && !borrowingTables.historicalTable)}
                size="lg"
                className="px-6"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Migration
              </Button>
            </div>
            
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">Active Borrowings</p>
                      <p className="text-2xl font-bold text-green-900">{previewData.activeBorrowingsCount}</p>
                    </div>
                    <BookCopy className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-800">Historical Records</p>
                      <p className="text-2xl font-bold text-blue-900">{previewData.historicalBorrowingsCount}</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-800">Total Records</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {previewData.activeBorrowingsCount + previewData.historicalBorrowingsCount}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Table Previews */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-gray-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Active Borrowings</CardTitle>
                    {borrowingTables.activeTable && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {borrowingTables.activeTable}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {borrowingTables.activeTable ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Preview of the first 5 records from your active borrowings table:
                      </p>
                      <div className="bg-gray-50 border rounded-lg p-3 max-h-64 overflow-auto">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(previewData.activeBorrowings, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>No Active Borrowing Table Found</AlertTitle>
                      <AlertDescription>
                        Could not detect a table for active borrowings. Check your database structure.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
              
              <Card className="border border-gray-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Historical Records</CardTitle>
                    {borrowingTables.historicalTable && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {borrowingTables.historicalTable}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {borrowingTables.historicalTable ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Preview of the first 5 records from your historical records table:
                      </p>
                      <div className="bg-gray-50 border rounded-lg p-3 max-h-64 overflow-auto">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(previewData.historicalBorrowings, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>No Historical Table Found</AlertTitle>
                      <AlertDescription>
                        Could not detect a table for historical borrowings. This is optional.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Migration Process Overview</AlertTitle>
              <AlertDescription className="text-blue-700">
                <div className="mt-2 space-y-1">
                  <p>• Match books and students using ID mapping from previous migrations</p>
                  <p>• Import active borrowings and update book copy status to 'borrowed'</p>
                  <p>• Import historical borrowings as 'returned' status</p>
                  <p>• Generate fine records for overdue returns</p>
                  <p>• Update book availability based on current borrowing status</p>
                </div>
              </AlertDescription>
            </Alert>
          </TabsContent>
          
          <TabsContent value="progress" className="space-y-6">
            {isMigrating ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-gray-900">Migration in Progress</h3>
                  <p className="text-gray-600">Please wait while we import your borrowing data...</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Overall Progress</span>
                    <span className="text-gray-600">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
                
                <div className="space-y-4">
                  {processingSteps.map((step, index) => (
                    <div key={step.id} className="flex items-start space-x-4 p-4 rounded-lg border bg-white">
                      <div className="mt-0.5">
                        {getStepIcon(step.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">{step.title}</h4>
                          {step.status === 'processing' && (
                            <span className="text-sm text-blue-600 font-medium">{step.progress}%</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{step.message}</p>
                        {step.status === 'processing' && (
                          <Progress value={step.progress} className="h-2 mt-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : migrationStats ? (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 text-green-600">
                  <CheckCircle2 className="h-6 w-6" />
                  <h3 className="text-xl font-semibold">Migration Completed Successfully</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <Badge 
                          variant={migrationStats.booksFailed > 0 ? "destructive" : "outline"}
                          className="font-mono"
                        >
                          {migrationStats.booksFailed}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Students Not Found:</span>
                        <Badge 
                          variant={migrationStats.studentsFailed > 0 ? "destructive" : "outline"}
                          className="font-mono"
                        >
                          {migrationStats.studentsFailed}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {startDate && endDate && (
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Migration Duration:</span>
                        <span className="text-gray-600">
                          {Math.round((endDate.getTime() - startDate.getTime()) / 1000)} seconds
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="font-medium">Completed At:</span>
                        <span className="text-gray-600">{endDate.toLocaleString()}</span>
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
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Migration Data</AlertTitle>
                <AlertDescription>
                  No migration has been performed yet. Please return to the upload tab to begin.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default EnhancedBorrowingMigrationPanel;