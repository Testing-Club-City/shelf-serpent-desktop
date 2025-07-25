import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// Progress component will be simulated with a div for now
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Download,
  Upload,
  Play,
  Pause
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useClasses } from '@/hooks/useClasses';
import { supabase } from '@/integrations/supabase/client';

interface MigrationStats {
  total: number;
  imported: number;
  errors: number;
  duplicates: number;
  graduated: number;
  active: number;
}

interface ClassDistribution {
  [className: string]: number;
}

export const StudentMigrationPanel: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [migrationStats, setMigrationStats] = useState<MigrationStats | null>(null);
  const [classDistribution, setClassDistribution] = useState<ClassDistribution>({});
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('upload');
  const { toast } = useToast();
  const { data: classes = [] } = useClasses();

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.toLowerCase().includes('.db') || file.name.toLowerCase().includes('.sqlite')) {
        setUploadedFile(file);
        toast({
          title: 'Database File Uploaded',
          description: `File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        });
        setActiveTab('preview');
      } else {
        toast({
          title: 'Invalid File Type',
          description: 'Please upload a SQLite database file (.db or .sqlite)',
          variant: 'destructive',
        });
      }
    }
  };

  // Perform actual migration with SQLite file processing
  const handleStartMigration = async () => {
    if (!uploadedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please upload a database file first',
        variant: 'destructive',
      });
      return;
    }

    setIsMigrating(true);
    setMigrationProgress(0);
    setActiveTab('progress');

    try {
      // Check if we have the required classes
      console.log('Available classes:', classes);
      
      if (classes.length === 0) {
        toast({
          title: 'No Classes Found',
          description: 'Please create classes in Class Management first',
          variant: 'destructive',
        });
        setIsMigrating(false);
        return;
      }

      setMigrationProgress(10);

      // Read the SQLite file
      const fileBuffer = await uploadedFile.arrayBuffer();
      setMigrationProgress(20);

      // Import SQL.js for SQLite processing
      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs({
        locateFile: (file) => `https://sql.js.org/dist/${file}`
      });

      setMigrationProgress(30);

      // Load the database
      const db = new SQL.Database(new Uint8Array(fileBuffer));
      
      // Get student data from the SQLite database - only essential fields
      const stmt = db.prepare(`
        SELECT MemberID, Name, AdmissionYear, RollNo 
        FROM MemberDetails 
        WHERE MemberID IS NOT NULL AND Name IS NOT NULL
        ORDER BY AdmissionYear DESC
      `);

      const students = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        students.push(row);
      }
      stmt.free();
      db.close();

      setMigrationProgress(50);

      // Process students and assign to classes
      const stats: MigrationStats = {
        total: students.length,
        imported: 0,
        errors: 0,
        duplicates: 0,
        graduated: 0,
        active: 0
      };

      const distribution: ClassDistribution = {};
      const currentYear = new Date().getFullYear();

      // Ensure Graduated class exists
      let graduatedClass = classes.find(c => c.class_name.toLowerCase().includes('graduated'));
      if (!graduatedClass) {
        const { data: newClass } = await supabase
          .from('classes')
          .insert({
            class_name: 'Graduated',
            form_level: 0,
            class_section: null,
            max_books_allowed: 0,
            is_active: false
          })
          .select()
          .single();
        
        if (newClass) {
          graduatedClass = newClass;
        }
      }

      setMigrationProgress(60);

      // Process each student
      for (const student of students) {
        try {
          const admissionYear = parseInt(student.AdmissionYear) || 2020;
          let targetClassName = 'Graduated';

          // Assign class based on admission year
          if (admissionYear === 2024) {
            targetClassName = 'Form 2';
          } else if (admissionYear === 2023) {
            targetClassName = 'Form 3';
          } else if (admissionYear === 2022) {
            targetClassName = 'Form 4';
          }

          // Find the actual class
          let targetClass = classes.find(c => 
            c.class_name.toLowerCase().includes(targetClassName.toLowerCase())
          );

          // If Form class not found, try with section A
          if (!targetClass && targetClassName !== 'Graduated') {
            targetClass = classes.find(c => 
              c.class_name.toLowerCase().includes(`${targetClassName.toLowerCase()} a`)
            );
          }

          // Fallback to graduated class
          if (!targetClass) {
            targetClass = graduatedClass;
            targetClassName = 'Graduated';
          }

          // Parse name from correct column
          const nameParts = (student.Name || '').trim().split(' ');
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || 'Student';

          // Insert student with only essential data
          const { error } = await supabase
            .from('students')
            .insert({
              admission_number: student.RollNo || `${student.MemberID}`, // Use RollNo as admission number, fallback to MemberID
              first_name: firstName,
              last_name: lastName,
              class_grade: targetClass?.class_name || 'Graduated',
              class_id: targetClass?.id || graduatedClass?.id,
              academic_year: '2024/2025',
              status: targetClassName === 'Graduated' ? 'graduated' : 'active',
              enrollment_date: admissionYear ? `${admissionYear}-01-01` : new Date().toISOString().split('T')[0]
            });

          if (error) {
            if (error.code === '23505') { // Duplicate key
              stats.duplicates++;
            } else {
              stats.errors++;
              console.error('Student import error:', error);
            }
          } else {
            stats.imported++;
            if (targetClassName === 'Graduated') {
              stats.graduated++;
            } else {
              stats.active++;
            }

            // Update distribution
            const className = targetClass?.class_name || 'Graduated';
            distribution[className] = (distribution[className] || 0) + 1;
          }
        } catch (error) {
          stats.errors++;
          console.error('Error processing student:', error);
        }
      }

      setMigrationProgress(90);

      setMigrationStats(stats);
      setClassDistribution(distribution);
      setMigrationProgress(100);
      setActiveTab('results');

      toast({
        title: 'Migration Completed',
        description: `Successfully imported ${stats.imported} of ${stats.total} students`,
      });

    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: 'Migration Failed',
        description: error instanceof Error ? error.message : 'An error occurred during migration',
        variant: 'destructive',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // Get available classes summary
  const getClassesSummary = () => {
    const activeClasses = classes.filter(c => c.is_active);
    const graduatedClass = classes.find(c => c.class_name === 'Graduated');
    
    return {
      total: classes.length,
      active: activeClasses.length,
      hasGraduated: !!graduatedClass,
      formLevels: [...new Set(classes.map(c => c.form_level))].sort()
    };
  };

  const classesSummary = getClassesSummary();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Student Migration</h2>
          <p className="text-gray-600">Import students from your legacy database with automatic class assignment</p>
        </div>
      </div>

      {/* Classes Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Class Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{classesSummary.total}</div>
              <div className="text-sm text-gray-600">Total Classes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{classesSummary.active}</div>
              <div className="text-sm text-gray-600">Active Classes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{classesSummary.formLevels.length}</div>
              <div className="text-sm text-gray-600">Form Levels</div>
            </div>
            <div className="text-center">
              <Badge variant={classesSummary.hasGraduated ? "default" : "destructive"}>
                {classesSummary.hasGraduated ? "✓ Graduated Class Ready" : "⚠ No Graduated Class"}
              </Badge>
            </div>
          </div>
          
          {!classesSummary.hasGraduated && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Missing Graduated Class</AlertTitle>
              <AlertDescription>
                A "Graduated" class will be automatically created during migration to handle alumni students.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Migration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!uploadedFile}>
            <FileText className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="progress" disabled={isMigrating && !migrationStats}>
            <Play className="h-4 w-4 mr-2" />
            Migration
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!migrationStats}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Legacy Database</CardTitle>
              <CardDescription>
                Upload your old library system's SQLite database file (kisii school.db)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Migration Rules</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Students from 2024 → Form 2 A</li>
                      <li>Students from 2023 → Form 3 A</li>
                      <li>Students from 2022 → Form 4 A</li>
                      <li>Students from 2021 and earlier → Graduated</li>
                      <li>Using MemberID as admission number (roll number)</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Upload Database File</p>
                    <p className="text-gray-600">Select your SQLite database file</p>
                  </div>
                  <input
                    type="file"
                    accept=".db,.sqlite,.sqlite3"
                    onChange={handleFileUpload}
                    className="mt-4"
                    disabled={isUploading}
                  />
                </div>

                {uploadedFile && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>File Ready</AlertTitle>
                    <AlertDescription>
                      {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB) is ready for migration.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Migration Preview</CardTitle>
              <CardDescription>
                Review the migration plan before proceeding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-medium">Source Database</h3>
                    <p className="text-sm text-gray-600">File: {uploadedFile?.name}</p>
                    <p className="text-sm text-gray-600">Size: {uploadedFile ? (uploadedFile.size / 1024 / 1024).toFixed(2) : 0} MB</p>
                    <p className="text-sm text-gray-600">Data: MemberID (roll number), Name, AdmissionYear</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium">Target Classes</h3>
                    <div className="space-y-1">
                      {classes.filter(c => c.is_active).map(cls => (
                        <div key={cls.id} className="text-sm text-gray-600">
                          • {cls.class_name} (Level {cls.form_level})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setActiveTab('upload')}>
                    Back to Upload
                  </Button>
                  <Button onClick={handleStartMigration} disabled={isMigrating || !uploadedFile}>
                    Start Migration
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Migration Progress</CardTitle>
              <CardDescription>
                Please wait while we import your student data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${migrationProgress}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium">{migrationProgress}% Complete</p>
                  {isMigrating && (
                    <p className="text-sm text-gray-600">Processing student records...</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          <div className="space-y-6">
            {/* Summary Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Migration Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {migrationStats && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{migrationStats.total}</div>
                      <div className="text-sm text-gray-600">Total Records</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{migrationStats.imported}</div>
                      <div className="text-sm text-gray-600">Imported</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{migrationStats.active}</div>
                      <div className="text-sm text-gray-600">Active Students</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{migrationStats.graduated}</div>
                      <div className="text-sm text-gray-600">Graduated</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{migrationStats.errors}</div>
                      <div className="text-sm text-gray-600">Errors</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Class Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Student Distribution by Class</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(classDistribution).map(([className, count]) => (
                    <div key={className} className="flex items-center justify-between">
                      <span className="font-medium">{className}</span>
                      <Badge variant="outline">{count} students</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Migration Completed Successfully!</AlertTitle>
                    <AlertDescription>
                      Your students have been imported using their MemberID as admission numbers and assigned to appropriate classes based on their admission year.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex space-x-2">
                    <Button onClick={() => window.location.reload()}>
                      View Students
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setActiveTab('upload');
                      setUploadedFile(null);
                      setMigrationStats(null);
                      setClassDistribution({});
                      setMigrationProgress(0);
                    }}>
                      Import Another File
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentMigrationPanel;
