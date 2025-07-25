import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowRight, 
  Database, 
  Users, 
  BookOpen, 
  FileText, 
  Calendar,
  MapPin,
  Info,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface DataMappingProps {
  sqliteDb?: any;
  onMappingAnalyzed?: (mappingData: any) => void;
}

interface TableMapping {
  sourceTable: string;
  targetTable: string;
  fieldMappings: FieldMapping[];
  recordCount: number;
  status: 'mapped' | 'partial' | 'unmapped';
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  dataType: string;
  isRequired: boolean;
  transformationRequired: boolean;
  description: string;
}

export const DataMapping = ({ sqliteDb, onMappingAnalyzed }: DataMappingProps) => {
  const [tableMappings, setTableMappings] = useState<TableMapping[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<TableMapping | null>(null);

  useEffect(() => {
    if (sqliteDb) {
      analyzeDataMapping();
    }
  }, [sqliteDb]);

  const analyzeDataMapping = async () => {
    if (!sqliteDb) return;
    
    setIsAnalyzing(true);
    try {
      console.log('🔍 Analyzing Kisii School database structure...');
      
      // Get all tables from SQLite database (excluding system tables)
      const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
      const tablesResult = sqliteDb.exec(tablesQuery);
      const sqliteTables = tablesResult[0]?.values.map((row: any) => String(row[0])) || [];
      
      console.log('📋 Found tables in Kisii School database:', sqliteTables);
      
      if (sqliteTables.length === 0) {
        console.log('❌ No user tables found in database');
        setTableMappings([]);
        setIsAnalyzing(false);
        return;
      }

      // Analyze each table to understand its structure
      for (const tableName of sqliteTables) {
        try {
          const sampleQuery = `SELECT * FROM ${tableName} LIMIT 5`;
          const sampleResult = sqliteDb.exec(sampleQuery);
          if (sampleResult[0]) {
            console.log(`📊 Sample data from ${tableName}:`, {
              columns: sampleResult[0].columns,
              rowCount: sampleResult[0].values.length,
              sampleRows: sampleResult[0].values
            });
          }
        } catch (error) {
          console.warn(`Could not analyze table ${tableName}:`, error);
        }
      }
      
      const mappings: TableMapping[] = [];
      
      // Define mapping rules for different table types
      const mappingRules = [
        {
          patterns: ['book', 'books', 'publication'],
          targetTable: 'books',
          priority: 1,
          fieldMappings: [
            { sourceField: 'title', targetField: 'title', dataType: 'text', isRequired: true, transformationRequired: false, description: 'Book title' },
            { sourceField: 'author', targetField: 'author', dataType: 'text', isRequired: true, transformationRequired: false, description: 'Book author' },
            { sourceField: 'isbn', targetField: 'isbn', dataType: 'text', isRequired: false, transformationRequired: false, description: 'ISBN number' },
            { sourceField: 'publisher', targetField: 'publisher', dataType: 'text', isRequired: false, transformationRequired: false, description: 'Publisher name' },
            { sourceField: 'publication_year', targetField: 'publication_year', dataType: 'integer', isRequired: false, transformationRequired: false, description: 'Year of publication' },
            { sourceField: 'category', targetField: 'category_id', dataType: 'uuid', isRequired: false, transformationRequired: true, description: 'Book category (requires category lookup)' }
          ]
        },
        {
          patterns: ['student', 'students', 'member', 'members', 'user', 'users'],
          targetTable: 'students',
          priority: 2,
          fieldMappings: [
            { sourceField: 'first_name', targetField: 'first_name', dataType: 'text', isRequired: true, transformationRequired: false, description: 'Student first name' },
            { sourceField: 'last_name', targetField: 'last_name', dataType: 'text', isRequired: true, transformationRequired: false, description: 'Student last name' },
            { sourceField: 'admission_number', targetField: 'admission_number', dataType: 'text', isRequired: true, transformationRequired: false, description: 'Student admission number' },
            { sourceField: 'class', targetField: 'class_grade', dataType: 'text', isRequired: true, transformationRequired: true, description: 'Student class/grade (may need formatting)' },
            { sourceField: 'email', targetField: 'email', dataType: 'text', isRequired: false, transformationRequired: false, description: 'Student email address' },
            { sourceField: 'phone', targetField: 'phone', dataType: 'text', isRequired: false, transformationRequired: false, description: 'Student phone number' }
          ]
        },
        {
          patterns: ['borrowing', 'borrowings', 'issue', 'issues', 'checkout'],
          targetTable: 'borrowings',
          priority: 3,
          fieldMappings: [
            { sourceField: 'student_id', targetField: 'student_id', dataType: 'uuid', isRequired: true, transformationRequired: true, description: 'Student ID (requires student lookup)' },
            { sourceField: 'book_id', targetField: 'book_id', dataType: 'uuid', isRequired: true, transformationRequired: true, description: 'Book ID (requires book lookup)' },
            { sourceField: 'issue_date', targetField: 'borrowed_date', dataType: 'date', isRequired: true, transformationRequired: true, description: 'Date book was borrowed' },
            { sourceField: 'due_date', targetField: 'due_date', dataType: 'date', isRequired: true, transformationRequired: false, description: 'Date book is due' },
            { sourceField: 'return_date', targetField: 'returned_date', dataType: 'date', isRequired: false, transformationRequired: false, description: 'Date book was returned' },
            { sourceField: 'status', targetField: 'status', dataType: 'enum', isRequired: false, transformationRequired: true, description: 'Borrowing status (active/returned/overdue)' }
          ]
        },
        {
          patterns: ['category', 'categories', 'genre', 'genres', 'subject', 'subjects'],
          targetTable: 'categories',
          priority: 4,
          fieldMappings: [
            { sourceField: 'name', targetField: 'name', dataType: 'text', isRequired: true, transformationRequired: false, description: 'Category name' },
            { sourceField: 'description', targetField: 'description', dataType: 'text', isRequired: false, transformationRequired: false, description: 'Category description' }
          ]
        },
        {
          patterns: ['fine', 'fines', 'penalty', 'penalties'],
          targetTable: 'fines',
          priority: 5,
          fieldMappings: [
            { sourceField: 'student_id', targetField: 'student_id', dataType: 'uuid', isRequired: true, transformationRequired: true, description: 'Student ID (requires student lookup)' },
            { sourceField: 'amount', targetField: 'amount', dataType: 'numeric', isRequired: true, transformationRequired: false, description: 'Fine amount' },
            { sourceField: 'reason', targetField: 'description', dataType: 'text', isRequired: false, transformationRequired: false, description: 'Reason for fine' },
            { sourceField: 'date', targetField: 'created_at', dataType: 'timestamp', isRequired: true, transformationRequired: true, description: 'Date fine was issued' }
          ]
        }
      ];

      // Analyze each SQLite table
      for (const tableName of sqliteTables) {
        try {
          // Get table structure
          const structureResult = sqliteDb.exec(`PRAGMA table_info(${tableName})`);
          const columns = structureResult[0]?.values.map((row: any) => String(row[1])) || [];
          
          // Get record count
          const countResult = sqliteDb.exec(`SELECT COUNT(*) FROM ${tableName}`);
          const recordCount = Number(countResult[0]?.values[0][0]) || 0;
          
          // Find best matching rule
          let bestMatch = null;
          let bestScore = 0;
          
          for (const rule of mappingRules) {
            const score = rule.patterns.reduce((acc, pattern) => {
              if (tableName.toLowerCase().includes(pattern.toLowerCase())) {
                return acc + 10;
              }
              // Check if table has fields similar to this rule's target
              const fieldMatches = columns.filter(col => 
                rule.fieldMappings.some(fm => 
                  col.toLowerCase().includes(fm.sourceField.toLowerCase()) ||
                  fm.sourceField.toLowerCase().includes(col.toLowerCase())
                )
              ).length;
              return acc + fieldMatches;
            }, 0);
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = rule;
            }
          }
          
          if (bestMatch && bestScore > 0) {
            // Create field mappings based on actual columns
            const actualFieldMappings = bestMatch.fieldMappings.filter(fm => {
              const sourceExists = columns.some(col => 
                col.toLowerCase() === fm.sourceField.toLowerCase() ||
                col.toLowerCase().includes(fm.sourceField.toLowerCase()) ||
                fm.sourceField.toLowerCase().includes(col.toLowerCase())
              );
              return sourceExists;
            }).map(fm => {
              const actualColumn = columns.find(col => 
                col.toLowerCase() === fm.sourceField.toLowerCase() ||
                col.toLowerCase().includes(fm.sourceField.toLowerCase()) ||
                fm.sourceField.toLowerCase().includes(col.toLowerCase())
              );
              return {
                ...fm,
                sourceField: actualColumn || fm.sourceField
              };
            });
            
            mappings.push({
              sourceTable: tableName,
              targetTable: bestMatch.targetTable,
              fieldMappings: actualFieldMappings,
              recordCount,
              status: actualFieldMappings.length > 0 ? 
                (actualFieldMappings.length === bestMatch.fieldMappings.length ? 'mapped' : 'partial') : 
                'unmapped'
            });
          } else {
            // Unmapped table
            mappings.push({
              sourceTable: tableName,
              targetTable: 'unmapped',
              fieldMappings: [],
              recordCount,
              status: 'unmapped'
            });
          }
        } catch (error) {
          console.error(`Error analyzing table ${tableName}:`, error);
        }
      }
      
      setTableMappings(mappings);
      onMappingAnalyzed?.(mappings);
      
    } catch (error) {
      console.error('Error analyzing data mapping:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'mapped':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      mapped: 'default',
      partial: 'secondary',
      unmapped: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'destructive'}>
        {status}
      </Badge>
    );
  };

  if (!sqliteDb) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Please upload a database file first to analyze data mapping.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Data Mapping Analysis
          </CardTitle>
          <CardDescription>
            This shows how data from your legacy database will be transferred to the new system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAnalyzing ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">Analyzing database structure...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {tableMappings.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No tables found in the database or analysis failed.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="grid gap-4">
                    {tableMappings.map((mapping, index) => (
                      <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setSelectedMapping(mapping)}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{mapping.sourceTable}</span>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <div className="flex items-center gap-2">
                                {mapping.targetTable === 'books' && <BookOpen className="h-4 w-4 text-blue-500" />}
                                {mapping.targetTable === 'students' && <Users className="h-4 w-4 text-green-500" />}
                                {mapping.targetTable === 'borrowings' && <Calendar className="h-4 w-4 text-purple-500" />}
                                {mapping.targetTable === 'categories' && <FileText className="h-4 w-4 text-orange-500" />}
                                {mapping.targetTable === 'fines' && <AlertCircle className="h-4 w-4 text-red-500" />}
                                <span className="font-medium">
                                  {mapping.targetTable === 'unmapped' ? 'No mapping found' : mapping.targetTable}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">
                                {mapping.recordCount.toLocaleString()} records
                              </span>
                              {getStatusIcon(mapping.status)}
                              {getStatusBadge(mapping.status)}
                            </div>
                          </div>
                          {mapping.fieldMappings.length > 0 && (
                            <div className="mt-3 text-sm text-muted-foreground">
                              {mapping.fieldMappings.length} field mappings identified
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {selectedMapping && (
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Field Mapping Details: {selectedMapping.sourceTable} → {selectedMapping.targetTable}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {selectedMapping.fieldMappings.length === 0 ? (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                No field mappings found for this table. Manual configuration may be required.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <div className="grid gap-3">
                              {selectedMapping.fieldMappings.map((field, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex items-center gap-4">
                                    <code className="px-2 py-1 bg-muted rounded text-sm">
                                      {field.sourceField}
                                    </code>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    <code className="px-2 py-1 bg-muted rounded text-sm">
                                      {field.targetField}
                                    </code>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{field.dataType}</Badge>
                                    {field.isRequired && (
                                      <Badge variant="secondary">Required</Badge>
                                    )}
                                    {field.transformationRequired && (
                                      <Badge variant="outline">Transform</Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <Separator />
                          
                          <div className="space-y-2">
                            <h4 className="font-medium">Migration Summary</h4>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>• {selectedMapping.recordCount.toLocaleString()} records will be migrated</p>
                              <p>• {selectedMapping.fieldMappings.filter(f => f.isRequired).length} required fields mapped</p>
                              <p>• {selectedMapping.fieldMappings.filter(f => f.transformationRequired).length} fields require transformation</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataMapping;