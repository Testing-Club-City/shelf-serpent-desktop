import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { BookOpen, Upload, AlertCircle, Play, FileText, Check, BookCopy, UsersRound, Clock, DollarSign } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import initSqlJs from 'sql.js';
import { MigrationService } from './MigrationService';

// Types for migration stats
interface MigrationStats {
  active: number;
  historical: number;
  total: number;
  booksFailed: number;
  studentsFailed: number;
  fines: number;
}

export const BorrowingMigrationPanel = () => {
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
  }>({
    activeBorrowings: [],
    historicalBorrowings: []
  });
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [migrationStats, setMigrationStats] = useState<MigrationStats | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setUploadedFile(file);
    
    try {
      setIsProcessing(true);
      
      // Read the SQLite database file
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Initialize SQL.js
      const SQL = await initSqlJs({
        locateFile: file => {
          // Try local first, then fallback to CDN
          try {
            return `/sql-wasm.wasm`;
          } catch (error) {
            return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`;
          }
        }
      });
      
      // Create a SQLite database instance in memory
      const db = new SQL.Database(uint8Array);
      setSqliteDb(db);
      
      // Get all tables in the database
      const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tables = tablesResult[0]?.values.map(row => ({ name: String(row[0]) })) || [];
      
      // Find borrowing-related tables
      const activeTable = tables.find((t: any) => 
        t.name.toLowerCase().includes('issue') || 
        t.name.toLowerCase() === 'borrowing'
      )?.name || '';
      
      const historicalTable = tables.find((t: any) => 
        t.name.toLowerCase().includes('submit') || 
        t.name.toLowerCase() === 'returnedbooks' ||
        t.name.toLowerCase() === 'history'
      )?.name || '';
      
      setBorrowingTables({
        activeTable: String(activeTable),
        historicalTable: String(historicalTable)
      });
      
      // Load preview data for active borrowings
      if (activeTable) {
        const activeResult = db.exec(`SELECT * FROM ${activeTable} LIMIT 10`);
        const activeBorrowings = activeResult[0]?.values || [];
        const columns = activeResult[0]?.columns || [];
        const formattedActive = activeBorrowings.map(row => 
          Object.fromEntries(columns.map((col, i) => [col, row[i]]))
        );
        setPreviewData(prev => ({ ...prev, activeBorrowings: formattedActive }));
      }
      
      // Load preview data for historical borrowings
      if (historicalTable) {
        const historicalResult = db.exec(`SELECT * FROM ${historicalTable} LIMIT 10`);
        const historicalBorrowings = historicalResult[0]?.values || [];
        const columns = historicalResult[0]?.columns || [];
        const formattedHistorical = historicalBorrowings.map(row => 
          Object.fromEntries(columns.map((col, i) => [col, row[i]]))
        );
        setPreviewData(prev => ({ ...prev, historicalBorrowings: formattedHistorical }));
      }
      
      setActiveTab('preview');
    } catch (error) {
      console.error('Error processing database file:', error);
      toast({
        title: 'Error',
        description: 'Failed to read the database file. Please ensure it is a valid SQLite database.',
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
    
    try {
      // Import active borrowings
      let activeCount = 0;
      let historicalCount = 0;
      let failedBooks = 0;
      let failedStudents = 0;
      let finesCount = 0;
      
      if (borrowingTables.activeTable) {
        // Get count of active borrowings
        const activeCountResult = sqliteDb.exec(`SELECT COUNT(*) as count FROM ${borrowingTables.activeTable}`);
        const activeBorrowingsCount = activeCountResult[0]?.values[0][0] || 0;
        
        // Import active borrowings using MigrationService
        activeCount = await MigrationService.importBorrowings(
          sqliteDb,
          100, // batch size
          true, // only active borrowings
          (progress, total) => {
            // Update progress as a percentage
            const percentage = Math.floor((progress / total) * 100);
            setProgress(percentage);
          }
        );
        
        // Get failed mappings counts
        failedBooks = MigrationService.failedMappings.books.length;
        failedStudents = MigrationService.failedMappings.students.length;
      }
      
      // Import historical borrowings if selected and available
      if (borrowingTables.historicalTable) {
        // Get count of historical borrowings
        const historicalCountResult = sqliteDb.exec(`SELECT COUNT(*) as count FROM ${borrowingTables.historicalTable}`);
        const historicalBorrowingsCount = historicalCountResult[0]?.values[0][0] || 0;
        
        // Import historical borrowings and potentially fines
        const result = await MigrationService.importHistoricalBorrowingsAndFines(
          sqliteDb,
          "100", // batch size
          (progress, total) => {
            // Update progress as a percentage
            const percentage = Math.floor((progress / total) * 100);
            setProgress(percentage);
          }
        );
        
        historicalCount = result.borrowings;
        finesCount = result.fines;
      }
      
      // Set migration stats
      setMigrationStats({
        active: activeCount,
        historical: historicalCount,
        total: activeCount + historicalCount,
        booksFailed: failedBooks,
        studentsFailed: failedStudents,
        fines: finesCount
      });
      
      // Update book status based on borrowings
      await MigrationService.updateBookStatusFromBorrowings();
      
      setProgress(100);
      setEndDate(new Date());
      
      toast({
        title: 'Success',
        description: `Successfully migrated ${activeCount + historicalCount} borrowings and ${finesCount} fines.`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Error during migration:', error);
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
    // Cleanup when component unmounts
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Borrowing & Fines Migration
        </CardTitle>
        <CardDescription>
          Import borrowing records and fines from your legacy database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="upload" disabled={isMigrating}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Database
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!uploadedFile}>
              <FileText className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="progress" disabled={!isMigrating && !migrationStats}>
              <Play className="h-4 w-4 mr-2" />
              Migration
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Before migrating borrowings, ensure that you have already imported books and students. 
                  This process will match borrowings against existing books and students in the system.
                </AlertDescription>
              </Alert>
              
              <div className="border rounded-lg p-6 flex flex-col items-center justify-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                  <BookOpen className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium">Upload Legacy Database</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Upload your SQLite database file to import borrowing records and fines.
                  The system will analyze the file and identify borrowing tables.
                </p>
                <div className="flex items-center justify-center w-full">
                  <Input
                    type="file"
                    accept=".db,.sqlite,.sqlite3"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                    className="max-w-sm"
                  />
                </div>
                {isProcessing && (
                  <div className="flex items-center space-x-2">
                    <span className="animate-spin">⌛</span>
                    <span>Processing database file...</span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Database Overview</h3>
                  <p className="text-sm text-muted-foreground">
                    The following borrowing tables were detected in your database:
                  </p>
                </div>
                <Button onClick={startMigration} disabled={isMigrating}>
                  Start Migration
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {borrowingTables.activeTable ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Active Borrowings</CardTitle>
                        <Badge variant="outline">{borrowingTables.activeTable}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs overflow-auto max-h-64 border rounded-md p-2">
                        <pre>{JSON.stringify(previewData.activeBorrowings, null, 2)}</pre>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Active Borrowings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No active borrowing table found</AlertTitle>
                        <AlertDescription>
                          Could not detect a table for active borrowings in your database.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                )}
                
                {borrowingTables.historicalTable ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Historical Borrowings & Fines</CardTitle>
                        <Badge variant="outline">{borrowingTables.historicalTable}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs overflow-auto max-h-64 border rounded-md p-2">
                        <pre>{JSON.stringify(previewData.historicalBorrowings, null, 2)}</pre>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Historical Borrowings & Fines</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No historical borrowing table found</AlertTitle>
                        <AlertDescription>
                          Could not detect a table for historical borrowings in your database.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Migration Process</AlertTitle>
                <AlertDescription>
                  <p>The migration will:</p>
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li>Match books and students between systems using ID mapping</li>
                    <li>Import active borrowings, updating book copy status to 'borrowed'</li>
                    <li>Import historical borrowings as 'returned' status</li>
                    <li>Import fine information from historical records</li>
                    <li>Update book and copy availability based on borrowing status</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
          
          <TabsContent value="progress">
            <div className="space-y-6">
              {isMigrating ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Migration in Progress</h3>
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {progress < 100 ? 'Importing borrowings and fines...' : 'Finalizing migration...'}
                  </p>
                </div>
              ) : migrationStats ? (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-green-600">
                    <Check className="h-5 w-5" />
                    <h3 className="text-lg font-medium">Migration Complete</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          Borrowing Records
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Active Borrowings:</span>
                            <Badge variant="outline">{migrationStats.active}</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Historical Borrowings:</span>
                            <Badge variant="outline">{migrationStats.historical}</Badge>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center font-medium">
                            <span className="text-sm">Total Records:</span>
                            <Badge>{migrationStats.total}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Fines & Issues
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Fines Imported:</span>
                            <Badge variant="outline">{migrationStats.fines}</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Books Not Found:</span>
                            <Badge variant={migrationStats.booksFailed > 0 ? "destructive" : "outline"}>
                              {migrationStats.booksFailed}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Students Not Found:</span>
                            <Badge variant={migrationStats.studentsFailed > 0 ? "destructive" : "outline"}>
                              {migrationStats.studentsFailed}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {startDate && endDate && (
                    <div className="text-sm text-muted-foreground">
                      Migration started at {startDate.toLocaleTimeString()} and completed at {endDate.toLocaleTimeString()}
                      ({Math.round((endDate.getTime() - startDate.getTime()) / 1000)} seconds)
                    </div>
                  )}
                  
                  <Alert className="bg-primary/5 border-primary/20">
                    <Check className="h-4 w-4 text-primary" />
                    <AlertTitle>Next Steps</AlertTitle>
                    <AlertDescription>
                      <p>You can now:</p>
                      <ul className="list-disc pl-5 space-y-1 mt-2">
                        <li>Verify borrowing records in the Borrowings section</li>
                        <li>Review fines in the Fines section</li>
                        <li>Check book availability has been updated correctly</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Migration Data</AlertTitle>
                  <AlertDescription>
                    No migration has been performed yet. Please go back to the upload tab to start a migration.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BorrowingMigrationPanel; 