import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Database, Upload, AlertTriangle, CheckCircle, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { invoke } from '@tauri-apps/api/core';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DatabaseManagement = () => {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [isSelectiveImporting, setIsSelectiveImporting] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  const availableTables = [
    { id: 'books', name: 'Books', description: 'Book catalog and metadata' },
    { id: 'book_copies', name: 'Book Copies', description: 'Individual book copy records' },
    { id: 'students', name: 'Students', description: 'Student information and enrollment' },
    { id: 'staff', name: 'Staff', description: 'Staff members and librarians' },
    { id: 'classes', name: 'Classes', description: 'Class and form level information' },
    { id: 'categories', name: 'Categories', description: 'Book categories and classifications' },
    { id: 'borrowings', name: 'Borrowings', description: 'Borrowing records and history' },
    { id: 'fines', name: 'Fines', description: 'Fine records and payments' }
  ];

  const handleImportDatabase = async () => {
    try {
      setIsImporting(true);
      
      const result = await invoke('import_database') as {
        success: boolean;
        message: string;
        backup_path?: string;
      };

      if (result.success) {
        toast({
          title: "Database Imported Successfully",
          description: `${result.message}${result.backup_path ? ` Backup saved to: ${result.backup_path}` : ''}`,
          variant: "default",
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast({
          title: "Import Cancelled",
          description: result.message,
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Database import error:', error);
      toast({
        title: "Import Failed",
        description: `Failed to import database: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSelectiveImport = async () => {
    if (selectedTables.length === 0) {
      toast({
        title: "No Tables Selected",
        description: "Please select at least one table to import",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSelectiveImporting(true);
      
      const result = await invoke('import_selective_tables', {
        tables: selectedTables
      }) as {
        success: boolean;
        message: string;
        imported_counts?: Record<string, number>;
        skipped_counts?: Record<string, number>;
      };

      if (result.success) {
        const importedText = result.imported_counts ? 
          Object.entries(result.imported_counts)
            .map(([table, count]) => `${table}: ${count} imported`)
            .join(', ') : '';
        
        const skippedText = result.skipped_counts ? 
          Object.entries(result.skipped_counts)
            .map(([table, count]) => `${table}: ${count} skipped`)
            .join(', ') : '';

        toast({
          title: "Selective Import Completed",
          description: `${result.message}. ${importedText}${skippedText ? `. ${skippedText}` : ''}`,
          variant: "default",
        });
      } else {
        toast({
          title: "Import Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Selective import error:', error);
      toast({
        title: "Import Failed",
        description: `Failed to import tables: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsSelectiveImporting(false);
    }
  };

  const handleTableSelection = (tableId: string, checked: boolean) => {
    if (checked) {
      setSelectedTables(prev => [...prev, tableId]);
    } else {
      setSelectedTables(prev => prev.filter(id => id !== tableId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Database className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Database Management</h2>
          <p className="text-gray-600">Import and manage your library database</p>
        </div>
      </div>

      <Tabs defaultValue="replace" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="replace">Replace Database</TabsTrigger>
          <TabsTrigger value="selective">Selective Import</TabsTrigger>
        </TabsList>

        <TabsContent value="replace">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Replace Entire Database
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This will replace your entire database. 
                  A backup will be created automatically before replacement.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">What happens when you replace:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Current database is backed up automatically
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Selected database file replaces the current one
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      System restarts with the new database
                    </li>
                  </ul>
                </div>

                <Button 
                  onClick={handleImportDatabase}
                  disabled={isImporting}
                  className="w-full"
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Replacing Database...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Replace Database
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="selective">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="w-5 h-5" />
                Selective Table Import
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Safe Import:</strong> Import specific tables without replacing your database. 
                  Existing records will be skipped to avoid duplicates.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Select tables to import:</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {availableTables.map((table) => (
                      <div key={table.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={table.id}
                          checked={selectedTables.includes(table.id)}
                          onCheckedChange={(checked) => handleTableSelection(table.id, checked as boolean)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor={table.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {table.name}
                          </label>
                          <p className="text-xs text-blue-600">
                            {table.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Import behavior:</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Records with existing IDs will be skipped</li>
                    <li>• Only new records will be imported</li>
                    <li>• Your current data remains unchanged</li>
                    <li>• No backup needed - safe operation</li>
                  </ul>
                </div>

                <Button 
                  onClick={handleSelectiveImport}
                  disabled={isSelectiveImporting || selectedTables.length === 0}
                  className="w-full"
                  size="lg"
                >
                  {isSelectiveImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importing Selected Tables...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 mr-2" />
                      Import Selected Tables ({selectedTables.length})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Supported file formats:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• SQLite database files (.db, .sqlite, .sqlite3)</li>
          <li>• Must be a valid this system version database</li>
        </ul>
      </div>
    </div>
  );
};
