import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, AlertCircle, BookOpen, Users, Clock, FileText } from 'lucide-react';

interface MigrationSettingsProps {
  file: File | null;
  onStartMigration: () => void;
}

const MigrationSettings = ({ file, onStartMigration }: MigrationSettingsProps) => {
  const [settings, setSettings] = useState({
    // What to import
    importBooks: true,
    importStudents: true,
    importBorrowings: true,
    importCategories: true,
    importFines: true,
    
    // Student settings
    studentClassAssignment: {
      '2022': 'Form 4, Section A',
      '2023': 'Form 3, Section A',
      '2024': 'Form 2, Section A',
      'other': 'graduated'
    },
    
    // Book settings
    generateNewTrackingCodes: true,
    storeOldBookIdsAsMetadata: true,
    
    // Borrowing settings
    importOnlyActiveBorrowings: false,
    
    // Conflict handling
    conflictStrategy: 'skip' as 'skip' | 'overwrite' | 'merge',
    
    // Advanced
    batchSize: 100,
    validateDataBeforeImport: true,
    createBackupBeforeImport: true
  });

  const handleStartMigration = () => {
    // In a real implementation, we would store the settings in a context or pass them to the migration service
    // For now, we'll just log them and call the onStartMigration callback
    console.log('Migration settings:', settings);
    
    // Store settings in localStorage for the migration process to access
    localStorage.setItem('migrationSettings', JSON.stringify(settings));
    
    onStartMigration();
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Configure Migration</AlertTitle>
        <AlertDescription>
          Select what data you want to import and how to handle it. These settings will determine how your old data is mapped to the new system.
        </AlertDescription>
      </Alert>
      
      {/* Data Selection */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Data to Import</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <Checkbox 
                id="importBooks" 
                checked={settings.importBooks}
                onCheckedChange={(checked) => 
                  setSettings({...settings, importBooks: checked === true})
                }
              />
              <div className="grid gap-1.5">
                <Label htmlFor="importBooks" className="font-medium flex items-center">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Books
                </Label>
                <p className="text-sm text-muted-foreground">
                  Import books and their copies from the old system
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Checkbox 
                id="importStudents" 
                checked={settings.importStudents}
                onCheckedChange={(checked) => 
                  setSettings({...settings, importStudents: checked === true})
                }
              />
              <div className="grid gap-1.5">
                <Label htmlFor="importStudents" className="font-medium flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Students
                </Label>
                <p className="text-sm text-muted-foreground">
                  Import student records from the old system
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Checkbox 
                id="importBorrowings" 
                checked={settings.importBorrowings}
                onCheckedChange={(checked) => 
                  setSettings({...settings, importBorrowings: checked === true})
                }
              />
              <div className="grid gap-1.5">
                <Label htmlFor="importBorrowings" className="font-medium flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Borrowings
                </Label>
                <p className="text-sm text-muted-foreground">
                  Import borrowing records (both active and historical)
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Checkbox 
                id="importCategories" 
                checked={settings.importCategories}
                onCheckedChange={(checked) => 
                  setSettings({...settings, importCategories: checked === true})
                }
              />
              <div className="grid gap-1.5">
                <Label htmlFor="importCategories" className="font-medium flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Categories
                </Label>
                <p className="text-sm text-muted-foreground">
                  Import book categories from the old system
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Student Settings */}
      {settings.importStudents && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Student Settings</h3>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-2">
                Assign students to classes based on their creation year:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="class2022">Students created in 2022</Label>
                  <Select
                    value={settings.studentClassAssignment['2022']}
                    onValueChange={(value) => 
                      setSettings({
                        ...settings, 
                        studentClassAssignment: {
                          ...settings.studentClassAssignment,
                          '2022': value
                        }
                      })
                    }
                  >
                    <SelectTrigger id="class2022">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Form 4, Section A">Form 4, Section A</SelectItem>
                      <SelectItem value="graduated">Mark as Graduated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="class2023">Students created in 2023</Label>
                  <Select
                    value={settings.studentClassAssignment['2023']}
                    onValueChange={(value) => 
                      setSettings({
                        ...settings, 
                        studentClassAssignment: {
                          ...settings.studentClassAssignment,
                          '2023': value
                        }
                      })
                    }
                  >
                    <SelectTrigger id="class2023">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Form 3, Section A">Form 3, Section A</SelectItem>
                      <SelectItem value="Form 4, Section A">Form 4, Section A</SelectItem>
                      <SelectItem value="graduated">Mark as Graduated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="class2024">Students created in 2024</Label>
                  <Select
                    value={settings.studentClassAssignment['2024']}
                    onValueChange={(value) => 
                      setSettings({
                        ...settings, 
                        studentClassAssignment: {
                          ...settings.studentClassAssignment,
                          '2024': value
                        }
                      })
                    }
                  >
                    <SelectTrigger id="class2024">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Form 2, Section A">Form 2, Section A</SelectItem>
                      <SelectItem value="Form 3, Section A">Form 3, Section A</SelectItem>
                      <SelectItem value="Form 4, Section A">Form 4, Section A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="classOther">Older students</Label>
                  <Select
                    value={settings.studentClassAssignment['other']}
                    onValueChange={(value) => 
                      setSettings({
                        ...settings, 
                        studentClassAssignment: {
                          ...settings.studentClassAssignment,
                          'other': value
                        }
                      })
                    }
                  >
                    <SelectTrigger id="classOther">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="graduated">Mark as Graduated</SelectItem>
                      <SelectItem value="Form 4, Section A">Form 4, Section A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Book Settings */}
      {settings.importBooks && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Book Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="generateNewTrackingCodes">Generate new tracking codes</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate new tracking codes for imported books
                  </p>
                </div>
                <Switch
                  id="generateNewTrackingCodes"
                  checked={settings.generateNewTrackingCodes}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, generateNewTrackingCodes: checked})
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="storeOldBookIdsAsMetadata">Store old book IDs as metadata</Label>
                  <p className="text-sm text-muted-foreground">
                    Store the old book IDs in the metadata for reference
                  </p>
                </div>
                <Switch
                  id="storeOldBookIdsAsMetadata"
                  checked={settings.storeOldBookIdsAsMetadata}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, storeOldBookIdsAsMetadata: checked})
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Borrowing Settings */}
      {settings.importBorrowings && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Borrowing Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="importOnlyActiveBorrowings">Import only active borrowings</Label>
                  <p className="text-sm text-muted-foreground">
                    Only import currently active borrowings, skip historical records
                  </p>
                </div>
                <Switch
                  id="importOnlyActiveBorrowings"
                  checked={settings.importOnlyActiveBorrowings}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, importOnlyActiveBorrowings: checked})
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Advanced Settings */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Advanced Settings</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="conflictStrategy">Conflict handling strategy</Label>
              <Select
                value={settings.conflictStrategy}
                onValueChange={(value: 'skip' | 'overwrite' | 'merge') => 
                  setSettings({...settings, conflictStrategy: value})
                }
              >
                <SelectTrigger id="conflictStrategy">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip conflicting records</SelectItem>
                  <SelectItem value="overwrite">Overwrite existing records</SelectItem>
                  <SelectItem value="merge">Merge data (keep both)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                How to handle records that already exist in the system
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="batchSize">Batch size</Label>
              <Select
                value={settings.batchSize.toString()}
                onValueChange={(value) => 
                  setSettings({...settings, batchSize: parseInt(value)})
                }
              >
                <SelectTrigger id="batchSize">
                  <SelectValue placeholder="Select batch size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 records</SelectItem>
                  <SelectItem value="100">100 records</SelectItem>
                  <SelectItem value="200">200 records</SelectItem>
                  <SelectItem value="500">500 records</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Number of records to process in each batch
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="validateDataBeforeImport">Validate data before import</Label>
                <p className="text-sm text-muted-foreground">
                  Validate all data before starting the import process
                </p>
              </div>
              <Switch
                id="validateDataBeforeImport"
                checked={settings.validateDataBeforeImport}
                onCheckedChange={(checked) => 
                  setSettings({...settings, validateDataBeforeImport: checked})
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="createBackupBeforeImport">Create backup before import</Label>
                <p className="text-sm text-muted-foreground">
                  Create a backup of your current data before importing
                </p>
              </div>
              <Switch
                id="createBackupBeforeImport"
                checked={settings.createBackupBeforeImport}
                onCheckedChange={(checked) => 
                  setSettings({...settings, createBackupBeforeImport: checked})
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Start Migration Button */}
      <div className="flex justify-end">
        <Button onClick={handleStartMigration} className="px-6">
          Start Migration
        </Button>
      </div>
    </div>
  );
};

export default MigrationSettings; 