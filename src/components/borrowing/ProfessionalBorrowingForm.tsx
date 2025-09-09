import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, Search, X, BookOpen, Users, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useStudents } from '@/hooks/useStudents';
import { useBooks } from '@/hooks/useBooks';
import { useAvailableBookCopies } from '@/hooks/useBookCopies';
import { useCreateMultipleBorrowings } from '@/hooks/useBorrowings';
import { useToast } from '@/hooks/use-toast';
import AvailableCopiesCard from './AvailableCopiesCard';

const FormSchema = z.object({
  student_id: z.string().min(1, 'Please select a student'),
  due_date: z.date({
    message: 'Due date is required',
  }),
});

interface SelectedBookCopy {
  id: string;
  copy_number: number;
  book_title: string;
  book_author: string;
  condition: string;
  book_id: string;
  tracking_code: string;
}

const ProfessionalBorrowingForm = () => {
  const [selectedBooks, setSelectedBooks] = useState<SelectedBookCopy[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { data: studentsResponse } = useStudents();
  const { data: books, refetch: refetchBooks } = useBooks();
  
  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  const { data: bookCopies, refetch: refetchBookCopies, isLoading: isLoadingCopies } = useAvailableBookCopies();
  const createBorrowings = useCreateMultipleBorrowings();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      due_date: addDays(new Date(), 14),
    },
  });

  // Auto-refresh data on component mount and periodically
  useEffect(() => {
    const refreshData = async () => {
      setIsRefreshing(true);
      try {
        await Promise.all([refetchBooks(), refetchBookCopies()]);
      } catch (error) {
        console.error('Error refreshing data:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    refreshData();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refetchBooks, refetchBookCopies]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchBooks(), refetchBookCopies()]);
      toast({
        title: 'Data Refreshed',
        description: 'Book availability has been updated',
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh book data',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter book copies based on search term and ensure they're truly available
  const filteredBookCopies = bookCopies?.filter(copy => {
    if (!copy || copy.status !== 'available') {
      return false;
    }
    
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const title = copy.books?.title?.toLowerCase() || '';
    const author = copy.books?.author?.toLowerCase() || '';
    const trackingCode = copy.tracking_code?.toLowerCase() || '';
    const bookCode = copy.book_code?.toLowerCase() || '';
    const copyNumber = copy.copy_number?.toString() || '';
    
    return title.includes(searchLower) ||
           author.includes(searchLower) ||
           trackingCode.includes(searchLower) ||
           bookCode.includes(searchLower) ||
           copyNumber.includes(searchLower);
  }) || [];

  // Group copies by book for better display
  const groupedCopies = filteredBookCopies.reduce((acc, copy) => {
    const bookId = copy.book_id;
    if (!acc[bookId]) {
      acc[bookId] = {
        book: copy.books,
        copies: []
      };
    }
    acc[bookId].copies.push(copy);
    return acc;
  }, {} as Record<string, { book: any; copies: any[] }>);

  const filteredStudents = students?.filter(student =>
    student.first_name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    student.last_name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    student.admission_number.toLowerCase().includes(studentSearchTerm.toLowerCase())
  ) || [];

  const addBookCopy = (copy: any) => {
    if (selectedBooks.find(book => book.id === copy.id)) {
      toast({
        title: 'Already Selected',
        description: 'This book copy is already in your selection.',
        variant: 'destructive',
      });
      return;
    }

    const newBook: SelectedBookCopy = {
      id: copy.id,
      copy_number: copy.copy_number,
      book_title: copy.books?.title || 'Unknown Title',
      book_author: copy.books?.author || 'Unknown Author',
      condition: copy.condition || 'good',
      book_id: copy.book_id,
      tracking_code: copy.tracking_code || `Copy #${copy.copy_number}`,
    };

    setSelectedBooks(prev => [...prev, newBook]);
    toast({
      title: 'Book Added',
      description: `${newBook.tracking_code} of "${newBook.book_title}" added to selection.`,
    });
  };

  const removeBookCopy = (copyId: string) => {
    setSelectedBooks(prev => prev.filter(book => book.id !== copyId));
  };

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    if (selectedBooks.length === 0) {
      toast({
        title: 'No Books Selected',
        description: 'Please select at least one book to issue.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const borrowings = selectedBooks.map(book => ({
        student_id: data.student_id,
        book_id: book.book_id,
        book_copy_id: book.id,
        due_date: format(data.due_date, 'yyyy-MM-dd'),
        condition_at_issue: book.condition,
        tracking_code: book.tracking_code,
        status: 'active' as const,
      }));

      await createBorrowings.mutateAsync(borrowings);
      
      // Reset form and refresh data
      form.reset();
      setSelectedBooks([]);
      setSearchTerm('');
      setStudentSearchTerm('');
      await handleManualRefresh();
      
    } catch (error) {
      console.error('Error creating borrowings:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Available Copies Overview Card */}
      <AvailableCopiesCard />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Book Selection Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Select Book Copies ({filteredBookCopies.length} available)
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleManualRefresh}
                disabled={isRefreshing || isLoadingCopies}
                className="ml-auto"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", (isRefreshing || isLoadingCopies) && "animate-spin")} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, author, tracking code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {Object.entries(groupedCopies).map(([bookId, { book, copies }]) => (
                  <Card key={bookId} className="p-3 bg-muted/30">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{book?.title}</p>
                          <p className="text-xs text-muted-foreground">by {book?.author}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              {copies.length} copies available
                            </Badge>
                            {book?.book_code && (
                              <Badge variant="secondary" className="text-xs">
                                {book.book_code}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-1">
                        {copies.map((copy) => (
                          <div 
                            key={copy.id}
                            className="flex items-center justify-between p-2 bg-white rounded border hover:bg-blue-50 cursor-pointer transition-colors"
                            onClick={() => addBookCopy(copy)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-blue-600 font-bold">
                                {copy.tracking_code}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                Copy #{copy.copy_number}
                              </Badge>
                              <Badge variant={copy.condition === 'excellent' ? 'default' : copy.condition === 'good' ? 'secondary' : 'destructive'}>
                                {copy.condition}
                              </Badge>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                              Select
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
                
                {filteredBookCopies.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {isLoadingCopies ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Loading book copies...</span>
                      </div>
                    ) : searchTerm ? (
                      <div>
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p>No matching book copies found for: "{searchTerm}"</p>
                        <Button 
                          variant="outline" 
                          onClick={handleManualRefresh}
                          className="mt-2"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Data
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p>No available book copies found</p>
                        <Button 
                          variant="outline" 
                          onClick={handleManualRefresh}
                          className="mt-2"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Data
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Issue Form Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Issue Books
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Student Selection */}
                <FormField
                  control={form.control}
                  name="student_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Student</FormLabel>
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search students..."
                            value={studentSearchTerm}
                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a student" />
                            </SelectTrigger>
                            <SelectContent>
                              <ScrollArea className="h-[200px]">
                                {filteredStudents.map((student) => (
                                  <SelectItem key={student.id} value={student.id}>
                                    <div className="flex flex-col">
                                      <span>{student.first_name} {student.last_name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {student.admission_number} - {student.class_grade}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </ScrollArea>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Due Date */}
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarUI
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Selected Books Summary */}
                {selectedBooks.length > 0 && (
                  <div className="space-y-2">
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Selected Books ({selectedBooks.length})
                    </FormLabel>
                    <Card className="p-3">
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {selectedBooks.map((book, index) => (
                            <div key={book.id}>
                              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                                <div className="space-y-1">
                                  <p className="font-medium text-sm">{book.book_title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {book.tracking_code} • {book.book_author}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {book.condition}
                                  </Badge>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeBookCopy(book.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {index < selectedBooks.length - 1 && <Separator className="my-1" />}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </Card>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createBorrowings.isPending || selectedBooks.length === 0}
                >
                  {createBorrowings.isPending ? 'Issuing Books...' : `Issue ${selectedBooks.length} Book${selectedBooks.length !== 1 ? 's' : ''}`}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfessionalBorrowingForm;
