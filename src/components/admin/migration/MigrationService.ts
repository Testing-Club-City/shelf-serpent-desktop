import { supabase } from '../../../integrations/supabase/client';

/**
 * Migration service for handling the migration of data from SQLite to Supabase
 */
export class MigrationService {
  // Keep track of imported records for mapping between old and new systems
  private static importedRecords: Record<string, Record<string, string>> = {
    books: {},
    students: {},
    categories: {}
  };
  
  // Track failed mappings for reporting
  public static failedMappings: Record<string, any[]> = {
    books: [],
    students: [],
    borrowings: [],
    fines: []
  };
  
  // Debug flag to log operations
  private static DEBUG = true;

  /**
   * Initialize the SQLite database from a File object
   */
  static async initSQLiteDB(file: File): Promise<any> {
    console.log('Initializing SQLite database from file:', file.name);
    
    // The actual initialization will be handled by the SQLite worker
    return { file };
  }
  
  /**
   * Get tables from the SQLite database
   */
  static async getTables(db: any): Promise<string[]> {
    try {
      // For SQL.js databases, we need to use exec to get table names
      const result = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      
      if (result && result[0] && result[0].values) {
        const tables = result[0].values.map((row: any) => row[0]);
        console.log('🔍 DEBUG: MigrationService.getTables found tables:', tables);
        return tables;
      }
      
      console.log('🔍 DEBUG: MigrationService.getTables found no tables');
      return [];
    } catch (error) {
      console.error('🔍 DEBUG: Error getting tables:', error);
      return [];
    }
  }
  
  /**
   * Get record count for a table
   */
  static async getTableCount(db: any, table: string): Promise<number> {
    try {
      const result = db.exec(`SELECT COUNT(*) as count FROM ${table}`);
      if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0] as number;
      }
      return 0;
    } catch (error) {
      console.error(`Error getting count for table ${table}:`, error);
      return 0;
    }
  }

  /**
   * Test Supabase connection to verify we can insert data
   */
  /**
   * Try to convert a legacy numeric BookID to the new book UUID.
   * 1. Check in-memory map (fast).
   * 2. Query book_copies.legacy_book_id column (added manually after import).
   *    When found, cache it for the rest of the run.
   */
  static async resolveBookId(oldBookId: string): Promise<string | null> {
    if (!oldBookId) return null;
    const cached = this.importedRecords.books[oldBookId];
    if (cached) return cached;

    const { data, error } = await supabase
      .from('book_copies')
      .select('book_id')
      .eq('legacy_book_id', Number(oldBookId))
      .limit(1);

    if (error) {
      console.error('resolveBookId: query error', error);
      return null;
    }
    if (data && data.length > 0) {
      const uuid = data[0].book_id as string;
      this.importedRecords.books[oldBookId] = uuid; // cache
      return uuid;
    }
    return null;
  }

  static async testSupabaseConnection(): Promise<boolean> {
    try {
      console.log('Testing Supabase connection...');
      
      // First test reading from a table
      const { data: readData, error: readError } = await supabase.from('categories').select('id').limit(1);
      
      if (readError) {
        console.error('Supabase read test failed:', readError);
        return false;
      }
      
      // Now test write permissions by inserting a test category
      const testCategoryName = `Test Category ${new Date().toISOString()}`;
      
      const { data: writeData, error: writeError } = await supabase
        .from('categories')
        .insert({
          name: testCategoryName,
          description: 'Test category to verify connection - can be deleted'
        })
        .select('id');
      
      if (writeError) {
        console.error('Supabase write test failed:', writeError);
        // Still return true if we can read but not write - the user might have read-only access
        console.log('Read access confirmed, but write access failed. Migration may have limited functionality.');
        return true;
      }
      
      console.log('Supabase connection fully functional with read/write access:', writeData);
      
      // Clean up the test category
      if (writeData && writeData.length > 0) {
        await supabase.from('categories').delete().eq('id', writeData[0].id);
      }
      
      return true;
    } catch (error) {
      console.error('Error testing Supabase connection:', error);
      return false;
    }
  }
  
  /**
   * Import categories from SQLite to Supabase
   */
  static async importCategories(db: any, batchSize: number, onProgress: (progress: number, total: number) => void): Promise<number> {
    console.log('===== STARTING CATEGORY IMPORT =====');
    
    // First test the Supabase connection
    const connectionOk = await this.testSupabaseConnection();
    if (!connectionOk) {
      console.error('❌ CRITICAL ERROR: Cannot connect to Supabase database');
      throw new Error('Cannot connect to Supabase database. Please check your connection settings.');
    } else {
      console.log('✅ Supabase connection successful');
    }
    
    // Get the table name from the database
    const tables = await this.getTables(db);
    const categoryTable = tables.find((t: string) => t.toLowerCase().includes('categor')) || 'Categories';
    
    console.log(`Using table "${categoryTable}" for categories`);
    
    // Get sample record to examine columns
    const sampleResult = await db.exec(`SELECT * FROM ${categoryTable} LIMIT 1`);
    if (!sampleResult.rows || sampleResult.rows.length === 0) {
      console.log('No category records found in the database');
      return 0;
    }
    
    console.log('Found category records to import');
    console.log('Sample record:', JSON.stringify(sampleResult.rows[0], null, 2));
    
    // Log the column names for debugging
    const sampleRecord = sampleResult.rows[0];
    console.log('Category table columns:', Object.keys(sampleRecord));
    console.log('Sample category record:', sampleRecord);
    
    // Enhanced column detection - case insensitive and more flexible
    // Get all column names in lowercase for easier comparison
    const columnNamesLower = Object.keys(sampleRecord).map(col => col.toLowerCase());
    
    // Determine column names with improved detection
    const nameColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('name') || 
      k.toLowerCase().includes('category') || 
      k.toLowerCase() === 'cat'
    ) || 'Category'; // Default to 'Category' which is the column name in Kisii School DB
    
    const idColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase() === 'id' || 
      k.toLowerCase().includes('categoryid') || 
      k.toLowerCase().includes('cat_id')
    ) || 'ID'; // Default to 'ID' which is the column name in Kisii School DB
    
    const locationColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('shelf') || 
      k.toLowerCase().includes('location')
    ) || 'Shelf'; // Default to 'Shelf' which is the column name in Kisii School DB
    
    console.log(`Using columns: ID=${idColumn}, Name=${nameColumn}, Location=${locationColumn}`);
    
    const total = await this.getTableCount(db, categoryTable);
    let imported = 0;
    
    // Process records in batches
    for (let offset = 0; offset < total; offset += batchSize) {
      // Get a batch of records
      const result = await db.exec(`SELECT * FROM ${categoryTable} LIMIT ${batchSize} OFFSET ${offset}`);
      const records = result.rows || [];
      
      console.log(`Processing ${records.length} category records from offset ${offset}`);
      
      // Process each record
      for (const record of records) {
        try {
          const categoryName = record[nameColumn] || 'Unknown Category';
          const categoryId = record[idColumn] || offset;
          const shelfLocation = record[locationColumn] || '';
          
          // Create the category in Supabase
          if (this.DEBUG) console.log('Inserting category:', categoryName);
          
          // Enhanced error debugging
          try {
            // First check if the category already exists
            const { data: existingCategory } = await supabase
              .from('categories')
              .select('id')
              .eq('name', categoryName)
              .maybeSingle();
            
            // If category exists, use it
            if (existingCategory) {
              console.log(`Found existing category with name ${categoryName}, id: ${existingCategory.id}`);
              this.importedRecords.categories[String(categoryId)] = existingCategory.id;
              imported++;
              continue;
            }
            
            // If it doesn't exist, create it with direct insert
            console.log(`Creating new category: ${categoryName}`);
            
            // Use the simplest possible insert with just the name
            // because we discovered the 'shelf_location' column doesn't exist
            const { data: categoryData, error: insertError } = await supabase
              .from('categories')
              .insert([{ 
                name: categoryName,
                // Only add description if it's available in the source data
                ...(categoryId ? { description: `Imported from old system - Category ID: ${categoryId}` } : {})
              }])
              .select('id');
              
            if (insertError) {
              console.error('Error inserting category:', insertError);
              continue;
            }
            
            if (categoryData && categoryData.length > 0) {
              console.log(`Successfully created category ${categoryName} with id ${categoryData[0].id}`);
              this.importedRecords.categories[String(categoryId)] = categoryData[0].id;
              imported++;
            } else {
              console.error('No category data returned after insert');
            }
            // This block is now handled in the try block above where categoryData is defined
          } catch (insertError) {
            console.error('Exception during category insert:', insertError);
            console.error('Failed category data:', { 
              name: categoryName, 
              shelf_location: shelfLocation 
            });
          }
        } catch (error) {
          console.error('Error processing category:', error);
        }
      }
      
      // Report progress
      onProgress(Math.min(offset + records.length, total), total);
      console.log(`Progress: ${Math.min(offset + records.length, total)}/${total}`);
    }
    
    console.log(`===== COMPLETED CATEGORY IMPORT: ${imported} categories imported =====`);
    
    // Force refresh the categories map
    try {
      const { data: refreshedCategories } = await supabase.from('categories').select('id, name');
      console.log(`Verified ${refreshedCategories?.length || 0} categories now exist in database`);
      
      if (refreshedCategories && refreshedCategories.length > 0) {
        console.log('Sample categories in database:');
        refreshedCategories.slice(0, 5).forEach(cat => {
          console.log(`  - ${cat.name} (${cat.id})`);
        });
      }
    } catch (err) {
      console.error('Error verifying categories:', err);
    }
    
    return imported;
  }
  
  /**
   * Import books from SQLite to Supabase
   */
  static async importBooks(
    db: any, 
    batchSize: number, 
    generateNewTrackingCodes: boolean,
    storeOldBookIdsAsMetadata: boolean,
    onProgress: (progress: number, total: number) => void
  ): Promise<number> {
    console.log('===== STARTING BOOK IMPORT =====');
    
    // Get the table name from the database
    const tables = await this.getTables(db);
    const bookTable = tables.find((t: string) => 
      t.toLowerCase().includes('book') && 
      !t.toLowerCase().includes('submit') &&
      !t.toLowerCase().includes('borrow')
    ) || 'BookDetails';
    
    console.log(`Using table "${bookTable}" for books`);
    
    // Log category mapping for reference
    console.log(`Category mapping available: ${Object.keys(this.importedRecords.categories).length} categories`);
    
    // Get sample record to examine columns
    const sampleResult = await db.exec(`SELECT * FROM ${bookTable} LIMIT 1`);
    if (!sampleResult.rows || sampleResult.rows.length === 0) {
      console.log('No book records found in the database');
      return 0;
    }
    
    // Log the column names for debugging
    const sampleRecord = sampleResult.rows[0];
    console.log('Book table columns:', Object.keys(sampleRecord));
    console.log('Sample book record:', sampleRecord);
    
    // Determine column names based on the actual schema
    const titleColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('title')
    ) || 'Title';
    
    const authorColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('author')
    ) || 'Author';
    
    const idColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase() === 'id' || 
      k.toLowerCase().includes('bookid') || 
      k.toLowerCase().includes('book_id')
    ) || 'BookID';
    
    const isbnColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('isbn')
    ) || 'ISBN';
    
    const publisherColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('publisher')
    ) || 'Publisher';
    
    const yearColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('year') ||
      k.toLowerCase().includes('publication')
    ) || 'Year';
    
    const categoryColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('category') ||
      k.toLowerCase().includes('cat_id') ||
      k.toLowerCase().includes('categoryid')
    ) || 'Category';
    
    const descriptionColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('desc')
    ) || 'Description';
    
    const pagesColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('page')
    ) || 'Pages';
    
    const bookCodeColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('code') ||
      k.toLowerCase().includes('no')
    ) || 'BookNo';
    
    const availableColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('avail') ||
      k.toLowerCase().includes('status')
    ) || 'Available';
    
    console.log(`Using columns for books: 
      ID=${idColumn}, 
      Title=${titleColumn}, 
      Author=${authorColumn},
      ISBN=${isbnColumn},
      Publisher=${publisherColumn},
      Year=${yearColumn},
      Category=${categoryColumn},
      Available=${availableColumn}
    `);
    
    const total = await this.getTableCount(db, bookTable);
    let imported = 0;
    
    // Process records in batches
    for (let offset = 0; offset < total; offset += batchSize) {
      // Get a batch of records
      const result = await db.exec(`SELECT * FROM ${bookTable} LIMIT ${batchSize} OFFSET ${offset}`);
      const records = result.rows || [];
      
      console.log(`Processing batch of ${records.length} books (${offset}-${offset + records.length} of ${total})`);
      
      // Process each record
      for (const record of records) {
        try {
          const bookId = record[idColumn];
          const title = record[titleColumn] || 'Untitled Book';
          const author = record[authorColumn] || 'Unknown Author';
          const isbn = record[isbnColumn] || null;
          const publisher = record[publisherColumn] || null;
          const year = record[yearColumn] || null;
          const category = record[categoryColumn] || null;
          const description = record[descriptionColumn] || '';
          const pages = record[pagesColumn] || null;
          const bookCode = record[bookCodeColumn] || bookId;
          const available = record[availableColumn] || 'Yes';
          
          // Handle empty ISBN - set to null if empty string
          const cleanIsbn = isbn && isbn.trim() ? isbn.trim() : null;
          
          if (this.DEBUG) console.log(`Inserting book: "${title}" by ${author}`);
          
          // First check if book with similar title + author already exists
          const { data: existingBooks, error: existingError } = await supabase
            .from('books')
            .select('id')
            .eq('title', title)
            .eq('author', author);
          
          if (existingError) {
            console.error('Error checking for existing books:', existingError);
          }
          
          // If book already exists, use it
          if (existingBooks && existingBooks.length > 0) {
            console.log(`Book "${title}" by ${author} already exists, using existing ID: ${existingBooks[0].id}`);
            this.importedRecords.books[bookId.toString()] = existingBooks[0].id;
            imported++;
            continue;
          }
          
          // Find category ID if available - improved logic
          let categoryId = null;
          if (category) {
            console.log(`Looking up category: "${category}" (type: ${typeof category})`);
            
            // First check if we have an imported category ID mapping
            if (this.importedRecords.categories[category.toString()]) {
              categoryId = this.importedRecords.categories[category.toString()];
              console.log(`Using mapped category ID: ${categoryId} for category reference: ${category}`);
            } else {
              // Try to find category by name (in case it's a name rather than an ID)
              const { data: foundCategoryByName, error: nameError } = await supabase
                .from('categories')
                .select('id')
                .eq('name', category.toString())
                .maybeSingle();
              
              if (nameError) {
                console.error('Error searching category by name:', nameError);
              }
              
              if (foundCategoryByName) {
                categoryId = foundCategoryByName.id;
                this.importedRecords.categories[category.toString()] = foundCategoryByName.id;
                console.log(`Found category by name: ${category}, ID: ${categoryId}`);
              } else {
                // Try to find category by ID directly (if it's a number)
                if (!isNaN(Number(category))) {
                  const { data: foundCategoryById, error: idError } = await supabase
                    .from('categories')
                    .select('id')
                    .eq('id', category)
                    .maybeSingle();
                  
                  if (idError) {
                    console.error('Error searching category by ID:', idError);
                  }
                  
                  if (foundCategoryById) {
                    categoryId = foundCategoryById.id;
                    this.importedRecords.categories[category.toString()] = foundCategoryById.id;
                    console.log(`Found category by ID: ${category}`);
                  }
                }
                
                if (!categoryId) {
                  console.log(`Could not find category for: "${category}", will create book without category`);
                }
              }
            }
          }
          
          console.log(`Creating book "${title}" with category ID: ${categoryId || 'none'}`);
          
          // Generate a unique book_code
          const uniqueBookCode = `OLD-${bookCode}-${Date.now().toString().substr(-4)}`;
          
          // Create the book in Supabase - matching schema columns exactly
          // Remove language, pages, and price fields as they don't exist in the new schema
          const bookData = {
            title: title,
            author: author,
            isbn: cleanIsbn,
            publisher: publisher,
            publication_year: year ? Number(year) : null,
            category_id: categoryId,
            description: description,
            book_code: uniqueBookCode
          };
          
          // Validate required fields
          if (!title || !author) {
            console.error(`Skipping book with missing required fields - Title: "${title}", Author: "${author}"`);
            continue;
          }
          
          console.log(`Inserting book with data:`, JSON.stringify(bookData, null, 2));
          
          const { data: book, error: bookError } = await supabase
            .from('books')
            .insert(bookData)
            .select('id, title, author, book_code')
            .single();
          
          if (bookError) {
            console.error('Error inserting book:', bookError);
            console.error('Failed book data:', bookData);
            console.error('Original record:', record);
            // Log specific error details to help debugging
            if (bookError.message) {
              console.error('Error message:', bookError.message);
            }
            if (bookError.details) {
              console.error('Error details:', bookError.details);
            }
            if (bookError.hint) {
              console.error('Error hint:', bookError.hint);
            }
            continue;
          }
          
          // Create a book copy
          if (book) {
            // Generate a truly unique tracking code
            const timestamp = Date.now().toString().substr(-6);
            const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const trackingCode = generateNewTrackingCodes 
              ? `BOOK-${randomPart}-${timestamp}`
              : `OLD-${bookId}-${timestamp}`;
              
            if (this.DEBUG) console.log(`Inserting book copy for book ${book.title} (${book.id})`);
            
            // Check if there are existing copies for this book
            const { data: existingCopies, error: copiesCheckError } = await supabase
              .from('book_copies')
              .select('copy_number')
              .eq('book_id', book.id)
              .order('copy_number', { ascending: false })
              .limit(1);
              
            let copyNumber = 1;
            if (!copiesCheckError && existingCopies && existingCopies.length > 0) {
              copyNumber = existingCopies[0].copy_number + 1;
            }
            
            // Create book copy with schema-valid fields
            const bookCopyData = {
              book_id: book.id,
              book_code: book.book_code, // Use the book_code from the book
              copy_number: copyNumber,
              tracking_code: trackingCode,
              condition: 'good',
              notes: storeOldBookIdsAsMetadata 
                ? `Imported from old system - Book ID: ${bookId}`
                : null,
              // Determine status more robustly
              status: (() => {
                const val = (available ?? '').toString().trim().toLowerCase();
                // Treat common "available" indicators as available
                if (['yes', 'y', 'available', 'avail', 'true', '1'].some(k => val === k || val.includes(k))) {
                  return 'available';
                }
                return 'borrowed';
              })()
            };
            
            console.log(`Inserting book copy with data:`, JSON.stringify(bookCopyData, null, 2));
            
            const { data: bookCopy, error: copyError } = await supabase
              .from('book_copies')
              .insert(bookCopyData)
              .select('id, tracking_code, status')
              .single();
              
            if (copyError) {
              console.error('Error inserting book copy:', copyError);
              console.error('Failed book copy data:', bookCopyData);
              // Log specific error details to help debugging
              if (copyError.message) {
                console.error('Copy error message:', copyError.message);
              }
              if (copyError.details) {
                console.error('Copy error details:', copyError.details);
              }
              if (copyError.hint) {
                console.error('Copy error hint:', copyError.hint);
              }
            } else {
              console.log(`Successfully created book copy with tracking code: ${bookCopy?.tracking_code}`);
            }
            
            // Store the mapping between old and new IDs
            this.importedRecords.books[bookId.toString()] = book.id;
            if (this.DEBUG) console.log(`Mapped book ${bookId} to ${book.id}`);
          } else {
            console.error('No book data returned after insert');
          }
          
          imported++;
        } catch (error) {
          console.error('Error processing book:', error);
          console.error('Record data:', record);
        }
      }
      
      // Report progress
      onProgress(Math.min(offset + records.length, total), total);
    }
    
    console.log(`===== COMPLETED BOOK IMPORT: ${imported}/${total} books imported =====`);
    
    return imported;
  }
  
  /**
   * Import students from SQLite to Supabase
   */
  static async importStudents(
    db: any, 
    batchSize: number, 
    classAssignments: Record<string, string>,
    onProgress: (progress: number, total: number) => void
  ): Promise<number> {
    console.log('===== STARTING STUDENT IMPORT =====');
    
    // Get the table name from the database
    const tables = await this.getTables(db);
    const studentTable = tables.find((t: string) => 
      t.toLowerCase().includes('member') || 
      t.toLowerCase().includes('student')
    ) || 'MemberDetails';
    
    console.log(`Using table "${studentTable}" for students`);
    
    // Get sample record to examine columns
    const sampleResult = await db.exec(`SELECT * FROM ${studentTable} LIMIT 1`);
    if (!sampleResult.rows || sampleResult.rows.length === 0) {
      console.log('No student records found in the database');
      return 0;
    }
    
    // Log the column names for debugging
    const sampleRecord = sampleResult.rows[0];
    console.log('Student table columns:', Object.keys(sampleRecord));
    console.log('Sample student record:', sampleRecord);
    
    // Determine column names based on the actual schema
    const nameColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('name')
    ) || 'Name';
    
    const idColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase() === 'id' || 
      k.toLowerCase().includes('memberid') || 
      k.toLowerCase().includes('studentid')
    ) || 'MemberID';
    
    const admissionNumberColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('roll') ||
      k.toLowerCase().includes('admission') ||
      k.toLowerCase().includes('regno')
    ) || 'RollNo';
    
    const emailColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('email')
    ) || 'Email';
    
    const phoneColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('phone') ||
      k.toLowerCase().includes('mobile')
    ) || 'PhoneNumber';
    
    const dobColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('dob') ||
      k.toLowerCase().includes('date') && k.toLowerCase().includes('birth')
    ) || 'Dob';
    
    const addressColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('address')
    ) || 'Address';
    
    const admissionYearColumn = Object.keys(sampleRecord).find(k => 
      k.toLowerCase().includes('admission') && k.toLowerCase().includes('year')
    ) || 'AdmissionYear';
    
    console.log(`Using columns for students:
      ID=${idColumn},
      Name=${nameColumn},
      AdmissionNumber=${admissionNumberColumn},
      Email=${emailColumn},
      Phone=${phoneColumn},
      DoB=${dobColumn},
      Address=${addressColumn},
      AdmissionYear=${admissionYearColumn}
    `);
    
    const total = await this.getTableCount(db, studentTable);
    let imported = 0;
    
    // Process records in batches
    for (let offset = 0; offset < total; offset += batchSize) {
      // Get a batch of records
      const result = await db.exec(`SELECT * FROM ${studentTable} LIMIT ${batchSize} OFFSET ${offset}`);
      const records = result.rows || [];
      
      console.log(`Processing batch of ${records.length} students (${offset}-${offset + records.length} of ${total})`);
      
      // Process each record
      for (const record of records) {
        try {
          // Extract the student ID for reference
          const studentId = record[idColumn];
          
          // Determine the class grade based on admission year
          const admissionYear = record[admissionYearColumn]?.toString() || '';
          let classGrade = classAssignments['other'] || 'graduated';
          
          if (admissionYear === '2022') {
            classGrade = classAssignments['2022'] || 'Form 4, Section A';
          } else if (admissionYear === '2023') {
            classGrade = classAssignments['2023'] || 'Form 3, Section A';
          } else if (admissionYear === '2024') {
            classGrade = classAssignments['2024'] || 'Form 2, Section A';
          }
          
          // Parse the name into first and last name
          const fullName = record[nameColumn] || '';
          const nameParts = fullName.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          if (this.DEBUG) console.log(`Processing student: ${fullName} (ID: ${studentId})`);
          
          // First check if student already exists with the same admission number
          const admissionNumber = record[admissionNumberColumn] || `S${studentId}`;
          
          const { data: existingStudent, error: checkError } = await supabase
            .from('students')
            .select('id')
            .eq('admission_number', admissionNumber)
            .maybeSingle();
            
          if (checkError) {
            console.error('Error checking existing student:', checkError);
          }
          
          // If student already exists, use the existing ID
          if (existingStudent) {
            console.log(`Student with admission number ${admissionNumber} already exists, using ID: ${existingStudent.id}`);
            this.importedRecords.students[studentId.toString()] = existingStudent.id;
            imported++;
            continue;
          }
          
          // Prepare data based on the actual schema
          // Validate required fields
          if (!firstName && !lastName) {
            console.error(`Skipping student with missing name - Record:`, record);
            continue;
          }
          
          // Parse date of birth - handle DD/MM/YYYY format
          let dateOfBirth = record[dobColumn] || null;
          if (dateOfBirth && typeof dateOfBirth === 'string') {
            try {
              // Handle DD/MM/YYYY format common in old systems
              const dateParts = dateOfBirth.split('/');
              if (dateParts.length === 3) {
                const day = dateParts[0].padStart(2, '0');
                const month = dateParts[1].padStart(2, '0');
                const year = dateParts[2];
                dateOfBirth = `${year}-${month}-${day}`;
                
                // Validate the date
                const testDate = new Date(dateOfBirth);
                if (isNaN(testDate.getTime())) {
                  console.warn(`Invalid date format: ${record[dobColumn]}, setting to null`);
                  dateOfBirth = null;
                }
              } else {
                // Try parsing as-is
                const testDate = new Date(dateOfBirth);
                if (isNaN(testDate.getTime())) {
                  console.warn(`Invalid date format: ${dateOfBirth}, setting to null`);
                  dateOfBirth = null;
                } else {
                  dateOfBirth = testDate.toISOString().split('T')[0];
                }
              }
            } catch (e) {
              console.warn(`Error parsing date: ${record[dobColumn]}, setting to null`);
              dateOfBirth = null;
            }
          }
          
          const studentData = {
            admission_number: admissionNumber,
            first_name: firstName || 'Unknown',
            last_name: lastName || 'Student',
            email: record[emailColumn] || null,
            phone: record[phoneColumn] || null,
            date_of_birth: dateOfBirth,
            address: record[addressColumn] || null,
            class_grade: classGrade,
            status: classGrade === 'graduated' ? 'graduated' : 'active'
          };
          
          console.log(`Inserting student with data:`, JSON.stringify(studentData, null, 2));
          
          // Create the student in Supabase
          const { data: student, error } = await supabase
            .from('students')
            .insert(studentData)
            .select('id')
            .single();
          
          if (error) {
            console.error('Error inserting student:', error);
            console.error('Failed student data:', studentData);
            console.error('Original record:', record);
            // Log specific error details to help debugging
            if (error.message) {
              console.error('Error message:', error.message);
            }
            if (error.details) {
              console.error('Error details:', error.details);
            }
            continue;
          }
          
          // Store the mapping between old and new IDs
          if (student) {
            this.importedRecords.students[studentId.toString()] = student.id;
            if (this.DEBUG) console.log(`Mapped student ${studentId} to ${student.id}`);
          } else {
            console.error('No student data returned after insert');
          }
          
          imported++;
        } catch (error) {
          console.error('Error processing student:', error);
          console.error('Record data:', record);
        }
      }
      
      // Report progress
      onProgress(Math.min(offset + records.length, total), total);
    }
    
    console.log(`===== COMPLETED STUDENT IMPORT: ${imported}/${total} students imported =====`);
    
    return imported;
  }
  
  /**
   * Import borrowings from SQLite to Supabase
   */
  static async importBorrowings(
    db: any, 
    batchSize: number, 
    onlyActiveBorrowings: boolean,
    onProgress: (progress: number, total: number) => void
  ): Promise<number> {
    console.log('===== STARTING BORROWING IMPORT =====');
    
    // Check if we have book and student mappings
    // Check if we have book and student mappings from previous imports
    console.log('🔍 DEBUG: Checking existing mappings...');
    console.log('🔍 DEBUG: Book mappings count:', Object.keys(this.importedRecords.books).length);
    console.log('🔍 DEBUG: Student mappings count:', Object.keys(this.importedRecords.students).length);
    
    // If we don't have mappings, try to rebuild them from existing Supabase data
    if (Object.keys(this.importedRecords.books).length === 0 || Object.keys(this.importedRecords.students).length === 0) {
      console.log('🔄 Attempting to rebuild mappings from existing Supabase data...');
      await this.rebuildMappingsFromSupabase(supabase);
    }
    
    // Final check after attempting to rebuild
    if (Object.keys(this.importedRecords.books).length === 0) {
      console.error('❌ No book mappings found even after checking existing data.');
      console.log('💡 HINT: Make sure to run book migration first');
      
      // Let's check if there are books in Supabase that we can use
      const { data: existingBooks } = await supabase.from('books').select('id, title, notes').limit(5);
      console.log('🔍 DEBUG: Existing books in Supabase:', existingBooks?.length || 0);
      if (existingBooks && existingBooks.length > 0) {
        console.log('🔍 DEBUG: Sample books:', existingBooks);
      }
      
      return 0;
    }
    
    if (Object.keys(this.importedRecords.students).length === 0) {
      console.error('❌ No student mappings found even after checking existing data.');
      console.log('💡 HINT: Make sure to run student migration first');
      
      // Let's check if there are students in Supabase that we can use
      const { data: existingStudents } = await supabase.from('students').select('id, full_name, notes').limit(5);
      console.log('🔍 DEBUG: Existing students in Supabase:', existingStudents?.length || 0);
      if (existingStudents && existingStudents.length > 0) {
        console.log('🔍 DEBUG: Sample students:', existingStudents);
      }
      
      return 0;
    }
    
    // Get the table names from the database
    const tables = await this.getTables(db);
    console.log('🔍 DEBUG: Available tables:', tables);
    
    // Enhanced table detection for Kisii School.db
    // Look specifically for "IssueDetails" and "SubmittedBooks" which are the exact names in Kisii School.db
    const activeBorrowingTable = tables.find((t: string) => 
      t === 'IssueDetails' || // Exact match for Kisii School.db
      t.toLowerCase().includes('issue') || 
      t.toLowerCase().includes('active')
    ) || 'IssueDetails';
    
    const historicalBorrowingTable = tables.find((t: string) => 
      t === 'SubmittedBooks' || // Exact match for Kisii School.db
      t.toLowerCase().includes('submit') || 
      t.toLowerCase().includes('return')
    ) || 'SubmittedBooks';
    
    console.log('🔍 DEBUG: Active borrowing table selected:', activeBorrowingTable);
    console.log('🔍 DEBUG: Historical borrowing table selected:', historicalBorrowingTable);
    
    // Check if the selected tables actually exist
    if (!tables.includes(activeBorrowingTable) && !tables.includes(historicalBorrowingTable)) {
      console.error('❌ Neither active nor historical borrowing tables found in database');
      console.log('💡 HINT: Available tables are:', tables);
      return 0;
    }
    
    // Let's check what data exists in the tables
    if (tables.includes(activeBorrowingTable)) {
      try {
        const result = db.exec(`SELECT COUNT(*) FROM ${activeBorrowingTable}`);
        const count = result[0]?.values[0][0] || 0;
        console.log(`🔍 DEBUG: ${activeBorrowingTable} contains ${count} records`);
        
        if (count > 0) {
          const sample = db.exec(`SELECT * FROM ${activeBorrowingTable} LIMIT 3`);
          console.log(`🔍 DEBUG: Sample data from ${activeBorrowingTable}:`, sample[0]);
        }
      } catch (error) {
        console.error(`🔍 DEBUG: Error checking ${activeBorrowingTable}:`, error);
      }
    }
    
    if (tables.includes(historicalBorrowingTable)) {
      try {
        const result = db.exec(`SELECT COUNT(*) FROM ${historicalBorrowingTable}`);
        const count = result[0]?.values[0][0] || 0;
        console.log(`🔍 DEBUG: ${historicalBorrowingTable} contains ${count} records`);
        
        if (count > 0) {
          const sample = db.exec(`SELECT * FROM ${historicalBorrowingTable} LIMIT 3`);
          console.log(`🔍 DEBUG: Sample data from ${historicalBorrowingTable}:`, sample[0]);
        }
      } catch (error) {
        console.error(`🔍 DEBUG: Error checking ${historicalBorrowingTable}:`, error);
      }
    }
    
    console.log(`🔍 DEBUG: Using tables "${activeBorrowingTable}" for active borrowings and "${historicalBorrowingTable}" for historical borrowings`);
    
    // Calculate total records to process
    const activeCount = await this.getTableCount(db, activeBorrowingTable);
    const historicalCount = onlyActiveBorrowings ? 0 : await this.getTableCount(db, historicalBorrowingTable);
    const total = activeCount + historicalCount;
    
    console.log(`🔍 DEBUG: Found ${activeCount} active borrowings and ${historicalCount} historical borrowings`);
    
    let imported = 0;
    
    // Import active borrowings
    if (activeCount > 0) {
      // Get sample record to examine columns
      const sampleResult = await db.exec(`SELECT * FROM ${activeBorrowingTable} LIMIT 1`);
      if (sampleResult.rows && sampleResult.rows.length > 0) {
        // Log the column names for debugging
        const sampleRecord = sampleResult.rows[0];
        console.log('Active borrowing table columns:', Object.keys(sampleRecord));
        console.log('Sample borrowing record:', sampleRecord);
        
        // Specific column mapping for Kisii School.db - IssueDetails table
        // Based on inspection of the database structure
        const idColumn = 'IssueID'; // Exact column name in Kisii School.db
        const bookIdColumn = 'BookID'; // Exact column name in Kisii School.db
        const studentIdColumn = 'MemberID'; // Exact column name in Kisii School.db
        const issueDateColumn = 'IssueDate'; // Exact column name in Kisii School.db
        const dueDateColumn = 'DueDate'; // Exact column name in Kisii School.db
        
        // Fallback to dynamic detection if the exact columns aren't found
        const allColumns = Object.keys(sampleRecord);
        const hasExactColumns = [idColumn, bookIdColumn, studentIdColumn, issueDateColumn, dueDateColumn]
          .every(col => allColumns.includes(col));
        
        if (!hasExactColumns) {
          console.log('Could not find exact column names, falling back to dynamic detection');
          
          // Determine column names dynamically
          const dynamicIdColumn = Object.keys(sampleRecord).find(k => 
            k.toLowerCase() === 'id' || 
            k.toLowerCase().includes('issueid')
          ) || 'IssueID';
          
          const dynamicBookIdColumn = Object.keys(sampleRecord).find(k => 
            k.toLowerCase().includes('book') && k.toLowerCase().includes('id')
          ) || 'BookID';
          
          const dynamicStudentIdColumn = Object.keys(sampleRecord).find(k => 
            k.toLowerCase().includes('member') || 
            k.toLowerCase().includes('student')
          ) || 'MemberID';
          
          const dynamicIssueDateColumn = Object.keys(sampleRecord).find(k => 
            k.toLowerCase().includes('issue') || 
            k.toLowerCase().includes('borrow')
          ) || 'IssueDate';
          
          const dynamicDueDateColumn = Object.keys(sampleRecord).find(k => 
            k.toLowerCase().includes('due')
          ) || 'DueDate';
          
          // Use dynamically detected columns
          console.log('Using dynamically detected columns:');
          console.log(`ID=${dynamicIdColumn}, BookID=${dynamicBookIdColumn}, StudentID=${dynamicStudentIdColumn}, IssueDate=${dynamicIssueDateColumn}, DueDate=${dynamicDueDateColumn}`);
        } else {
          console.log('Using exact column names from Kisii School.db:');
          console.log(`ID=${idColumn}, BookID=${bookIdColumn}, StudentID=${studentIdColumn}, IssueDate=${issueDateColumn}, DueDate=${dueDateColumn}`);
        }
        
        // Process records in batches
        for (let offset = 0; offset < activeCount; offset += batchSize) {
          // Get a batch of records
          const result = await db.exec(`SELECT * FROM ${activeBorrowingTable} LIMIT ${batchSize} OFFSET ${offset}`);
          const records = result.rows || [];
          
          console.log(`Processing batch of ${records.length} active borrowings (${offset}-${offset + records.length} of ${activeCount})`);
          
          // Process each record
          for (const record of records) {
            try {
              // Find the student and book in the new system using our mapping
              const oldStudentId = record[studentIdColumn]?.toString();
              const oldBookId = record[bookIdColumn]?.toString();
              const issueId = record[idColumn]?.toString();

              console.log(`Processing borrowing: StudentID=${oldStudentId}, BookID=${oldBookId}, IssueID=${issueId}`);

              // Explicit mapping:
              // 1. Legacy MemberID → admission_number
              // 2. Legacy BookID → book_copies.legacy_book_id

              const studentId = this.importedRecords.students[oldStudentId];
              let bookId = this.importedRecords.books[oldBookId];
              if (!bookId) {
                console.log(`[DEBUG] Book ID ${oldBookId} not in memory, querying via resolveBookId...`);
                bookId = await this.resolveBookId(oldBookId);
                if (bookId) {
                  console.log(`[DEBUG] Resolved book ID ${oldBookId} → ${bookId}`);
                } else {
                  console.log(`[DEBUG] Could not resolve book ID ${oldBookId}`);
                }
              }

              if (!studentId) {
                console.error(`No mapping found for student ID ${oldStudentId}`);
                this.failedMappings.borrowings.push({
                  reason: 'student_not_found',
                  record
                });
                continue;
              }

              if (!bookId) {
                console.error(`No mapping found for book ID ${oldBookId}`);
                this.failedMappings.borrowings.push({
                  reason: 'book_not_found',
                  record
                });
                continue;
              }

              // Find available book copies
              const { data: bookCopies, error: copiesError } = await supabase
                .from('book_copies')
                .select('id, tracking_code, status')
                .eq('book_id', bookId)
                .eq('status', 'available')
                .limit(1);

              if (copiesError || !bookCopies || bookCopies.length === 0) {
                console.error('Error finding available book copy:', copiesError);
                
                // If no available copies found, try to get any copy of the book
                const { data: anyBookCopy } = await supabase
                  .from('book_copies')
                  .select('id, tracking_code, status')
                  .eq('book_id', bookId)
                  .limit(1);
                  
                if (!anyBookCopy || anyBookCopy.length === 0) {
                  console.error(`No book copies found for book ID ${bookId}`);
                  continue;
                }
                
                console.log(`No available copies found for book ID ${bookId}, using copy with status: ${anyBookCopy[0].status}`);
                
                // Use the found copy
                const bookCopyToUse = anyBookCopy[0];
                const bookCopies = [bookCopyToUse];
              }
              
              if (!bookCopies || bookCopies.length === 0) {
                console.error(`No book copies found for book ID ${bookId}`);
                continue;
              }
              
              if (this.DEBUG) console.log(`Processing active borrowing: Student ${oldStudentId}->${studentId}, Book ${oldBookId}->${bookId}`);
              
              // Check if this borrowing already exists
              const { data: existingBorrowings, error: checkError } = await supabase
                .from('borrowings')
                .select('id')
                .eq('student_id', studentId)
                .eq('book_id', bookId)
                .eq('book_copy_id', bookCopies[0].id)
                .eq('status', 'active');
              
              if (checkError) {
                console.error('Error checking existing borrowings:', checkError);
              }
              
              if (existingBorrowings && existingBorrowings.length > 0) {
                console.log(`Borrowing already exists for student ${studentId} and book ${bookId}`);
                imported++;
                continue;
              }
              
              // Parse dates properly
              let borrowedDate = record[issueDateColumn];
              let dueDate = record[dueDateColumn];
              
              // Handle different date formats
              if (borrowedDate && typeof borrowedDate === 'string') {
                try {
                  // Try to parse the date - Kisii School.db uses DD/MM/YYYY format
                  if (borrowedDate.includes('/')) {
                    const [day, month, year] = borrowedDate.split('/').map(Number);
                    borrowedDate = new Date(year, month - 1, day).toISOString().split('T')[0];
                  } else {
                    borrowedDate = new Date(borrowedDate).toISOString().split('T')[0];
                  }
                } catch (e) {
                  console.warn(`Invalid borrowed date format: ${borrowedDate}, using current date`);
                  borrowedDate = new Date().toISOString().split('T')[0];
                }
              } else {
                borrowedDate = new Date().toISOString().split('T')[0];
              }
              
              if (dueDate && typeof dueDate === 'string') {
                try {
                  // Try to parse the date - Kisii School.db uses DD/MM/YYYY format
                  if (dueDate.includes('/')) {
                    const [day, month, year] = dueDate.split('/').map(Number);
                    dueDate = new Date(year, month - 1, day).toISOString().split('T')[0];
                  } else {
                    dueDate = new Date(dueDate).toISOString().split('T')[0];
                  }
                } catch (e) {
                  console.warn(`Invalid due date format: ${dueDate}, using default (2 weeks from now)`);
                  dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                }
              } else {
                dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              }
              
              // Create the borrowing in Supabase based on the schema
              const borrowingData = {
                student_id: studentId,
                book_id: bookId,
                book_copy_id: bookCopies[0].id,
                tracking_code: bookCopies[0].tracking_code || `COPY-${bookCopies[0].id.substring(0, 6)}`,
                borrowed_date: borrowedDate,
                due_date: dueDate,
                status: 'active' as const, // Use const assertion to fix type issue
                notes: `Imported from old system - Issue ID: ${issueId || `${oldBookId}_${oldStudentId}`}`,
                legacy_data: JSON.stringify(record)
              };
              
              console.log(`Inserting borrowing with data:`, JSON.stringify(borrowingData, null, 2));
              
              try {
                const { data: borrowing, error: borrowingError } = await supabase
                  .from('borrowings')
                  .insert(borrowingData)
                  .select('id')
                  .single();
                
                if (borrowingError) {
                  console.error('Error inserting borrowing:', borrowingError);
                  continue;
                }
                
                console.log(`Successfully created borrowing with ID: ${borrowing?.id}`);
                
                // Update the book copy status to borrowed
                await supabase
                  .from('book_copies')
                  .update({ status: 'borrowed' })
                  .eq('id', bookCopies[0].id);
                  
                imported++;
              } catch (insertError) {
                console.error('Exception during borrowing insert:', insertError);
              }
            } catch (error) {
              console.error('Error processing active borrowing:', error);
              console.error('Record data:', record);
            }
          }
          
          // Report progress
          onProgress(offset + records.length, activeCount);
        }
      } else {
        console.log('No active borrowing records found in the database');
      }
    }
    
    // Import historical borrowings if needed
    if (!onlyActiveBorrowings && historicalCount > 0) {
      // Get sample record to examine columns
      const sampleResult = await db.exec(`SELECT * FROM ${historicalBorrowingTable} LIMIT 1`);
      if (sampleResult.rows && sampleResult.rows.length > 0) {
        // Log the column names for debugging
        const sampleRecord = sampleResult.rows[0];
        console.log('Historical borrowing table columns:', Object.keys(sampleRecord));
        console.log('Sample historical borrowing record:', sampleRecord);
        
        // Determine column names
        const idColumn = Object.keys(sampleRecord).find(k => 
          k.toLowerCase() === 'id' || 
          k.toLowerCase().includes('submissionid')
        ) || 'SubmissionID';
        
        const bookIdColumn = Object.keys(sampleRecord).find(k => 
          k.toLowerCase().includes('book') && k.toLowerCase().includes('id')
        ) || 'BookID';
        
        const studentIdColumn = Object.keys(sampleRecord).find(k => 
          k.toLowerCase().includes('member') || 
          k.toLowerCase().includes('student')
        ) || 'MemberID';
        
        const issueDateColumn = Object.keys(sampleRecord).find(k => 
          k.toLowerCase().includes('issue') || 
          k.toLowerCase().includes('borrow')
        ) || 'IssueDate';
        
        const dueDateColumn = Object.keys(sampleRecord).find(k => 
          k.toLowerCase().includes('due')
        ) || 'DueDate';
        
        const returnDateColumn = Object.keys(sampleRecord).find(k => 
          k.toLowerCase().includes('submit') || 
          k.toLowerCase().includes('return')
        ) || 'SubmitDate';
        
        console.log(`Using columns for historical borrowings: 
          ID=${idColumn}, 
          BookID=${bookIdColumn}, 
          StudentID=${studentIdColumn},
          IssueDate=${issueDateColumn},
          DueDate=${dueDateColumn},
          ReturnDate=${returnDateColumn}
        `);
        
        // Process records in batches
        for (let offset = 0; offset < historicalCount; offset += batchSize) {
          // Get a batch of records
          const result = await db.exec(`SELECT * FROM ${historicalBorrowingTable} LIMIT ${batchSize} OFFSET ${offset}`);
          const records = result.rows || [];
          
          console.log(`Processing batch of ${records.length} historical borrowings (${offset}-${offset + records.length} of ${historicalCount})`);
          
          // Process each record
          for (const record of records) {
            try {
              // Find the student and book in the new system using our mapping
              const oldStudentId = record[studentIdColumn]?.toString();
              const oldBookId = record[bookIdColumn]?.toString();
              const submissionId = record[idColumn]?.toString();
              
              const studentId = this.importedRecords.students[oldStudentId];
              let bookId = this.importedRecords.books[oldBookId];
              if (!bookId) {
                bookId = await this.resolveBookId(oldBookId);
              }

              if (!studentId) {
                console.error(`No mapping found for student ID ${oldStudentId}`);
                this.failedMappings.borrowings.push({
                  reason: 'student_not_found',
                  record
                });
                continue;
              }

              if (!bookId) {
                console.error(`No mapping found for book ID ${oldBookId}`);
                this.failedMappings.borrowings.push({
                  reason: 'book_not_found',
                  record
                });
                continue;
              }

              // Find a book copy for this book
              const { data: bookCopies, error: copiesError } = await supabase
                .from('book_copies')
                .select('id, tracking_code')
                .eq('book_id', bookId)
                .limit(1);

              if (copiesError || !bookCopies || bookCopies.length === 0) {
                console.error(`No book copies found for book ID ${bookId}`);
                continue;
              }

              if (this.DEBUG) console.log(`Processing historical borrowing: Student ${oldStudentId}->${studentId}, Book ${oldBookId}->${bookId}`);

              // Parse dates properly
              let borrowedDate = record[issueDateColumn];
              let dueDate = record[dueDateColumn];
              let returnedDate = record[returnDateColumn];

              // Handle different date formats for borrowed date
              if (borrowedDate && typeof borrowedDate === 'string') {
                try {
                  borrowedDate = new Date(borrowedDate).toISOString().split('T')[0];
                } catch (e) {
                  console.warn(`Invalid borrowed date format: ${borrowedDate}, using one month before return date`);
                  borrowedDate = returnedDate 
                    ? new Date(new Date(returnedDate).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                }
              } else {
                borrowedDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              }

              // Handle different date formats for due date
              if (dueDate && typeof dueDate === 'string') {
                try {
                  dueDate = new Date(dueDate).toISOString().split('T')[0];
                } catch (e) {
                  console.warn(`Invalid due date format: ${dueDate}, using 2 weeks after borrowed date`);
                  dueDate = new Date(new Date(borrowedDate).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                }
              } else {
                dueDate = new Date(new Date(borrowedDate).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              }

              // Handle different date formats for return date
              if (returnedDate && typeof returnedDate === 'string') {
                try {
                  returnedDate = new Date(returnedDate).toISOString().split('T')[0];
                } catch (e) {
                  console.warn(`Invalid return date format: ${returnedDate}, using current date`);
                  returnedDate = new Date().toISOString().split('T')[0];
                }
              } else {
                returnedDate = new Date().toISOString().split('T')[0];
              }

              // Create the borrowing in Supabase based on the schema
              const borrowingData = {
                student_id: studentId,
                book_id: bookId,
                book_copy_id: bookCopies[0].id,
                tracking_code: bookCopies[0].tracking_code || `COPY-${bookCopies[0].id.substring(0, 6)}`,
                borrowed_date: borrowedDate,
                due_date: dueDate,
                returned_date: returnedDate,
                status: 'returned' as const, // Use const assertion to fix type issue
                notes: `Imported from old system - Submission ID: ${submissionId || `${oldBookId}_${oldStudentId}`}`,
                legacy_data: JSON.stringify(record)
              };

              console.log(`Inserting historical borrowing with data:`, JSON.stringify(borrowingData, null, 2));

              try {
                const { data: borrowing, error: borrowingError } = await supabase
                  .from('borrowings')
                  .insert(borrowingData)
                  .select('id')
                  .single();

                if (borrowingError) {
                  console.error('Error inserting historical borrowing:', borrowingError);
                  continue;
                }

                console.log(`Successfully created historical borrowing with ID: ${borrowing?.id}`);
                imported++;
              } catch (insertError) {
                console.error('Exception during historical borrowing insert:', insertError);
              }
            } catch (error) {
              console.error('Error processing historical borrowing:', error);
              console.error('Record data:', record);
            }
          }

          // Report progress
          onProgress(activeCount + Math.min(offset + records.length, historicalCount), total);
        }
      } else {
        console.log('No historical borrowing records found in the database');
      }
    }

    console.log(`===== COMPLETED BORROWING IMPORT: ${imported}/${total} borrowings imported =====`);

    return imported;
  }

  /**
   * Import historical borrowings and fines from SQLite to Supabase
   * Returns count of imported borrowings and fines
   */
  static async importHistoricalBorrowingsAndFines(
    db: any,
    tableName: string,
    progressCallback?: (progress: number, total: number) => void
  ): Promise<{ borrowings: number; fines: number }> {
    console.log('===== STARTING HISTORICAL BORROWINGS AND FINES IMPORT =====');

    // Get the table names from the database
    const tables = await this.getTables(db);
    console.log('Available tables:', tables);

    // Enhanced table detection for Kisii School.db
    const historicalTable = tables.find((t: string) => 
      t === 'SubmittedBooks' || // Exact match for Kisii School.db
      t.toLowerCase().includes('submit') || 
      t.toLowerCase().includes('return') ||
      t.toLowerCase().includes('history')
    ) || 'SubmittedBooks';

    console.log(`Using table "${historicalTable}" for historical borrowings`);

    // Get total number of records
    const total = await this.getTableCount(db, historicalTable);
    console.log(`Found ${total} historical borrowing records`);

    if (total === 0) {
      return { borrowings: 0, fines: 0 };
    }

    // Get sample record to examine columns
    const sampleResult = await db.exec(`SELECT * FROM ${historicalTable} LIMIT 1`);
    if (!sampleResult.rows || sampleResult.rows.length === 0) {
      console.log('No historical borrowing records found in the database');
      return { borrowings: 0, fines: 0 };
    }

    // Log the column names for debugging
    const sampleRecord = sampleResult.rows[0];
    console.log('Historical borrowing table columns:', Object.keys(sampleRecord));
    console.log('Sample historical borrowing record:', sampleRecord);

    // Specific column mapping for Kisii School.db - SubmittedBooks table
    // Based on inspection of the database structure
    const idColumn = 'ID'; // Exact column name in Kisii School.db
    const bookIdColumn = 'BookID'; // Exact column name in Kisii School.db
    const studentIdColumn = 'MemberID'; // Exact column name in Kisii School.db
    const issueDateColumn = 'IssueDate'; // Exact column name in Kisii School.db
    const dueDateColumn = 'DueDate'; // Exact column name in Kisii School.db
    const returnDateColumn = 'SubmitDate'; // Exact column name in Kisii School.db
    const fineColumn = 'Fine'; // Exact column name in Kisii School.db

    // Fallback to dynamic detection if the exact columns aren't found
    const allColumns = Object.keys(sampleRecord);
    const hasExactColumns = [idColumn, bookIdColumn, studentIdColumn, issueDateColumn, dueDateColumn, returnDateColumn, fineColumn]
      .every(col => allColumns.includes(col));

    if (!hasExactColumns) {
      console.log('Could not find exact column names, falling back to dynamic detection');

      // Determine column names dynamically
      const dynamicIdColumn = Object.keys(sampleRecord).find(k => 
        k.toLowerCase() === 'id' || 
        k.toLowerCase().includes('issueid') ||
        k.toLowerCase().includes('submitid')
      ) || 'ID';

      const dynamicBookIdColumn = Object.keys(sampleRecord).find(k => 
        k.toLowerCase().includes('book') && k.toLowerCase().includes('id')
      ) || 'BookID';

      const dynamicStudentIdColumn = Object.keys(sampleRecord).find(k => 
        k.toLowerCase().includes('member') || 
        k.toLowerCase().includes('student')
      ) || 'MemberID';

      const dynamicIssueDateColumn = Object.keys(sampleRecord).find(k => 
        k.toLowerCase().includes('issue') || 
        k.toLowerCase().includes('borrow')
      ) || 'IssueDate';

      const dynamicDueDateColumn = Object.keys(sampleRecord).find(k => 
        k.toLowerCase().includes('due')
      ) || 'DueDate';

      const dynamicReturnDateColumn = Object.keys(sampleRecord).find(k => 
        k.toLowerCase().includes('return') || 
        k.toLowerCase().includes('submit')
      ) || 'SubmitDate';

      const dynamicFineColumn = Object.keys(sampleRecord).find(k => 
        k.toLowerCase().includes('fine') || 
        k.toLowerCase().includes('amount')
      ) || 'Fine';

      // Use dynamically detected columns
      console.log('Using dynamically detected columns:');
      console.log(`ID=${dynamicIdColumn}, BookID=${dynamicBookIdColumn}, StudentID=${dynamicStudentIdColumn}, IssueDate=${dynamicIssueDateColumn}, DueDate=${dynamicDueDateColumn}, ReturnDate=${dynamicReturnDateColumn}, Fine=${dynamicFineColumn}`);
    } else {
      console.log('Using exact column names from Kisii School.db:');
      console.log(`ID=${idColumn}, BookID=${bookIdColumn}, StudentID=${studentIdColumn}, IssueDate=${issueDateColumn}, DueDate=${dueDateColumn}, ReturnDate=${returnDateColumn}, Fine=${fineColumn}`);
    }

    let importedBorrowings = 0;
    let importedFines = 0;

    // Process records in batches
    for (let offset = 0; offset < total; offset += 50) {
      // Get a batch of records
      const result = await db.exec(`SELECT * FROM ${historicalTable} LIMIT 50 OFFSET ${offset}`);
      const records = result.rows || [];

      console.log(`Processing batch of ${records.length} historical borrowings (${offset}-${offset + records.length} of ${total})`);

      // Process each record
      for (const record of records) {
        try {
          // Find the student and book in the new system using our mapping
          const oldStudentId = record[studentIdColumn]?.toString();
          const oldBookId = record[bookIdColumn]?.toString();
          const submissionId = record[idColumn]?.toString();

          console.log(`Processing historical borrowing: StudentID=${oldStudentId}, BookID=${oldBookId}, SubmissionID=${submissionId}`);

          // Explicit mapping:
          // 1. Legacy MemberID → admission_number
          // 2. Legacy BookID → book_copies.legacy_book_id

          const studentId = this.importedRecords.students[oldStudentId];
          let bookId = this.importedRecords.books[oldBookId];
          if (!bookId) {
            console.log(`[DEBUG] Book ID ${oldBookId} not in memory, querying via resolveBookId...`);
            bookId = await this.resolveBookId(oldBookId);
            if (bookId) {
              console.log(`[DEBUG] Resolved book ID ${oldBookId} → ${bookId}`);
            } else {
              console.log(`[DEBUG] Could not resolve book ID ${oldBookId}`);
            }
          }

          if (!studentId) {
            console.error(`Could not find mapping for student (${oldStudentId}) for historical borrowing ${submissionId}`);
            continue;
          }

          if (!bookId) {
            console.error(`Could not find mapping for book (${oldBookId}) for historical borrowing ${submissionId}`);
            continue;
          }

          // Find a book copy for this book
          const { data: bookCopies, error: copiesError } = await supabase
            .from('book_copies')
            .select('id, tracking_code')
            .eq('book_id', bookId)
            .limit(1);

          if (copiesError || !bookCopies || bookCopies.length === 0) {
            console.error(`No book copies found for book ID ${bookId}`);
            continue;
          }

          if (this.DEBUG) console.log(`Processing historical borrowing: Student ${oldStudentId}->${studentId}, Book ${oldBookId}->${bookId}`);

          // Parse dates properly
          let borrowedDate = record[issueDateColumn];
          let dueDate = record[dueDateColumn];
          let returnedDate = record[returnDateColumn];
          let fineAmount = parseFloat(record[fineColumn] || '0');

          // Handle different date formats - Kisii School.db uses DD/MM/YYYY format
          if (borrowedDate && typeof borrowedDate === 'string') {
            try {
              if (borrowedDate.includes('/')) {
                const [day, month, year] = borrowedDate.split('/').map(Number);
                borrowedDate = new Date(year, month - 1, day).toISOString().split('T')[0];
              } else {
                borrowedDate = new Date(borrowedDate).toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn(`Invalid borrowed date format: ${borrowedDate}, using current date`);
              borrowedDate = new Date().toISOString().split('T')[0];
            }
          } else {
            borrowedDate = new Date().toISOString().split('T')[0];
          }

          if (dueDate && typeof dueDate === 'string') {
            try {
              if (dueDate.includes('/')) {
                const [day, month, year] = dueDate.split('/').map(Number);
                dueDate = new Date(year, month - 1, day).toISOString().split('T')[0];
              } else {
                dueDate = new Date(dueDate).toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn(`Invalid due date format: ${dueDate}, using default (2 weeks from now)`);
              dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
          } else {
            dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          }

          if (returnedDate && typeof returnedDate === 'string') {
            try {
              if (returnedDate.includes('/')) {
                const [day, month, year] = returnedDate.split('/').map(Number);
                returnedDate = new Date(year, month - 1, day).toISOString().split('T')[0];
              } else {
                returnedDate = new Date(returnedDate).toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn(`Invalid return date format: ${returnedDate}, using current date`);
              returnedDate = new Date().toISOString().split('T')[0];
            }
          } else {
            returnedDate = new Date().toISOString().split('T')[0];
          }

          // Check if this borrowing already exists
          const { data: existingBorrowings, error: checkError } = await supabase
            .from('borrowings')
            .select('id')
            .eq('student_id', studentId)
            .eq('book_id', bookId)
            .eq('book_copy_id', bookCopies[0].id)
            .eq('status', 'returned');

          if (checkError) {
            console.error('Error checking existing borrowings:', checkError);
          }

          if (existingBorrowings && existingBorrowings.length > 0) {
            console.log(`Historical borrowing already exists for student ${studentId} and book ${bookId}`);
            importedBorrowings++;
            continue;
          }

          // Create the historical borrowing in Supabase
          const borrowingData = {
            student_id: studentId,
            book_id: bookId,
            book_copy_id: bookCopies[0].id,
            tracking_code: bookCopies[0].tracking_code || `COPY-${bookCopies[0].id.substring(0, 6)}`,
            borrowed_date: borrowedDate,
            due_date: dueDate,
            returned_date: returnedDate,
            status: 'returned' as const,
            notes: `Imported from old system - Submission ID: ${submissionId || `${oldBookId}_${oldStudentId}`}`,
            legacy_data: JSON.stringify(record)
          };

          console.log(`Inserting historical borrowing with data:`, JSON.stringify(borrowingData, null, 2));

          try {
            const { data: borrowing, error: borrowingError } = await supabase
              .from('borrowings')
              .insert(borrowingData)
              .select('id')
              .single();

            if (borrowingError) {
              console.error('Error inserting historical borrowing:', borrowingError);
              continue;
            }

            console.log(`Successfully created historical borrowing with ID: ${borrowing?.id}`);
            importedBorrowings++;

            // Create a fine record if there is a fine amount
            if (fineAmount > 0 && borrowing) {
              console.log(`Creating fine record for ${fineAmount}`);

              const fineData = {
                borrowing_id: borrowing.id,
                student_id: studentId,
                // Removing book_id as it's not in the schema
                amount: fineAmount,
                status: 'paid' as const,
                fine_type: 'late_return', // This is a valid fine_type from the allowed list
                description: `Imported from old system - Fine for late return`,
                created_at: returnedDate
              };

              try {
                const { data: fine, error: fineError } = await supabase
                  .from('fines')
                  .insert(fineData)
                  .select('id')
                  .single();

                if (fineError) {
                  console.error('Error inserting fine:', fineError);
                } else {
                  console.log(`Successfully created fine with ID: ${fine?.id}`);
                  importedFines++;
                }
              } catch (fineInsertError) {
                console.error('Exception during fine insert:', fineInsertError);
              }
            }
          } catch (insertError) {
            console.error('Exception during historical borrowing insert:', insertError);
          }
        } catch (error) {
          console.error('Error processing historical borrowing:', error);
          console.error('Record data:', record);
        }
      }

      // Report progress
      if (progressCallback) progressCallback(offset + records.length, total);
    }

    console.log(`===== COMPLETED HISTORICAL BORROWINGS AND FINES IMPORT: ${importedBorrowings} borrowings and ${importedFines} fines imported =====`);

    return { borrowings: importedBorrowings, fines: importedFines };
  }

  /**
   * Generate fines from imported borrowings
   * This should be called after borrowings are imported
   */
  static async generateFinesFromBorrowings(
    progressCallback?: (progress: number, total: number) => void
  ): Promise<number> {
    console.log('Generating fines from borrowings data...');

    try {
      // 1. Get all borrowings that might need fines (lost books, overdue, or late returns)
      const { data: borrowings, error: borrowingsError } = await supabase
        .from('borrowings')
        .select('id, student_id, book_id, book_copy_id, tracking_code, borrowed_date, due_date, returned_date, is_lost, fine_amount')
        .order('due_date', { ascending: false });

      if (borrowingsError) {
        console.error('Error fetching borrowings for fines generation:', borrowingsError);
        throw borrowingsError;
      }

      if (!borrowings || borrowings.length === 0) {
        console.log('No borrowings found that need fines');
        return 0;
      }

      // Filter borrowings that need fines in JavaScript
      const currentDate = new Date();
      const candidateBorrowings = borrowings.filter(borrowing => {
        // Lost books need fines
        if (borrowing.is_lost) return true;

        // Books returned after due date need fines
        if (borrowing.returned_date && borrowing.due_date) {
          const returnedDate = new Date(borrowing.returned_date);
          const dueDate = new Date(borrowing.due_date);
          if (returnedDate > dueDate) return true;
        }

        // Currently overdue books need fines
        if (borrowing.due_date && !borrowing.returned_date) {
          const dueDate = new Date(borrowing.due_date);
          if (currentDate > dueDate) return true;
        }

        return false;
      });

      console.log(`Found ${candidateBorrowings.length} borrowings that need fines (out of ${borrowings.length} total)`);

      if (candidateBorrowings.length === 0) {
        return 0;
      }

      // 2. Check which borrowings don't have fines yet
      const borrowingIds = candidateBorrowings.map(b => b.id);
      const { data: existingFines, error: finesError } = await supabase
        .from('fines')
        .select('borrowing_id')
        .in('borrowing_id', borrowingIds);

      if (finesError) {
        console.error('Error checking existing fines:', finesError);
        throw finesError;
      }

      // Create a set of borrowing IDs that already have fines
      const borrowingsWithFines = new Set(existingFines?.map(f => f.borrowing_id) || []);

      // 3. Filter borrowings that don't have fines yet
      const borrowingsNeedingFines = candidateBorrowings.filter(b => !borrowingsWithFines.has(b.id));

      console.log(`Found ${borrowingsNeedingFines.length} borrowings that need fines`);

      if (borrowingsNeedingFines.length === 0) {
        return 0;
      }

      // 4. Create fines for these borrowings
      let createdFines = 0;
      let processedCount = 0;

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < borrowingsNeedingFines.length; i += batchSize) {
        const batch = borrowingsNeedingFines.slice(i, i + batchSize);

        // Prepare fine records
        const fineRecords = batch.map(borrowing => {
          // Determine fine type and amount
          let fineType = 'overdue';
          let amount = 100; // Default amount

          if (borrowing.is_lost) {
            fineType = 'lost_book';
            amount = borrowing.fine_amount || 1500; // Default lost book fine
          } else if (borrowing.returned_date && new Date(borrowing.returned_date) > new Date(borrowing.due_date)) {
            fineType = 'late_return';
            // Calculate days overdue
            const dueDate = new Date(borrowing.due_date);
            const returnedDate = new Date(borrowing.returned_date);
            const daysOverdue = Math.ceil((returnedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            amount = daysOverdue * 50; // 50 per day overdue
          } else if (borrowing.due_date && new Date(borrowing.due_date) < new Date()) {
            // Currently overdue
            const dueDate = new Date(borrowing.due_date);
            const today = new Date();
            const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            amount = daysOverdue * 50; // 50 per day overdue
          }

          return {
            student_id: borrowing.student_id,
            borrowing_id: borrowing.id,
            fine_type: fineType,
            amount: amount,
            description: `${fineType === 'lost_book' ? 'Lost book fine' : 'Overdue fine'} for borrowing ID ${borrowing.id}`,
            status: 'unpaid',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });

        // Insert fines
        const { data: insertedFines, error: insertError } = await supabase
          .from('fines')
          .insert(fineRecords)
          .select();

        if (insertError) {
          console.error('Error inserting fines:', insertError);
          // Continue with next batch despite errors
        } else {
          createdFines += insertedFines?.length || 0;
        }

        processedCount += batch.length;
        if (progressCallback) {
          progressCallback(processedCount, borrowingsNeedingFines.length);
        }
      }

      console.log(`Successfully created ${createdFines} fines`);
      return createdFines;

    } catch (error) {
      console.error('Error generating fines from borrowings:', error);
      throw error;
    }
  }

  /**
   * Update book status based on borrowings
   * Called after migration to ensure book availability status is correct
   */
  static async updateBookStatusFromBorrowings(): Promise<{ updated: number, errors: number }> {
    console.log('===== UPDATING BOOK STATUS FROM BORROWINGS =====');

    let updated = 0;
    let errors = 0;

    try {
      // Get all active borrowings
      const { data: activeBorrowings, error: borrowingsError } = await supabase
        .from('borrowings')
        .select('book_id, book_copy_id')
        .eq('status', 'active');

      if (borrowingsError) {
        console.error('Error fetching active borrowings:', borrowingsError);
        return { updated: 0, errors: 1 };
      }

      console.log(`Found ${activeBorrowings?.length || 0} active borrowings`);

      // Update all book copies to available first
      const { error: resetError } = await supabase
        .from('book_copies')
        .update({ status: 'available' })
        .neq('status', 'lost');

      if (resetError) {
        console.error('Error resetting book copy status:', resetError);
        errors++;
      }

      // If no active borrowings, we're done
      if (!activeBorrowings || activeBorrowings.length === 0) {
        console.log('No active borrowings found, all books set to available');
        return { updated: 0, errors };
      }

      // Update status for all book copies in active borrowings
      for (const borrowing of activeBorrowings) {
        if (!borrowing.book_copy_id) continue;

        const { error: updateError } = await supabase
          .from('book_copies')
          .update({ status: 'borrowed' })
          .eq('id', borrowing.book_copy_id);

        if (updateError) {
          console.error(`Error updating book copy ${borrowing.book_copy_id} status:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }

      // Update available_copies count for all books
      // Instead of using RPC, we'll manually update the available_copies field
      // for each book that has borrowings

      // Get unique book IDs that have active borrowings
      const bookIds = [...new Set(activeBorrowings.map(b => b.book_id))];

      for (const bookId of bookIds) {
        // Get total copies for this book
        const { data: bookData, error: bookError } = await supabase
          .from('books')
          .select('total_copies')
          .eq('id', bookId)
          .single();

        if (bookError) {
          console.error(`Error getting book ${bookId}:`, bookError);
          errors++;
          continue;
        }

        // Count borrowed copies
        const { data: borrowedCopies, error: countError } = await supabase
          .from('book_copies')
          .select('id', { count: 'exact' })
          .eq('book_id', bookId)
          .eq('status', 'borrowed');

        if (countError) {
          console.error(`Error counting borrowed copies for book ${bookId}:`, countError);
          errors++;
          continue;
        }

        const borrowedCount = borrowedCopies?.length || 0;
        const totalCopies = bookData?.total_copies || 0;
        const availableCopies = Math.max(0, totalCopies - borrowedCount);

        // Update the book's available_copies
        const { error: updateError } = await supabase
          .from('books')
          .update({ available_copies: availableCopies })
          .eq('id', bookId);

        if (updateError) {
          console.error(`Error updating available_copies for book ${bookId}:`, updateError);
          errors++;
        }
      }

      console.log(`===== COMPLETED BOOK STATUS UPDATE: ${updated} copies updated, ${errors} errors =====`);

      return { updated, errors };

    } catch (error) {
      console.error('Error in updateBookStatusFromBorrowings:', error);
      return { updated, errors: errors + 1 };
    }
  }

  /**
   * Rebuild mappings from existing Supabase data
   */
  static async rebuildMappingsFromSupabase(supabase: any): Promise<void> {
    try {
      console.log('🔄 Rebuilding mappings from existing Supabase data...');

      // Rebuild book mappings
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('id, notes, title')
        .not('notes', 'is', null);

      if (!booksError && books) {
        this.importedRecords.books = {};
        console.log(`📚 Found ${books.length} books with notes to analyze`);

        for (const book of books) {
          if (book.notes) {
            let originalBookId = null;

            try {
              // Try to parse the notes as JSON first
              const notesData = JSON.parse(book.notes);
              if (notesData.original_book_id) {
                originalBookId = notesData.original_book_id;
              } else if (notesData.originalBookId) {
                originalBookId = notesData.originalBookId;
              }
            } catch (e) {
              // If notes is not JSON, try different patterns
              // Look for patterns like "book_id: 123", "original_book_id: 123", etc.
              const patterns = [
                /original_book_id[:\s]*(\d+)/i,
                /book_id[:\s]*(\d+)/i,
                /id[:\s]*(\d+)/i,
                /(\d+)/  // fallback: any number
              ];

              for (const pattern of patterns) {
                const match = book.notes.match(pattern);
                if (match) {
                  originalBookId = match[1];
                  break;
                }
              }
            }

            if (originalBookId) {
              this.importedRecords.books[originalBookId] = book.id;
              console.log(`📖 Mapped book ${originalBookId} → ${book.id} (${book.title})`);
            }
          }
        }
        console.log(`📚 Rebuilt ${Object.keys(this.importedRecords.books).length} book mappings`);
      } else {
        console.error('❌ Error fetching books:', booksError);
      }

      // Rebuild student mappings
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, notes, full_name')
        .not('notes', 'is', null);

      if (!studentsError && students) {
        this.importedRecords.students = {};
        console.log(`👥 Found ${students.length} students with notes to analyze`);

        for (const student of students) {
          if (student.notes) {
            let originalStudentId = null;

            try {
              // Try to parse the notes as JSON first
              const notesData = JSON.parse(student.notes);
              if (notesData.original_student_id) {
                originalStudentId = notesData.original_student_id;
              } else if (notesData.originalStudentId) {
                originalStudentId = notesData.originalStudentId;
              }
            } catch (e) {
              // If notes is not JSON, try different patterns
              const patterns = [
                /original_student_id[:\s]*(\d+)/i,
                /student_id[:\s]*(\d+)/i,
                /id[:\s]*(\d+)/i,
                /(\d+)/  // fallback: any number
              ];

              for (const pattern of patterns) {
                const match = student.notes.match(pattern);
                if (match) {
                  originalStudentId = match[1];
                  break;
                }
              }
            }

            if (originalStudentId) {
              this.importedRecords.students[originalStudentId] = student.id;
              console.log(`👤 Mapped student ${originalStudentId} → ${student.id} (${student.full_name})`);
            }
          }
        }
        console.log(`👥 Rebuilt ${Object.keys(this.importedRecords.students).length} student mappings`);
      } else {
        console.error('❌ Error fetching students:', studentsError);
      }

    } catch (error) {
      console.error('❌ Error rebuilding mappings:', error);
    }
  }
}