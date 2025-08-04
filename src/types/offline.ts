export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category_id: string;
  total_copies: number;
  available_copies: number;
  description?: string;
  cover_image?: string;
  published_date?: string;
  publisher?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BookWithDetails extends Book {
  category_name: string;
  borrowed_count: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  book_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  grade?: string;
  class?: string;
  class_id?: string;
  admission_number?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Class {
  id: string;
  name: string;
  class_name?: string;
  description?: string;
  teacher_name?: string;
  grade_level?: string;
  academic_year?: string;
  academic_level_type?: string;
  form_level?: number;
  class_section?: string;
  max_books_allowed?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Staff {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  position?: string;
  department?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LibraryStats {
  total_books: number;
  total_students: number;
  total_staff: number;
  total_borrowings: number;
  overdue_books: number;
  available_books: number;
}

export interface Borrowing {
  id: string;
  book_id: string;
  student_id: string;
  borrow_date: string;
  due_date: string;
  return_date?: string;
  status: 'borrowed' | 'returned' | 'overdue';
  fine_amount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BorrowingWithDetails extends Borrowing {
  book_title: string;
  book_isbn: string;
  student_name: string;
  student_email: string;
}

export interface Fine {
  id: string;
  borrowing_id: string;
  student_id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'paid' | 'waived';
  paid_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FineWithDetails extends Fine {
  book_title: string;
  student_name: string;
  student_email: string;
}
