
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BookFormProps {
  book?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  categories?: any[];
}

export const BookForm = ({ book, onSubmit, onCancel, categories }: BookFormProps) => {
  const [formData, setFormData] = useState({
    title: book?.title || '',
    author: book?.author || '',
    isbn: book?.isbn || '',
    genre: book?.genre || '',
    publisher: book?.publisher || '',
    publication_year: book?.publication_year || '',
    total_copies: book?.total_copies || 1,
    shelf_location: book?.shelf_location || '',
    description: book?.description || '',
    category_id: book?.category_id || '',
    status: book?.status || 'available'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      publication_year: formData.publication_year ? parseInt(formData.publication_year) : null,
      total_copies: parseInt(formData.total_copies.toString()),
      available_copies: book ? book.available_copies : parseInt(formData.total_copies.toString())
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="author">Author *</Label>
          <Input
            id="author"
            value={formData.author}
            onChange={(e) => setFormData({ ...formData, author: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="isbn">ISBN</Label>
          <Input
            id="isbn"
            value={formData.isbn}
            onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="genre">Genre</Label>
          <Input
            id="genre"
            value={formData.genre}
            onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, publication_year: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="total_copies">Total Copies *</Label>
          <Input
            id="total_copies"
            type="number"
            min="1"
            value={formData.total_copies}
            onChange={(e) => setFormData({ ...formData, total_copies: parseInt(e.target.value) })}
            required
          />
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
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
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
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
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

      <div className="flex justify-end space-x-2 pt-4">
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
