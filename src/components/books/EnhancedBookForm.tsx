import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCategories } from '@/hooks/useCategories';
import { useCreateBookCopies } from '@/hooks/useBookCopies';
import { useCreateSystemLog } from '@/hooks/useSystemLogs';
import { useBooks } from '@/hooks/useBooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, BookOpen, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface EnhancedBookFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  book?: any;
  categories?: any[];
}

export const EnhancedBookForm = ({ onSubmit, onCancel, book, categories }: EnhancedBookFormProps) => {
  const { data: books } = useBooks();
  const createBookCopies = useCreateBookCopies();
  const createLog = useCreateSystemLog();
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    publication_year: new Date().getFullYear(),
    total_copies: 1,
    category_id: '',
    description: '',
    genre: '',
    shelf_location: '',
    condition: 'good',
    book_code: '',
    acquisition_year: new Date().getFullYear(),
    prefix: ''
  });

  const [copiesPreview, setCopiesPreview] = useState<Array<{number: number, code: string}>>([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [prefixSource, setPrefixSource] = useState('title'); // 'title', 'publisher', or 'custom'

  useEffect(() => {
    if (book) {
      setFormData({ 
        ...book,
        prefix: book.book_code ? book.book_code.split('/')[0] : ''
      });
    }
  }, [book]);

  // Generate prefix based on selected source
  useEffect(() => {
    let prefix = '';
    
    if (prefixSource === 'title' && formData.title) {
      // Use first 3 letters of title
      prefix = formData.title.substring(0, 3).toUpperCase();
    } else if (prefixSource === 'publisher' && formData.publisher) {
      // Use first 3 letters of publisher
      prefix = formData.publisher.substring(0, 3).toUpperCase();
    } else if (prefixSource === 'custom') {
      // Use custom prefix (already in state)
      prefix = formData.prefix.toUpperCase();
    }
    
    if (prefix !== formData.prefix) {
      setFormData(prev => ({
        ...prev,
        prefix: prefix
      }));
    }
  }, [prefixSource, formData.title, formData.publisher, formData.prefix]);

  // Auto-generate book code and preview copies
  useEffect(() => {
    if (formData.prefix && formData.acquisition_year) {
      // Find the highest sequence number for this prefix and year
      const year = formData.acquisition_year.toString().slice(-2);
      const prefix = formData.prefix.toUpperCase();
      const pattern = `${prefix}/`;
      
      // Look for existing books with similar codes
      let maxSequence = 0;
      books?.forEach(existingBook => {
        if (existingBook.book_code && existingBook.book_code.startsWith(pattern)) {
          try {
            const parts = existingBook.book_code.split('/');
            if (parts.length === 3) {
              const sequence = parseInt(parts[1]);
              if (!isNaN(sequence) && sequence > maxSequence) {
                maxSequence = sequence;
              }
            }
          } catch (e) {
            // Skip if parsing fails
          }
        }
      });
      
      // Next sequence number
      const nextSequence = book?.book_code?.includes(pattern) ? 
        parseInt(book.book_code.split('/')[1]) : // Keep same sequence for existing book
        maxSequence + 1;
      
      // Format with padding
      const sequenceFormatted = nextSequence.toString().padStart(3, '0');
      const bookCode = `${prefix}/${sequenceFormatted}/${year}`;
      
      setFormData(prev => ({
        ...prev,
        book_code: bookCode
      }));
      
      // Generate preview of copies
      const newCopies = [];
      for (let i = 1; i <= formData.total_copies; i++) {
        newCopies.push({
          number: i,
          code: `${bookCode}-${i.toString().padStart(2, '0')}`
        });
      }
      setCopiesPreview(newCopies);
    }
  }, [formData.prefix, formData.acquisition_year, formData.total_copies, books, book]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate book code format
    const codePattern = /^[A-Z]{2,5}\/\d{3}\/\d{2}$/;
    if (!codePattern.test(formData.book_code)) {
      alert("Book code must be in the format PREFIX/NUMBER/YEAR");
      return;
    }
    
    onSubmit({
      ...formData,
      publication_year: typeof formData.publication_year === 'string' ? 
        parseInt(formData.publication_year) : formData.publication_year,
      total_copies: typeof formData.total_copies === 'string' ? 
        parseInt(formData.total_copies) : formData.total_copies,
      available_copies: book ? book.available_copies : formData.total_copies
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="tracking">Tracking Codes</TabsTrigger>
          <TabsTrigger value="copies">Book Copies</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title*</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="author">Author*</Label>
              <Input
                id="author"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="isbn">ISBN</Label>
              <Input
                id="isbn"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="publisher">Publisher</Label>
              <Input
                id="publisher"
                value={formData.publisher}
                onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="publication_year">Publication Year</Label>
              <Input
                id="publication_year"
                type="number"
                value={formData.publication_year}
                onChange={(e) => setFormData({ ...formData, publication_year: parseInt(e.target.value) })}
                min={1800}
                max={new Date().getFullYear()}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category_id">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="genre">Genre</Label>
              <Input
                id="genre"
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="shelf_location">Shelf Location</Label>
            <Input
              id="shelf_location"
              value={formData.shelf_location}
              onChange={(e) => setFormData({ ...formData, shelf_location: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="tracking" className="space-y-4 mt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Tracking Code Format</AlertTitle>
            <AlertDescription>
              Book tracking codes follow the format PREFIX/NUMBER/YEAR (e.g., KLB/001/22). 
              Each book copy will have an additional suffix (e.g., KLB/001/22-01).
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prefix_source">Prefix Source</Label>
              <Select
                value={prefixSource}
                onValueChange={setPrefixSource}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select prefix source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">From Title</SelectItem>
                  <SelectItem value="publisher">From Publisher</SelectItem>
                  <SelectItem value="custom">Custom Prefix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="prefix">Prefix</Label>
              <Input
                id="prefix"
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                maxLength={5}
                disabled={prefixSource !== 'custom'}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="acquisition_year">Acquisition Year</Label>
              <Input
                id="acquisition_year"
                type="number"
                value={formData.acquisition_year}
                onChange={(e) => setFormData({ ...formData, acquisition_year: parseInt(e.target.value) })}
                min={2000}
                max={new Date().getFullYear()}
              />
            </div>
            
            <div>
              <Label htmlFor="book_code">Generated Book Code</Label>
              <div className="flex gap-2">
                <Input
                  id="book_code"
                  value={formData.book_code}
                  onChange={(e) => setFormData({ ...formData, book_code: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="condition">Condition</Label>
            <Select
              value={formData.condition}
              onValueChange={(value) => setFormData({ ...formData, condition: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
        
        <TabsContent value="copies" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="total_copies">Total Copies</Label>
              <Input
                id="total_copies"
                type="number"
                value={formData.total_copies}
                onChange={(e) => setFormData({ ...formData, total_copies: parseInt(e.target.value) })}
                min={1}
                max={100}
              />
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Copies Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {copiesPreview.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Copy #</TableHead>
                          <TableHead>Tracking Code</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {copiesPreview.map((copy) => (
                          <TableRow key={copy.number}>
                            <TableCell>{copy.number}</TableCell>
                            <TableCell className="font-mono">{copy.code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-green-50">
                                New
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <BookOpen className="mx-auto h-8 w-8 opacity-50" />
                    <p className="mt-2">Complete the tracking code information to preview copies</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {book ? 'Update Book' : 'Add Book'}
        </Button>
      </div>
    </form>
  );
};
