
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCategories } from '@/hooks/useCategories';
import { useBooks } from '@/hooks/useBooks';
import { BookOpen, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SimpleBookFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  book?: any;
}

export const SimpleBookForm = ({ onSubmit, onCancel, book }: SimpleBookFormProps) => {
  const { data: categories } = useCategories();
  const { data: books } = useBooks();
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    publication_year: new Date().getFullYear(),
    category_id: '',
    shelf_location: '',
    total_copies: 1,
    book_code: '',
    prefix: '',
    start_number: 1,
    end_number: 1,
    acquisition_year: new Date().getFullYear(),
  });

  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  useEffect(() => {
    if (book) {
      setFormData({ 
        ...book,
        prefix: book.book_code ? book.book_code.split('/')[0] : '',
        start_number: 1,
        end_number: book.total_copies || 1,
      });
    }
  }, [book]);

  // Auto-generate prefix from title
  useEffect(() => {
    if (formData.title && formData.title.length >= 3) {
      const prefix = formData.title.substring(0, 3).toUpperCase();
      setFormData(prev => ({ ...prev, prefix }));
    }
  }, [formData.title]);

  // Generate book codes based on start and end numbers
  useEffect(() => {
    if (formData.prefix && formData.acquisition_year && formData.start_number && formData.end_number) {
      const year = formData.acquisition_year.toString().slice(-2);
      const codes = [];
      
      for (let i = formData.start_number; i <= formData.end_number; i++) {
        const sequenceFormatted = i.toString().padStart(3, '0');
        const bookCode = `${formData.prefix}/${sequenceFormatted}/${year}`;
        codes.push(bookCode);
      }
      
      setGeneratedCodes(codes);
      
      // Set the prefix as the main book code (not the full tracking code)
      if (codes.length > 0) {
        setFormData(prev => ({ 
          ...prev, 
          book_code: formData.prefix, // Use just the prefix, not the full tracking code
          total_copies: codes.length 
        }));
      }
    }
  }, [formData.prefix, formData.acquisition_year, formData.start_number, formData.end_number]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.start_number > formData.end_number) {
      alert("Start number cannot be greater than end number");
      return;
    }
    
    onSubmit({
      ...formData,
      publication_year: typeof formData.publication_year === 'string' ? 
        parseInt(formData.publication_year) : formData.publication_year,
      total_copies: formData.end_number - formData.start_number + 1,
      available_copies: book ? book.available_copies : (formData.end_number - formData.start_number + 1),
      generated_codes: generatedCodes
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            {book ? 'Edit Book' : 'Add New Book'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="Enter book title"
              />
            </div>
            
            <div>
              <Label htmlFor="author">Author *</Label>
              <Input
                id="author"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                required
                placeholder="Enter author name"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label htmlFor="shelf_location">Shelf Location</Label>
              <Input
                id="shelf_location"
                value={formData.shelf_location}
                onChange={(e) => setFormData({ ...formData, shelf_location: e.target.value })}
                placeholder="e.g., A1, B2"
              />
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Book codes will be generated as PREFIX/NUMBER/YEAR (e.g., KAM/001/25). Each book gets a unique sequential number.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="prefix">Code Prefix</Label>
              <Input
                id="prefix"
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                maxLength={5}
                placeholder="KAM"
              />
            </div>
            
            <div>
              <Label htmlFor="start_number">Start Number</Label>
              <Input
                id="start_number"
                type="number"
                value={formData.start_number}
                onChange={(e) => setFormData({ ...formData, start_number: parseInt(e.target.value) || 1 })}
                min={1}
                max={999}
              />
            </div>
            
            <div>
              <Label htmlFor="end_number">End Number</Label>
              <Input
                id="end_number"
                type="number"
                value={formData.end_number}
                onChange={(e) => setFormData({ ...formData, end_number: parseInt(e.target.value) || 1 })}
                min={1}
                max={999}
              />
            </div>
            
            <div>
              <Label htmlFor="acquisition_year">Year</Label>
              <Input
                id="acquisition_year"
                type="number"
                value={formData.acquisition_year}
                onChange={(e) => setFormData({ ...formData, acquisition_year: parseInt(e.target.value) })}
                min={2000}
                max={new Date().getFullYear()}
              />
            </div>
          </div>

          {generatedCodes.length > 0 && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-lg">Generated Book Codes ({generatedCodes.length} books)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                  {generatedCodes.map((code, index) => (
                    <div key={index} className="text-sm font-mono bg-background p-2 rounded border">
                      {code}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
      
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={generatedCodes.length === 0}>
          {book ? 'Update Book' : `Add ${generatedCodes.length} Book${generatedCodes.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </form>
  );
};
