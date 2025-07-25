
/**
 * Library Management System Database Schema
 * 
 * This file contains the TypeScript interfaces that match the Supabase database schema.
 * It serves as documentation and type reference for the database structure.
 */

// User Profiles
export interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: 'admin' | 'librarian' | 'user';
  suspended?: boolean;
  created_at: string;
  updated_at: string;
}

// Categories for organizing books
export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// Books in the library
export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publication_year?: number;
  genre?: string;
  description?: string;
  cover_image_url?: string;
  shelf_location?: string;
  total_copies: number;
  available_copies: number;
  category_id?: string;
  status: 'available' | 'borrowed' | 'maintenance' | 'lost';
  created_at?: string;
  updated_at?: string;
}

// Individual book copies with tracking codes
export interface BookCopy {
  id: string;
  book_id: string;
  copy_number: number;
  book_code: string;
  tracking_code?: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  status: 'available' | 'borrowed' | 'maintenance' | 'lost';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  
  // Related data (joined from other tables)
  books?: Book;
}

// Enhanced Classes interface with academic level type support
export interface Class {
  id: string;
  class_name: string;
  form_level: number;
  class_section: string;
  max_books_allowed?: number;
  academic_level_type?: 'form' | 'grade';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Students who can borrow books
export interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  class_grade: string;
  class_id?: string;
  date_of_birth?: string;
  email?: string;
  phone?: string;
  address?: string;
  enrollment_date?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// Book borrowing records
export interface Borrowing {
  id: string;
  student_id: string;
  book_id: string;
  book_copy_id?: string;
  borrowed_date?: string;
  due_date: string;
  returned_date?: string;
  status: 'active' | 'returned' | 'overdue';
  fine_amount?: number;
  notes?: string;
  issued_by?: string;
  returned_by?: string;
  condition_at_issue?: string;
  condition_at_return?: string;
  tracking_code?: string;
  return_notes?: string;
  created_at?: string;
  updated_at?: string;
  
  // Related data (joined from other tables)
  students?: Student;
  books?: Book;
  book_copies?: BookCopy;
}

// Notifications for users
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'overdue' | 'info' | 'warning' | 'success';
  read: boolean;
  related_id?: string;
  created_at: string;
}

/**
 * Database Enums
 */
export const BookStatus = {
  AVAILABLE: 'available',
  BORROWED: 'borrowed',
  MAINTENANCE: 'maintenance',
  LOST: 'lost'
} as const;

export const BorrowingStatus = {
  ACTIVE: 'active',
  RETURNED: 'returned',
  OVERDUE: 'overdue'
} as const;

export const UserRole = {
  ADMIN: 'admin',
  LIBRARIAN: 'librarian',
  USER: 'user'
} as const;

export const NotificationType = {
  OVERDUE: 'overdue',
  INFO: 'info',
  WARNING: 'warning',
  SUCCESS: 'success'
} as const;

export const AcademicLevelType = {
  FORM: 'form',
  GRADE: 'grade'
} as const;

/**
 * Database Functions
 * 
 * These are custom functions available in the Supabase database:
 * 
 * 1. create_librarian_profile(user_id, user_email, first_name, last_name, phone_number)
 *    - Creates a new librarian profile
 *    - Returns: boolean
 * 
 * 2. create_notifications_table_if_not_exists()
 *    - Ensures the notifications table exists
 *    - Returns: void
 * 
 * 3. update_book_availability()
 *    - Trigger function that automatically updates book availability
 *    - Triggered on borrowings table changes
 * 
 * 4. update_updated_at_column()
 *    - Trigger function that updates the updated_at timestamp
 *    - Triggered on various table updates
 * 
 * 5. get_current_user_role()
 *    - Security definer function to get current user role safely
 *    - Returns: text (role name)
 */

/**
 * Row Level Security (RLS) Policies
 * 
 * The database uses RLS to ensure data security:
 * - Users can only access their own data
 * - Admins have broader access permissions
 * - Librarians have access to library management functions
 * 
 * Note: Specific RLS policies are defined in the database migration files.
 */

/**
 * Database Relationships
 * 
 * 1. books -> categories (many-to-one)
 * 2. borrowings -> students (many-to-one)
 * 3. borrowings -> books (many-to-one)
 * 4. notifications -> profiles (many-to-one via user_id)
 * 5. students -> classes (many-to-one via class_id)
 * 
 * Foreign Key Constraints:
 * - books.category_id -> categories.id
 * - borrowings.student_id -> students.id
 * - borrowings.book_id -> books.id
 * - students.class_id -> classes.id
 * - profiles.id -> auth.users.id (Supabase Auth)
 */

/**
 * Indexes for Performance
 * 
 * Recommended indexes for optimal query performance:
 * - students.admission_number (unique)
 * - books.isbn (unique where not null)
 * - borrowings.status
 * - borrowings.due_date
 * - notifications.user_id
 * - notifications.read
 * - classes.academic_level_type
 * - classes.form_level
 */

export type DatabaseSchema = {
  profiles: Profile;
  categories: Category;
  books: Book;
  students: Student;
  classes: Class;
  borrowings: Borrowing;
  notifications: Notification;
};
