
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
import { invoke } from '@tauri-apps/api/core';

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
    publisher: '',
    publication_year: new Date().getFullYear(),
    category_id: '',
    shelf_location: '',
    number_of_copies: 1,
    book_code: '',
    prefix: '',
    acquisition_year: new Date().getFullYear(),
    supplier_type: '',
    supplier_name: '',
  });

  const [nextLegacyId, setNextLegacyId] = useState<number>(1);

  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  useEffect(() => {
    if (book) {
      setFormData({ 
        ...book,
        prefix: book.book_code ? book.book_code.split('/')[0].split('-')[0] : '',
        number_of_copies: book.total_copies || 1,
      });
    } else {
      // For new books, get the next sequential legacy book ID
      const fetchNextId = async () => {
        try {
          const nextId = await invoke<number>('get_next_legacy_book_id');
          setNextLegacyId(nextId);
          setFormData(prev => ({ 
            ...prev, 
            number_of_copies: 1
          }));
        } catch (error) {
          console.error('Failed to get next legacy book ID:', error);
        }
      };
      fetchNextId();
    }
  }, [book]);

  // Auto-generate prefix from title
  useEffect(() => {
    if (formData.title && formData.title.length >= 3 && !book) {
      const prefix = formData.title.substring(0, 3).toUpperCase();
      setFormData(prev => ({ ...prev, prefix }));
    }
  }, [formData.title, book]);

  // Generate book codes based on number of copies
  useEffect(() => {
    if (formData.prefix && formData.acquisition_year && formData.number_of_copies && nextLegacyId) {
      const year = formData.acquisition_year.toString().slice(-2);
      const codes = [];
      
      for (let i = 0; i < formData.number_of_copies; i++) {
        const bookId = nextLegacyId + i;
        const bookCode = `${formData.prefix}/${bookId}/${year}`;
        codes.push(bookCode);
      }
      
      setGeneratedCodes(codes);
      
      // Set a unique book code using the legacy ID pattern
      if (codes.length > 0) {
        const uniqueCode = `${formData.prefix}/${nextLegacyId}/${year}`;
        setFormData(prev => ({ 
          ...prev, 
          book_code: uniqueCode,
          total_copies: codes.length 
        }));
      }
    }
  }, [formData.prefix, formData.acquisition_year, formData.number_of_copies, nextLegacyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.number_of_copies <= 0) {
      alert("Number of copies must be greater than 0");
      return;
    }
    
    onSubmit({
      ...formData,
      publication_year: typeof formData.publication_year === 'string' ? 
        parseInt(formData.publication_year) : formData.publication_year,
      total_copies: formData.number_of_copies,
      available_copies: book ? book.available_copies : formData.number_of_copies,
      generated_codes: generatedCodes,
      start_number: nextLegacyId // Include for backend compatibility
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
            
            <div>
              <Label htmlFor="publisher">Publisher</Label>
              <Input
                id="publisher"
                value={formData.publisher}
                onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                placeholder="Enter publisher name"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier_type">Supplier Type</Label>
              <Select
                value={formData.supplier_type}
                onValueChange={(value) => {
                  setFormData({ 
                    ...formData, 
                    supplier_type: value,
                    supplier_name: value === 'government' ? 'Government' : ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="bookshop">Bookshop</SelectItem>
                  <SelectItem value="donors">Donors</SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="supplier_name">Supplier Name</Label>
              <Input
                id="supplier_name"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder={formData.supplier_type === 'government' ? 'Government' : 'Enter supplier name'}
                disabled={formData.supplier_type === 'government'}
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
              Book codes will be generated as PREFIX/NUMBER/YEAR (e.g., KAM/80179/25). Each book copy gets a unique sequential number that continues from the highest existing ID in the database.
              {nextLegacyId > 1 && (
                <span className="block mt-1 font-medium text-blue-600">
                  Next available ID: {nextLegacyId}
                </span>
              )}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="prefix">Code Prefix</Label>
              <Input
                id="prefix"
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase().substring(0, 5) })}
                maxLength={5}
                placeholder="KAM"
              />
            </div>
            
            <div>
              <Label htmlFor="number_of_copies">Number of Copies</Label>
              <Input
                id="number_of_copies"
                type="number"
                value={formData.number_of_copies}
                onChange={(e) => setFormData({ ...formData, number_of_copies: parseInt(e.target.value) || 1 })}
                min={1}
                max={100}
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
