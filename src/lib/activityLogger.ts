import { invoke } from '@tauri-apps/api/core';

/**
 * Activity logger utility for tracking user actions
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface LogActivityParams {
  level?: LogLevel;
  category: string;
  action: string;
  userId?: string;
  userEmail?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
}

/**
 * Log a user activity
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await invoke('log_simple_activity', {
      level: params.level || 'info',
      category: params.category,
      action: params.action,
      userId: params.userId || null,
      userEmail: params.userEmail || null,
      resourceType: params.resourceType || null,
      resourceId: params.resourceId || null,
      details: params.details || null,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging failures shouldn't break the app
  }
}

/**
 * Log book-related activities
 */
export const logBook = {
  added: (bookId: string, bookTitle: string, userEmail?: string) =>
    logActivity({
      category: 'Books',
      action: 'Book Added',
      resourceType: 'book',
      resourceId: bookId,
      userEmail,
      details: { title: bookTitle },
    }),

  updated: (bookId: string, bookTitle: string, changes: Record<string, any>, userEmail?: string) =>
    logActivity({
      category: 'Books',
      action: 'Book Updated',
      resourceType: 'book',
      resourceId: bookId,
      userEmail,
      details: { title: bookTitle, changes },
    }),

  deleted: (bookId: string, bookTitle: string, userEmail?: string) =>
    logActivity({
      category: 'Books',
      action: 'Book Deleted',
      resourceType: 'book',
      resourceId: bookId,
      userEmail,
      details: { title: bookTitle },
    }),

  copyAdded: (copyId: string, bookTitle: string, trackingCode: string, userEmail?: string) =>
    logActivity({
      category: 'Books',
      action: 'Book Copy Added',
      resourceType: 'book_copy',
      resourceId: copyId,
      userEmail,
      details: { title: bookTitle, tracking_code: trackingCode },
    }),
};

/**
 * Log borrowing-related activities
 */
export const logBorrowing = {
  issued: (borrowingId: string, bookTitle: string, borrowerName: string, borrowerType: 'student' | 'staff', userEmail?: string) =>
    logActivity({
      category: 'Borrowing',
      action: 'Book Issued',
      resourceType: 'borrowing',
      resourceId: borrowingId,
      userEmail,
      details: { 
        book_title: bookTitle, 
        borrower_name: borrowerName,
        borrower_type: borrowerType,
      },
    }),

  returned: (borrowingId: string, bookTitle: string, borrowerName: string, condition?: string, userEmail?: string) =>
    logActivity({
      category: 'Borrowing',
      action: 'Book Returned',
      resourceType: 'borrowing',
      resourceId: borrowingId,
      userEmail,
      details: { 
        book_title: bookTitle, 
        borrower_name: borrowerName,
        condition: condition || 'unknown',
      },
    }),

  renewed: (borrowingId: string, bookTitle: string, newDueDate: string, userEmail?: string) =>
    logActivity({
      category: 'Borrowing',
      action: 'Borrowing Renewed',
      resourceType: 'borrowing',
      resourceId: borrowingId,
      userEmail,
      details: { book_title: bookTitle, new_due_date: newDueDate },
    }),

  groupIssued: (groupBorrowingId: string, bookTitle: string, studentCount: number, userEmail?: string) =>
    logActivity({
      category: 'Borrowing',
      action: 'Group Borrowing Issued',
      resourceType: 'group_borrowing',
      resourceId: groupBorrowingId,
      userEmail,
      details: { 
        book_title: bookTitle, 
        student_count: studentCount,
      },
    }),

  groupReturned: (groupBorrowingId: string, bookTitle: string, studentCount: number, userEmail?: string) =>
    logActivity({
      category: 'Borrowing',
      action: 'Group Borrowing Returned',
      resourceType: 'group_borrowing',
      resourceId: groupBorrowingId,
      userEmail,
      details: { 
        book_title: bookTitle, 
        student_count: studentCount,
      },
    }),
};

/**
 * Log fine-related activities
 */
export const logFine = {
  created: (fineId: string, borrowerName: string, amount: number, reason: string, userEmail?: string) =>
    logActivity({
      category: 'Fines',
      action: 'Fine Created',
      resourceType: 'fine',
      resourceId: fineId,
      userEmail,
      details: { 
        borrower_name: borrowerName, 
        amount,
        reason,
      },
    }),

  paid: (fineId: string, borrowerName: string, amount: number, userEmail?: string) =>
    logActivity({
      category: 'Fines',
      action: 'Fine Paid',
      resourceType: 'fine',
      resourceId: fineId,
      userEmail,
      details: { 
        borrower_name: borrowerName, 
        amount,
      },
    }),

  waived: (fineId: string, borrowerName: string, amount: number, reason: string, userEmail?: string) =>
    logActivity({
      category: 'Fines',
      action: 'Fine Waived',
      resourceType: 'fine',
      resourceId: fineId,
      userEmail,
      details: { 
        borrower_name: borrowerName, 
        amount,
        reason,
      },
    }),
};

/**
 * Log student-related activities
 */
export const logStudent = {
  added: (studentId: string, admissionNumber: string, fullName: string, userEmail?: string) =>
    logActivity({
      category: 'Students',
      action: 'Student Added',
      resourceType: 'student',
      resourceId: studentId,
      userEmail,
      details: { 
        admission_number: admissionNumber,
        full_name: fullName,
      },
    }),

  updated: (studentId: string, admissionNumber: string, fullName: string, changes: Record<string, any>, userEmail?: string) =>
    logActivity({
      category: 'Students',
      action: 'Student Updated',
      resourceType: 'student',
      resourceId: studentId,
      userEmail,
      details: { 
        admission_number: admissionNumber,
        full_name: fullName,
        changes,
      },
    }),

  deleted: (studentId: string, admissionNumber: string, fullName: string, userEmail?: string) =>
    logActivity({
      category: 'Students',
      action: 'Student Deleted',
      resourceType: 'student',
      resourceId: studentId,
      userEmail,
      details: { 
        admission_number: admissionNumber,
        full_name: fullName,
      },
    }),

  bulkImported: (count: number, userEmail?: string) =>
    logActivity({
      category: 'Students',
      action: 'Bulk Import',
      userEmail,
      details: { 
        students_imported: count,
      },
    }),
};

/**
 * Log staff-related activities
 */
export const logStaff = {
  added: (staffId: string, staffNumber: string, fullName: string, userEmail?: string) =>
    logActivity({
      category: 'Staff',
      action: 'Staff Added',
      resourceType: 'staff',
      resourceId: staffId,
      userEmail,
      details: { 
        staff_number: staffNumber,
        full_name: fullName,
      },
    }),

  updated: (staffId: string, staffNumber: string, fullName: string, changes: Record<string, any>, userEmail?: string) =>
    logActivity({
      category: 'Staff',
      action: 'Staff Updated',
      resourceType: 'staff',
      resourceId: staffId,
      userEmail,
      details: { 
        staff_number: staffNumber,
        full_name: fullName,
        changes,
      },
    }),

  deleted: (staffId: string, staffNumber: string, fullName: string, userEmail?: string) =>
    logActivity({
      category: 'Staff',
      action: 'Staff Deleted',
      resourceType: 'staff',
      resourceId: staffId,
      userEmail,
      details: { 
        staff_number: staffNumber,
        full_name: fullName,
      },
    }),
};

/**
 * Log sync-related activities
 */
export const logSync = {
  started: (direction: 'upload' | 'download' | 'bidirectional', userEmail?: string) =>
    logActivity({
      category: 'Sync',
      action: 'Sync Started',
      userEmail,
      details: { direction },
    }),

  completed: (direction: 'upload' | 'download' | 'bidirectional', recordsProcessed: number, duration: number, userEmail?: string) =>
    logActivity({
      category: 'Sync',
      action: 'Sync Completed',
      userEmail,
      details: { 
        direction, 
        records_processed: recordsProcessed,
        duration_ms: duration,
      },
    }),

  failed: (direction: 'upload' | 'download' | 'bidirectional', error: string, userEmail?: string) =>
    logActivity({
      level: 'error',
      category: 'Sync',
      action: 'Sync Failed',
      userEmail,
      details: { 
        direction, 
        error,
      },
    }),
};

/**
 * Log authentication activities
 */
export const logAuth = {
  login: (userEmail: string) =>
    logActivity({
      category: 'Authentication',
      action: 'User Login',
      userEmail,
    }),

  logout: (userEmail: string) =>
    logActivity({
      category: 'Authentication',
      action: 'User Logout',
      userEmail,
    }),

  sessionExpired: (userEmail: string) =>
    logActivity({
      level: 'warning',
      category: 'Authentication',
      action: 'Session Expired',
      userEmail,
    }),
};

/**
 * Log report generation
 */
export const logReport = {
  generated: (reportType: string, recordCount: number, userEmail?: string) =>
    logActivity({
      category: 'Reports',
      action: 'Report Generated',
      userEmail,
      details: { 
        report_type: reportType,
        record_count: recordCount,
      },
    }),

  exported: (reportType: string, format: string, userEmail?: string) =>
    logActivity({
      category: 'Reports',
      action: 'Report Exported',
      userEmail,
      details: { 
        report_type: reportType,
        format,
      },
    }),
};
