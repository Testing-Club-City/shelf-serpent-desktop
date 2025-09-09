import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, BookOpen, AlertCircle, CheckCircle, Info, FileSpreadsheet, FileText, Plus, Edit } from 'lucide-react';
import { useCategories, useCreateCategory } from '@/hooks/useCategories';
import { useBooks, useCreateBook } from '@/hooks/useBooks';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export const BulkBookEntry = () => {
  const [bookData, setBookData] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[]; duplicates: string[] } | null>(null);
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  const [showMissingCategoriesDialog, setShowMissingCategoriesDialog] = useState(false);
  const [showEditBooksDialog, setShowEditBooksDialog] = useState(false);
  const [showUploadConfirmDialog, setShowUploadConfirmDialog] = useState(false);
  const [missingCategories, setMissingCategories] = useState<string[]>([]);
  const [booksToEdit, setBooksToEdit] = useState<any[]>([]);
  const [isCreatingCategories, setIsCreatingCategories] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories, refetch: refetchCategories } = useCategories();
  const { data: existingBooks } = useBooks();
  const createBook = useCreateBook();
  const createCategory = useCreateCategory();
  const { toast } = useToast();

  // Get all existing book codes and ISBNs for duplicate detection
  const existingBookCodes = new Set(
    existingBooks?.map(b => b.book_code?.toLowerCase()).filter(Boolean) || []
  );
  const existingISBNs = new Set(
    existingBooks?.map(b => b.isbn?.toLowerCase()).filter(Boolean) || []
  );

  // Create category lookup map for validation
  const categoryMap = new Map(
    categories?.map(cat => [cat.name.toLowerCase(), cat.id]) || []
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        // Convert to CSV format
        let csvData = '';
        jsonData.forEach((row, index) => {
          // Skip empty rows and header row if it contains headers
          if (row.length >= 6 && row[0] && row[1] && row[3] && row[4] && row[5]) {
            // Check if this looks like a header row
            const firstCell = row[0].toString().toLowerCase();
            if (index === 0 && (firstCell.includes('title') || firstCell.includes('book') || firstCell.includes('name'))) {
              return; // Skip header row
            }
            // Format: title,author,isbn,book_code,copies,category,publisher,year,description,genre,shelf_location
            const copies = row[4] || '';
            const category = row[5] || '';
            const publisher = row[6] || '';
            const year = row[7] || '';
            const description = row[8] || '';
            const genre = row[9] || '';
            const shelf = row[10] || '';
            csvData += `${row[0]},${row[1]},${row[2] || ''},${row[3]},${copies},${category},${publisher},${year},${description},${genre},${shelf}\n`;
          }
        });
        
        setBookData(csvData);
        setInputMethod('file');
        
        toast({
          title: 'File Uploaded',
          description: `Successfully loaded ${csvData.split('\n').filter(line => line.trim()).length} books from Excel file`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to read Excel file. Please check the format and try again.',
          variant: 'destructive',
        });
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const downloadExcelTemplate = () => {
    // Create sample data
    const sampleData = [
      ['title', 'author', 'isbn', 'book_code', 'copies', 'category', 'publisher', 'publication_year', 'description', 'genre', 'shelf_location'],
      ['Introduction to Computer Science', 'John Smith', '978-0123456789', 'CS001', '3', 'Computer Science', 'Tech Publishers', '2023', 'A comprehensive guide to computer science fundamentals', 'Educational', 'A1-001'],
      ['Advanced Mathematics', 'Jane Doe', '978-0987654321', 'MATH001', '2', 'Mathematics', 'Academic Press', '2022', 'Advanced mathematical concepts and applications', 'Mathematics', 'B2-015'],
      ['History of Science', 'Robert Brown', '978-0456789123', 'HIST001', '1', 'History', 'History Books Inc', '2021', 'Exploring the evolution of scientific thought', 'History', 'C3-022'],
      ['Programming Fundamentals', 'Alice Johnson', '978-0789123456', 'PROG001', '5', 'Computer Science', 'Code Publishers', '2023', 'Learn programming from the ground up', 'Technology', 'A1-002'],
      ['Physics Principles', 'Dr. Wilson', '978-0321654987', 'PHYS001', '2', 'Science', 'Science Press', '2022', 'Core principles of physics explained', 'Science', 'D4-008']
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    
    // Style the header row
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:J1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      worksheet[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'E3F2FD' } }
      };
    }

    // Set column widths
    worksheet['!cols'] = [
      { wch: 30 }, // title
      { wch: 20 }, // author
      { wch: 15 }, // isbn
      { wch: 12 }, // book_code
      { wch: 8 },  // copies
      { wch: 15 }, // category
      { wch: 20 }, // publisher
      { wch: 12 }, // year
      { wch: 40 }, // description
      { wch: 15 }, // genre
      { wch: 15 }  // shelf_location
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Books');
    
    // Save file
    XLSX.writeFile(workbook, 'book_bulk_entry_template.xlsx');
  };

  // Function to parse book data for editing
  const parseBooksForEditing = (data: string) => {
    const lines = data.trim().split('\n');
    const books = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 6) {
        const [title, author, isbn, book_code, copies, category, publisher = '', year = '', description = '', genre = '', shelf_location = ''] = parts;
        
        books.push({
          lineNumber: i + 1,
          title,
          author,
          isbn,
          book_code,
          copies,
          category,
          publisher,
          year,
          description,
          genre,
          shelf_location,
          originalLine: line
        });
      }
    }
    
    return books;
  };

  // Function to update book data after editing
  const updateBookDataFromEdits = () => {
    const updatedLines = booksToEdit.map(book => 
      `${book.title},${book.author},${book.isbn},${book.book_code},${book.copies},${book.category},${book.publisher},${book.year},${book.description},${book.genre},${book.shelf_location}`
    );
    
    setBookData(updatedLines.join('\n'));
    setShowEditBooksDialog(false);
    
    toast({
      title: 'Success',
      description: 'Book data updated successfully',
    });
  };

  // Function to update a specific book's category
  const updateBookCategory = (bookIndex: number, newCategory: string) => {
    setBooksToEdit(prev => 
      prev.map((book, index) => 
        index === bookIndex ? { ...book, category: newCategory } : book
      )
    );
  };

  // Function to validate data and detect missing categories
  const validateAndDetectMissingCategories = (data: string) => {
    console.log('=== VALIDATING CATEGORIES ===');
    console.log('Categories available:', categories);
    console.log('CategoryMap:', Array.from(categoryMap.entries()));
    console.log('Data to validate:', data);
    
    const lines = data.trim().split('\n');
    const missingCats = new Set<string>();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 6) continue;

      const [, , , , , category] = parts;
      if (!category) continue;

      console.log(`Line ${i + 1}: Checking category "${category}"`);
      
      // Check if category exists
      const categoryId = categoryMap.get(category.toLowerCase());
      console.log(`Category "${category}" -> ID: ${categoryId}`);
      
      if (!categoryId) {
        console.log(`Missing category detected: "${category}"`);
        missingCats.add(category);
      }
    }

    console.log('All missing categories:', Array.from(missingCats));
    console.log('=== END VALIDATION ===');
    return Array.from(missingCats);
  };

  // Function to create missing categories
  const handleCreateMissingCategories = async () => {
    setIsCreatingCategories(true);
    try {
      for (const categoryName of missingCategories) {
        await createCategory.mutateAsync({
          name: categoryName,
          description: `Auto-created during bulk book import`
        });
      }
      
      // Refetch categories to update the local data
      await refetchCategories();
      
      toast({
        title: 'Success',
        description: `Created ${missingCategories.length} new categories successfully!`,
      });
      
      setShowMissingCategoriesDialog(false);
      setMissingCategories([]);
      
      // Show upload confirmation dialog instead of auto-uploading
      setShowUploadConfirmDialog(true);
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to create categories: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingCategories(false);
    }
  };

  // Function to handle upload confirmation after creating categories
  const handleUploadConfirmation = () => {
    setShowUploadConfirmDialog(false);
    handleBulkUpload();
  };

  const handleBulkUpload = async () => {
    if (!bookData.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter book data',
        variant: 'destructive',
      });
      return;
    }

    // First, check for missing categories
    const missing = validateAndDetectMissingCategories(bookData);
    if (missing.length > 0) {
      setMissingCategories(missing);
      setShowMissingCategoriesDialog(true);
      return;
    }

    setIsProcessing(true);
    setResults(null);

    const lines = bookData.trim().split('\n');
    const errors: string[] = [];
    const duplicates: string[] = [];
    let successCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      try {
        // Expected format: "title,author,isbn,book_code,copies,category,publisher,year,description,genre,shelf_location"
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length < 6) {
          errors.push(`Line ${i + 1}: Invalid format. Expected at least: title,author,isbn,book_code,copies,category`);
          continue;
        }

        const [title, author, isbn, book_code, copies, category, publisher = '', year = '', description = '', genre = '', shelf_location = ''] = parts;

        if (!title || !author || !book_code || !category) {
          errors.push(`Line ${i + 1}: Missing required fields (title, author, book_code, category)`);
          continue;
        }

        // Parse and validate copies count
        const copiesNum = parseInt(copies);
        if (!copies || isNaN(copiesNum) || copiesNum < 1) {
          errors.push(`Line ${i + 1}: Invalid or missing copy count. Must be a valid number >= 1`);
          continue;
        }

        // Validate category exists (should not happen now due to pre-check)
        const categoryId = categoryMap.get(category.toLowerCase());
        if (!categoryId) {
          errors.push(`Line ${i + 1}: Category "${category}" not found. Please check the category name or create it first.`);
          continue;
        }

        // Check for duplicates
        if (book_code && existingBookCodes.has(book_code.toLowerCase())) {
          duplicates.push(`Line ${i + 1}: Book with code "${book_code}" already exists`);
          continue;
        }

        if (isbn && existingISBNs.has(isbn.toLowerCase())) {
          duplicates.push(`Line ${i + 1}: Book with ISBN "${isbn}" already exists`);
          continue;
        }

        // Parse copies and year
        const totalCopies = copiesNum;
        const publicationYear = year ? parseInt(year) : undefined;

        await createBook.mutateAsync({
          title,
          author,
          isbn: isbn || undefined,
          book_code,
          total_copies: totalCopies,
          available_copies: totalCopies,
          category_id: categoryId,
          publisher: publisher || undefined,
          publication_year: publicationYear,
          description: description || undefined,
          genre: genre || undefined,
          shelf_location: shelf_location || undefined,
          condition: 'good'
        });

        // Add to existing sets to prevent duplicates within this batch
        if (book_code) existingBookCodes.add(book_code.toLowerCase());
        if (isbn) existingISBNs.add(isbn.toLowerCase());
        successCount++;
      } catch (error: any) {
        errors.push(`Line ${i + 1}: ${error.message}`);
      }
    }

    setResults({ success: successCount, errors, duplicates });
    setIsProcessing(false);

    if (successCount > 0) {
      toast({
        title: 'Bulk Upload Complete',
        description: `Successfully added ${successCount} books`,
      });
    }
  };

  const downloadTemplate = () => {
    const availableCategories = categories?.map(cat => cat.name).join(', ') || 'No categories available';
    
    const template = `# Bulk Book Entry Template
# Format: title,author,isbn,book_code,copies,category,publisher,year,description,genre,shelf_location
# Required fields: title, author, book_code, copies, category
# Optional fields: isbn, publisher, year, description, genre, shelf_location
# Note: Category must match an existing category name (case-insensitive)
# Available categories: ${availableCategories}
# Example:
Introduction to Computer Science,John Smith,978-0123456789,CS001,3,Computer Science,Tech Publishers,2023,A comprehensive guide,Educational,A1-001
Advanced Mathematics,Jane Doe,978-0987654321,MATH001,2,Mathematics,Academic Press,2022,Advanced mathematical concepts,Mathematics,B2-015
History of Science,Robert Brown,,HIST001,1,History,History Books Inc,2021,Exploring scientific evolution,History,C3-022`;

    const blob = new Blob([template], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'book_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600">Import multiple books at once with per-book category assignment and duplicate detection</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            CSV Template
          </Button>
          <Button onClick={downloadExcelTemplate} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel Template
          </Button>
        </div>
      </div>

      {/* Available Categories Display */}
      {categories && categories.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 mb-2">Available Categories:</h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <span
                      key={category.id}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-medium"
                    >
                      {category.name}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-blue-700 mt-2">
                  Each book must specify one of these categories in the input data (case-insensitive).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Book Data Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Input Method Selection */}
            <div>
              <Label>Input Method</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={inputMethod === 'text' ? 'default' : 'outline'}
                  onClick={() => setInputMethod('text')}
                  className="flex-1"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Text Input
                </Button>
                <Button
                  type="button"
                  variant={inputMethod === 'file' ? 'default' : 'outline'}
                  onClick={() => setInputMethod('file')}
                  className="flex-1"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel Upload
                </Button>
              </div>
            </div>

            {/* File Upload Section */}
            {inputMethod === 'file' && (
              <div>
                <Label htmlFor="file-upload">Upload Excel File</Label>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Excel File
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    Supports .xlsx, .xls, and .csv files. First row can be headers.
                  </p>
                </div>
              </div>
            )}

            {/* Text Input Section */}
            {inputMethod === 'text' && (
              <div>
                <Label htmlFor="book-data">Book Data</Label>
                <Textarea
                  id="book-data"
                  placeholder="Enter book data in CSV format:&#10;title,author,isbn,book_code,copies,category,publisher,year,description,genre,shelf_location&#10;&#10;Example:&#10;Introduction to Computer Science,John Smith,978-0123456789,CS001,3,Computer Science,Tech Publishers,2023,A comprehensive guide,Educational,A1-001"
                  value={bookData}
                  onChange={(e) => setBookData(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Required: title,author,book_code,copies,category | Optional: isbn,publisher,year,description,genre,shelf_location
                </p>
              </div>
            )}

            {/* Data Preview for File Upload */}
            {inputMethod === 'file' && bookData && (
              <div>
                <Label>Data Preview</Label>
                <Textarea
                  value={bookData}
                  onChange={(e) => setBookData(e.target.value)}
                  rows={6}
                  className="font-mono text-sm mt-2"
                  placeholder="Uploaded data will appear here..."
                />
                <p className="text-sm text-gray-500 mt-2">
                  You can edit the data above before processing.
                </p>
              </div>
            )}

            <Button 
              onClick={handleBulkUpload}
              disabled={isProcessing || !bookData.trim()}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Upload Books
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions & Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Input Options:</h4>
              <div className="space-y-3">                  <div>
                    <h5 className="font-medium text-blue-800">Text Input Format:</h5>
                    <ul className="text-sm text-blue-800 space-y-1 ml-2">
                      <li>• One book per line</li>
                      <li>• Required: title,author,book_code,copies,category</li>
                      <li>• Optional: isbn,publisher,year,description,genre,shelf_location</li>
                      <li>• Lines starting with # are ignored (comments)</li>
                      <li>• Category must match an existing category name (case-insensitive)</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-blue-800">Excel File Format:</h5>
                    <ul className="text-sm text-blue-800 space-y-1 ml-2">
                      <li>• Columns: title | author | isbn | book_code | copies | category | publisher | year | description | genre | shelf_location</li>
                      <li>• Headers optional (automatically detected)</li>
                      <li>• Supports .xlsx, .xls, and .csv files</li>
                      <li>• Empty rows are automatically skipped</li>
                      <li>• Category must match an existing category name</li>
                    </ul>
                  </div>
                <div className="text-sm text-blue-800">
                  <strong>Note:</strong> Duplicate book codes and ISBNs are automatically detected and skipped. Books with invalid or missing categories will be skipped.
                </div>
              </div>
            </div>

            {results && (
              <div className="space-y-3">
                {results.success > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">
                        Successfully added {results.success} books with copies
                      </span>
                    </div>
                  </div>
                )}

                {results.duplicates.length > 0 && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800 mb-2">
                      <Info className="w-5 h-5" />
                      <span className="font-medium">
                        {results.duplicates.length} duplicates skipped:
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {results.duplicates.map((duplicate, index) => (
                        <div key={index} className="text-sm text-yellow-700">
                          {duplicate}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.errors.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800 mb-2">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">
                        {results.errors.length} errors occurred:
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {results.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-700">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Tips:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Download Excel or CSV template for the correct format</li>
                <li>• Test with a small batch first</li>
                <li>• Book codes and ISBNs must be unique across the system</li>
                <li>• Each book must specify a valid category that exists in the system</li>
                <li>• Copy count must be specified for each book in the input data</li>
                <li>• You can edit uploaded data before processing</li>
                <li>• Both Excel files and text input support the same format</li>
                <li>• Empty fields are automatically handled gracefully</li>
                <li>• Category names are case-insensitive but must match exactly</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Missing Categories Dialog */}
      <Dialog open={showMissingCategoriesDialog} onOpenChange={setShowMissingCategoriesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Missing Categories Detected
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>
                The following categories don't exist in your system yet:
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="space-y-1">
                  {missingCategories.map((category, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-600 rounded-full" />
                      <span className="font-medium text-amber-800">{category}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Would you like to create these categories automatically, or go back to edit your book data?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const books = parseBooksForEditing(bookData);
                setBooksToEdit(books);
                setShowMissingCategoriesDialog(false);
                setShowEditBooksDialog(true);
              }}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Book Data
            </Button>
            <Button
              onClick={handleCreateMissingCategories}
              disabled={isCreatingCategories}
              className="flex items-center gap-2"
            >
              {isCreatingCategories ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Missing Categories
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Books Dialog */}
      <Dialog open={showEditBooksDialog} onOpenChange={setShowEditBooksDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit Book Categories
            </DialogTitle>
            <DialogDescription>
              Update the categories for your books using the dropdown menus below. 
              Select from existing categories in your database.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {booksToEdit.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="min-w-[200px]">Title</TableHead>
                      <TableHead className="min-w-[150px]">Author</TableHead>
                      <TableHead className="w-24">Copies</TableHead>
                      <TableHead className="min-w-[180px]">Category</TableHead>
                      <TableHead className="min-w-[120px]">Publisher</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {booksToEdit.map((book, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-sm text-gray-500">
                          {book.lineNumber}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="max-w-[200px] truncate" title={book.title}>
                            {book.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[150px] truncate" title={book.author}>
                            {book.author}
                          </div>
                        </TableCell>
                        <TableCell>{book.copies}</TableCell>
                        <TableCell>
                          <Select
                            value={book.category}
                            onValueChange={(value) => updateBookCategory(index, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.name}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[120px] truncate" title={book.publisher}>
                            {book.publisher || 'N/A'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {booksToEdit.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No books to edit
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditBooksDialog(false)}
              className="flex items-center gap-2"
            >
              Cancel
            </Button>
            <Button
              onClick={updateBookDataFromEdits}
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Confirmation Dialog */}
      <Dialog open={showUploadConfirmDialog} onOpenChange={setShowUploadConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Categories Created Successfully!
            </DialogTitle>
            <DialogDescription className="text-center py-4">
              All missing categories have been created successfully. 
              Would you like to upload your books now?
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-center py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">
                  Ready to Upload Books
                </p>
                <p className="text-xs text-green-600">
                  All categories are now available
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUploadConfirmDialog(false)}
              className="flex items-center gap-2"
            >
              Not Now
            </Button>
            <Button
              onClick={handleUploadConfirmation}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-4 h-4" />
              Upload Books Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
