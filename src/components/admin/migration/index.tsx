import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, FileUp, FileDown, Settings, AlertCircle, Users, BookOpen, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import UploadDatabase from './UploadDatabase';
import MigrationSettings from './MigrationSettings';
import MigrationStatus from './MigrationStatus';
import MigrationReports from './MigrationReports';
import StudentMigrationPanel from './StudentMigrationPanel';
import ProfessionalBorrowingMigrationPanel from './ProfessionalBorrowingMigrationPanel';
import DataMapping from './DataMapping';

export const MigrationModule = () => {
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sqliteDb, setSqliteDb] = useState<any>(null);
  const [migrationInProgress, setMigrationInProgress] = useState<boolean>(false);
  const [migrationComplete, setMigrationComplete] = useState<boolean>(false);
  const [migrationStats, setMigrationStats] = useState<{
    books: number;
    students: number;
    borrowings: number;
    categories: number;
    errors: number;
  }>({
    books: 0,
    students: 0,
    borrowings: 0,
    categories: 0,
    errors: 0
  });

  const handleFileUploaded = (file: File, db?: any) => {
    setUploadedFile(file);
    if (db) {
      setSqliteDb(db);
      setActiveTab('mapping');
    } else {
      setActiveTab('settings');
    }
  };

  const handleStartMigration = () => {
    setMigrationInProgress(true);
    setActiveTab('status');
    // Migration process will be handled by the MigrationStatus component
  };

  const handleMigrationComplete = (stats: typeof migrationStats) => {
    setMigrationInProgress(false);
    setMigrationComplete(true);
    setMigrationStats(stats);
    setActiveTab('reports');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Database className="h-6 w-6" />
          Legacy Database Migration
        </CardTitle>
        <CardDescription>
          Import data from your old library management system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            This tool will import data from your old SQLite database file. The process is irreversible and will create new records in your current system. Please ensure you have a backup of your current data before proceeding.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/*
           * Use a flexible, wrapping layout for the tab list so that all tabs remain
           * visible on narrower view-ports. A simple `flex` container with `flex-wrap`
           * lets Radix Tabs triggers wrap onto multiple lines when required, ensuring
           * that the Borrowings migration tab is never hidden off-screen.
           */}
          <TabsList className="flex flex-wrap gap-2 mb-6">
            <TabsTrigger value="upload" disabled={migrationInProgress}>
              <FileUp className="mr-2 h-4 w-4" />
              Upload Database
            </TabsTrigger>
            <TabsTrigger value="mapping" disabled={!uploadedFile || !sqliteDb}>
              <MapPin className="mr-2 h-4 w-4" />
              Data Mapping
            </TabsTrigger>
            <TabsTrigger value="settings" disabled={!uploadedFile || migrationInProgress}>
              <Settings className="mr-2 h-4 w-4" />
              Migration Settings
            </TabsTrigger>
            <TabsTrigger value="status">
              <Database className="mr-2 h-4 w-4" />
              Migration Status
            </TabsTrigger>
            <TabsTrigger value="students">
              <Users className="mr-2 h-4 w-4" />
              Students
            </TabsTrigger>
            <TabsTrigger value="borrowings">
              <BookOpen className="mr-2 h-4 w-4" />
              Borrowings
            </TabsTrigger>
            <TabsTrigger value="reports" disabled={!migrationComplete}>
              <FileDown className="mr-2 h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <UploadDatabase onFileUploaded={handleFileUploaded} />
          </TabsContent>

          <TabsContent value="mapping">
            <DataMapping 
              sqliteDb={sqliteDb}
              onMappingAnalyzed={(mappingData) => {
                console.log('Mapping analysis complete:', mappingData);
              }}
            />
          </TabsContent>

          <TabsContent value="settings">
            <MigrationSettings 
              file={uploadedFile} 
              onStartMigration={handleStartMigration} 
            />
          </TabsContent>

          <TabsContent value="status">
            <MigrationStatus 
              file={uploadedFile}
              migrationInProgress={migrationInProgress}
              onMigrationComplete={handleMigrationComplete}
            />
          </TabsContent>
          
          <TabsContent value="students">
            <StudentMigrationPanel />
          </TabsContent>
          
          <TabsContent value="borrowings">
            <ProfessionalBorrowingMigrationPanel />
          </TabsContent>

          <TabsContent value="reports">
            <MigrationReports stats={migrationStats} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MigrationModule; 