import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Users, FileText, ArrowRight, Download, RefreshCw, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MigrationReportsProps {
  stats: {
    books: number;
    students: number;
    borrowings: number;
    categories: number;
    errors: number;
  };
}

const MigrationReports = ({ stats }: MigrationReportsProps) => {
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [books, setBooks] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Load migration data from Supabase
  const loadMigrationData = async () => {
    setIsLoading(true);
    
    try {
      // In a real implementation, we would fetch data from the migration_metadata table
      // For demo purposes, we'll just simulate the process with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate fetching migrated books
      setBooks(Array(Math.min(stats.books, 10)).fill(0).map((_, i) => ({
        id: `book-${i + 1}`,
        title: `Sample Book ${i + 1}`,
        author: `Author ${(i + 1) % 5 + 1}`,
        isbn: `978-1-${i + 1}-${i + 1}-${i + 1}`,
        old_id: i + 1,
        imported_at: new Date().toISOString()
      })));
      
      // Simulate fetching migrated students
      setStudents(Array(Math.min(stats.students, 10)).fill(0).map((_, i) => ({
        id: `student-${i + 1}`,
        name: `Student ${i + 1}`,
        admission_number: `S${(2000 + i + 1).toString().padStart(4, '0')}`,
        class_grade: i % 4 === 0 ? 'Form 4, Section A' : 
                    i % 3 === 0 ? 'Form 3, Section A' : 
                    i % 2 === 0 ? 'Form 2, Section A' : 'graduated',
        old_id: i + 1,
        imported_at: new Date().toISOString()
      })));
      
      // Simulate fetching migrated categories
      setCategories(Array(Math.min(stats.categories, 10)).fill(0).map((_, i) => ({
        id: `category-${i + 1}`,
        name: `Category ${i + 1}`,
        shelf: `Shelf ${String.fromCharCode(65 + (i % 26))}`,
        old_id: i + 1,
        imported_at: new Date().toISOString()
      })));
      
      // Simulate fetching migrated borrowings
      setBorrowings(Array(Math.min(stats.borrowings, 10)).fill(0).map((_, i) => ({
        id: `borrowing-${i + 1}`,
        student_name: `Student ${(i + 1) % 10 + 1}`,
        book_title: `Sample Book ${(i + 1) % 20 + 1}`,
        status: i % 3 === 0 ? 'returned' : 'borrowed',
        borrowed_date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        due_date: new Date(Date.now() + ((10 - i) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        old_id: i + 1,
        imported_at: new Date().toISOString()
      })));
    } catch (error) {
      console.error('Error loading migration data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load data when component mounts
  useEffect(() => {
    loadMigrationData();
  }, []);
  
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return dateString;
    }
  };
  
  const handleExportReport = () => {
    // In a real implementation, we would generate a CSV or PDF report
    // For demo purposes, we'll just simulate the process with an alert
    alert('Report exported successfully!');
  };
  
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium">Migration Summary</h3>
            <Button onClick={handleExportReport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center justify-center p-4 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <span className="font-medium">Books</span>
              </div>
              <span className="text-2xl font-bold">{stats.books}</span>
            </div>
            
            <div className="flex flex-col items-center justify-center p-4 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">Students</span>
              </div>
              <span className="text-2xl font-bold">{stats.students}</span>
            </div>
            
            <div className="flex flex-col items-center justify-center p-4 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">Categories</span>
              </div>
              <span className="text-2xl font-bold">{stats.categories}</span>
            </div>
            
            <div className="flex flex-col items-center justify-center p-4 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="h-5 w-5 text-primary" />
                <span className="font-medium">Borrowings</span>
              </div>
              <span className="text-2xl font-bold">{stats.borrowings}</span>
            </div>
          </div>
          
          <div className="mt-6 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Migration completed successfully</span>
            </div>
            
            <Button 
              onClick={loadMigrationData} 
              variant="ghost" 
              size="sm" 
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Detailed Reports */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Imported Data</h3>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 mb-6">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="books">Books</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="borrowings">Borrowings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The migration has been completed successfully. Below is a summary of the imported data.
                </p>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data Type</TableHead>
                      <TableHead>Records Imported</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Books</TableCell>
                      <TableCell>{stats.books}</TableCell>
                      <TableCell>
                        <Badge variant="default">Completed</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Students</TableCell>
                      <TableCell>{stats.students}</TableCell>
                      <TableCell>
                        <Badge variant="default">Completed</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Categories</TableCell>
                      <TableCell>{stats.categories}</TableCell>
                      <TableCell>
                        <Badge variant="default">Completed</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Borrowings</TableCell>
                      <TableCell>{stats.borrowings}</TableCell>
                      <TableCell>
                        <Badge variant="default">Completed</Badge>
                      </TableCell>
                    </TableRow>
                    {stats.errors > 0 && (
                      <TableRow>
                        <TableCell className="font-medium">Errors</TableCell>
                        <TableCell>{stats.errors}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">Failed</Badge>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="books">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>ISBN</TableHead>
                      <TableHead>Old ID</TableHead>
                      <TableHead>Imported At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell className="font-medium">{book.title}</TableCell>
                        <TableCell>{book.author}</TableCell>
                        <TableCell>{book.isbn}</TableCell>
                        <TableCell>{book.old_id}</TableCell>
                        <TableCell>{formatDate(book.imported_at)}</TableCell>
                      </TableRow>
                    ))}
                    {books.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No books imported
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {books.length > 0 && books.length < stats.books && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Showing {books.length} of {stats.books} books
                </p>
              )}
            </TabsContent>
            
            <TabsContent value="students">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Admission Number</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Old ID</TableHead>
                      <TableHead>Imported At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.admission_number}</TableCell>
                        <TableCell>{student.class_grade}</TableCell>
                        <TableCell>{student.old_id}</TableCell>
                        <TableCell>{formatDate(student.imported_at)}</TableCell>
                      </TableRow>
                    ))}
                    {students.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No students imported
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {students.length > 0 && students.length < stats.students && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Showing {students.length} of {stats.students} students
                </p>
              )}
            </TabsContent>
            
            <TabsContent value="borrowings">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Book</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Borrowed Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Old ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {borrowings.map((borrowing) => (
                      <TableRow key={borrowing.id}>
                        <TableCell className="font-medium">{borrowing.student_name}</TableCell>
                        <TableCell>{borrowing.book_title}</TableCell>
                        <TableCell>
                          <Badge variant={borrowing.status === 'returned' ? 'default' : 'secondary'}>
                            {borrowing.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{borrowing.borrowed_date}</TableCell>
                        <TableCell>{borrowing.due_date}</TableCell>
                        <TableCell>{borrowing.old_id}</TableCell>
                      </TableRow>
                    ))}
                    {borrowings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                          No borrowings imported
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {borrowings.length > 0 && borrowings.length < stats.borrowings && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Showing {borrowings.length} of {stats.borrowings} borrowings
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default MigrationReports; 