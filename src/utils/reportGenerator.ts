import { invoke } from '@tauri-apps/api/core';
import { downloadDir } from '@tauri-apps/api/path';
import jsPDF from 'jspdf';

// Utility function to format days overdue in a professional way
const formatDaysOverdue = (days: number): string => {
  if (!days || days <= 0) return '0 days';
  
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remainingDays = Math.floor(days % 30);
  
  if (years > 0) {
    if (months > 0) {
      return `${years}y ${months}m`;
    }
    return `${years} year${years > 1 ? 's' : ''}`;
  } else if (months > 0) {
    if (remainingDays > 0) {
      return `${months}m ${remainingDays}d`;
    }
    return `${months} month${months > 1 ? 's' : ''}`;
  } else {
    return `${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
  }
};

// Function to convert image to base64 for PDF
const getLogoBase64 = async (): Promise<string | null> => {
  try {
    const response = await fetch('./kisiischool_logo.png');
    if (!response.ok) {
      console.warn('Could not load school logo');
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Error loading school logo:', error);
    return null;
  }
};

// Function to get Tamnet logo for watermark
const getTamnetLogoBase64 = async (): Promise<string | null> => {
  try {
    const response = await fetch('./Tamnet Logo.png');
    if (!response.ok) {
      console.warn('Could not load Tamnet logo');
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Error loading Tamnet logo:', error);
    return null;
  }
};

// Helper function to calculate proportional column widths
const calculateColumnWidths = (proportions: number[], totalWidth: number): number[] => {
  const totalParts = proportions.reduce((sum, part) => sum + part, 0);
  return proportions.map(part => Math.floor((part / totalParts) * totalWidth));
};

// Helper function to truncate text with ellipsis
const truncateText = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (!text || text === null || text === undefined) return '';
  
  const textStr = String(text).trim(); // Convert to string and trim whitespace
  
  if (!textStr || maxWidth <= 0) return '';
  
  if (doc.getTextWidth(textStr) <= maxWidth) {
    return textStr;
  }
  
  let truncated = textStr;
  const ellipsis = '...';
  
  while (doc.getTextWidth(truncated + ellipsis) > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  
  return truncated.length > 0 ? truncated + ellipsis : '';
};

// Enhanced Professional PDF generation
const generateSimplePDF = async (data: any, title: string, reportType: string): Promise<Blob> => {
  try {
    console.log('Starting generateSimplePDF...');
    console.log('Creating jsPDF instance...');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = 20;

    console.log('PDF dimensions:', { pageWidth, pageHeight, margin, contentWidth });

    // Load logos
    console.log('Loading logos...');
    const logoBase64 = await getLogoBase64();
    const tamnetLogoBase64 = await getTamnetLogoBase64();
    console.log('Logos loaded:', { hasLogo: !!logoBase64, hasTamnetLogo: !!tamnetLogoBase64 });

    // Function to add header to each page
    const addHeader = () => {
      // Skip header background to avoid potential rendering issues in compiled app
      // doc.setFillColor(248, 250, 252);
      // doc.rect(0, 0, pageWidth, 55, 'F');

      // Add school logo if available
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'PNG', margin, 12, 30, 30);
          
          // School name and title
          doc.setTextColor(31, 41, 55);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('KISII SCHOOL LIBRARY', margin + 35, 22);

          doc.setFontSize(12);
          doc.setFont('helvetica', 'normal');
          doc.text(title.toUpperCase(), margin + 35, 32);
        } catch (error) {
          console.warn('Error adding logo:', error);
          // Fallback header
          doc.setTextColor(31, 41, 55);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('KISII SCHOOL LIBRARY', margin, 22);
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'normal');
          doc.text(title.toUpperCase(), margin, 32);
        }
      } else {
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('KISII SCHOOL LIBRARY', margin, 22);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(title.toUpperCase(), margin, 32);
      }

      // Generation date and page number
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 80, 22);
      
      // Skip watermark to avoid opacity issues in compiled Tauri app
      // The opacity-based watermark causes visibility issues in production builds
    };

    // Function to check if new page is needed
    const checkNewPage = (requiredHeight: number = 20) => {
      if (yPosition + requiredHeight > pageHeight - 30) {
        doc.addPage();
        addHeader();
        yPosition = 65;
        return true;
      }
      return false;
    };

    // Function to add professional table
    const addTable = (headers: string[], rows: any[][], columnWidths: number[]) => {
      const rowHeight = 8;
      const headerHeight = 12; // Increased header height for better visibility
      
      console.log(`Adding table with ${rows.length} rows`);
      console.log('Headers:', headers);
      console.log('Headers length:', headers.length);
      console.log('Column widths:', columnWidths);
      console.log('Column widths length:', columnWidths.length);
      
      // Validate inputs
      if (!headers || headers.length === 0) {
        console.error('No headers provided to addTable function');
        return;
      }
      
      if (!columnWidths || columnWidths.length !== headers.length) {
        console.error('Column widths length does not match headers length');
        return;
      }
      
      checkNewPage(headerHeight + Math.min(rows.length * rowHeight, 100));
      
      // Table header - simplified styling to avoid rendering issues
      doc.setTextColor(31, 41, 55); // Dark text instead of white on blue
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      
      let xPos = margin;
      
      console.log('Drawing simplified header...');
      // Skip header backgrounds to avoid potential rendering issues
      // for (let i = 0; i < headers.length; i++) {
      //   console.log(`Drawing header background ${i}: x=${xPos}, y=${yPosition}, width=${columnWidths[i]}, height=${headerHeight}`);
      //   doc.rect(xPos, yPosition, columnWidths[i], headerHeight, 'F');
      //   xPos += columnWidths[i];
      // }
      
      console.log('Adding header text...');
      // Add all header text with proper positioning
      xPos = margin;
      for (let i = 0; i < headers.length; i++) {
        const headerText = truncateText(doc, headers[i] || '', columnWidths[i] - 6);
        const textX = xPos + 2;
        const textY = yPosition + 8; // Simplified positioning
        console.log(`Adding header text ${i}: "${headerText}" at x=${textX}, y=${textY}`);
        doc.text(headerText, textX, textY);
        xPos += columnWidths[i];
      }
      
      yPosition += headerHeight;
      
      // Table rows
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7); // Reduced from 8 to 7
      
      rows.forEach((row, rowIndex) => {
        if (checkNewPage(rowHeight)) {
          // Re-add header on new page with simplified styling
          doc.setTextColor(31, 41, 55);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          
          // Skip header backgrounds on new pages too
          // Add header text only
          xPos = margin;
          for (let i = 0; i < headers.length; i++) {
            const headerText = truncateText(doc, headers[i] || '', columnWidths[i] - 6);
            doc.text(headerText, xPos + 2, yPosition + 8);
            xPos += columnWidths[i];
          }
          
          yPosition += headerHeight;
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
        }
        
        // Skip alternating row colors to avoid rendering issues
        // if (rowIndex % 2 === 0) {
        //   doc.setFillColor(248, 250, 252);
        //   doc.rect(margin, yPosition, contentWidth, rowHeight, 'F');
        // }
        
        xPos = margin;
        row.forEach((cell, i) => {
          const cellText = truncateText(doc, cell || '', columnWidths[i] - 4);
          doc.text(cellText, xPos + 2, yPosition + 6);
          xPos += columnWidths[i];
        });
        
        yPosition += rowHeight;
      });
      
      yPosition += 10; // Space after table
    };

    // Add initial header
    addHeader();
    yPosition = 65;

    // Report metadata
    if (data.reportPeriod) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(`Report Period: ${data.reportPeriod}`, margin, yPosition);
      yPosition += 15;
    }

    // Generate content based on report type - COMPREHENSIVE COVERAGE
    console.log('Generating content for report type:', reportType);
    
    if (reportType === 'borrowing_history' && data.borrowings) {
      const headers = ['Book Title', 'Admission No.', 'Student Name', 'Class/Grade', 'Date Borrowed', 'Due Date', 'Status'];
      const columnWidths = calculateColumnWidths([40, 25, 30, 20, 25, 25, 20], contentWidth);
      
      console.log('Borrowing history headers:', headers);
      console.log('Column widths:', columnWidths);
      console.log('Total width:', columnWidths.reduce((a, b) => a + b, 0));
      console.log('Content width:', contentWidth);
      
      const rows = data.borrowings.map((b: any) => [
        b.book_title || b.books?.title || 'Unknown',
        b.admission_number || b.students?.admission_number || 'N/A',
        `${b.student_name || b.students?.first_name || 'Unknown'} ${b.students?.last_name || ''}`.trim(),
        b.class_grade || b.students?.class_grade || 'N/A',
        b.borrowed_date ? new Date(b.borrowed_date).toLocaleDateString() : 'N/A',
        b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A',
        b.status || 'Active'
      ]);
      
      console.log('Sample row:', rows[0]);
      addTable(headers, rows, columnWidths);
    }
    
    else if (reportType === 'overdue_books' && data.overdueBooks) {
      const headers = ['Book Title', 'Borrower Name', 'Due Date', 'Days Overdue', 'Fine Amount'];
      const columnWidths = calculateColumnWidths([55, 45, 30, 25, 30], contentWidth);
      
      const rows = data.overdueBooks.map((b: any) => [
        b.book_title || b.books?.title || 'Unknown',
        b.borrower_name || `${b.students?.first_name || b.staff?.first_name || 'Unknown'} ${b.students?.last_name || b.staff?.last_name || ''}`.trim(),
        b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A',
        formatDaysOverdue(b.days_overdue || 0),
        `KSh ${b.fine_amount || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }
    
    else if (reportType === 'popular_books' && data.popularBooks) {
      const headers = ['Book Title', 'Author Name', 'Times Borrowed', 'Category', 'Availability'];
      const columnWidths = calculateColumnWidths([50, 40, 25, 30, 30], contentWidth);
      
      const rows = data.popularBooks.map((b: any) => [
        b.book?.title || b.title || 'Unknown',
        b.book?.author || b.author || 'Unknown',
        b.borrowCount?.toString() || b.borrow_count?.toString() || '0',
        b.book?.categories?.name || b.book?.category || b.category || 'General',
        b.book?.available_copies ? `${b.book.available_copies} available` : 'N/A'
      ]);
      
      addTable(headers, rows, columnWidths);
    }
    
    else if (reportType === 'student_activity' && data.studentActivity) {
      const headers = ['Admission No.', 'Student Name', 'Class/Grade', 'Books Borrowed', 'Active Loans', 'Overdue Books', 'Total Fines'];
      const columnWidths = calculateColumnWidths([25, 35, 20, 25, 25, 20, 25], contentWidth);
      
      const rows = data.studentActivity.map((s: any) => [
        s.admission_number || 'N/A',
        `${s.first_name || 'Unknown'} ${s.last_name || ''}`.trim(),
        s.class_grade || 'N/A',
        s.total_borrowed?.toString() || '0',
        s.active_loans?.toString() || '0',
        s.overdue_count?.toString() || '0',
        `KSh ${s.total_fines || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }
    
    else if (reportType === 'fine_collection' && data.fines) {
      const headers = ['Borrower Name', 'Book Title', 'Fine Type', 'Amount', 'Date Created', 'Payment Status'];
      const columnWidths = calculateColumnWidths([40, 45, 25, 20, 25, 20], contentWidth);
      
      const rows = data.fines.map((f: any) => [
        f.borrower_name || `${f.students?.first_name || f.staff?.first_name || 'Unknown'} ${f.students?.last_name || f.staff?.last_name || ''}`.trim(),
        f.book_title || f.books?.title || 'Unknown',
        f.fine_type || 'Late Return',
        `KSh ${f.amount || 0}`,
        f.created_at ? new Date(f.created_at).toLocaleDateString() : 'N/A',
        f.status || 'Unpaid'
      ]);
      
      addTable(headers, rows, columnWidths);
    }
    
    else if (reportType === 'lost_books' && data.lostBooks) {
      const headers = ['Book Title', 'Author Name', 'Admission No.', 'Student Name', 'Class/Grade', 'Date Lost', 'Replacement Cost'];
      const columnWidths = calculateColumnWidths([40, 30, 25, 30, 20, 25, 25], contentWidth);
      
      const rows = data.lostBooks.map((b: any) => [
        b.book_title || b.books?.title || 'Unknown',
        b.book_author || b.books?.author || 'Unknown',
        b.admission_number || b.students?.admission_number || 'N/A',
        b.student_name || `${b.students?.first_name || 'Unknown'} ${b.students?.last_name || ''}`.trim(),
        b.class_grade || b.students?.class_grade || 'N/A',
        b.date_lost ? new Date(b.date_lost).toLocaleDateString() : 'N/A',
        `KSh ${b.replacement_cost || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'theft_reports' && data.theftReports) {
      const headers = ['Book Title', 'Reported By', 'Date Reported', 'Investigation Status', 'Investigation Notes'];
      const columnWidths = calculateColumnWidths([45, 35, 25, 20, 60], contentWidth);
      
      const rows = data.theftReports.map((t: any) => [
        t.book_title || t.books?.title || 'Unknown',
        t.reported_by || 'Unknown',
        t.date_reported ? new Date(t.date_reported).toLocaleDateString() : 'N/A',
        t.status || 'Open',
        t.notes || 'No notes'
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'group_borrowings' && data.groupBorrowings) {
      const headers = ['Group ID', 'Class Name', 'Book Title', 'Date Borrowed', 'Due Date', 'Loan Status'];
      const columnWidths = calculateColumnWidths([25, 30, 50, 30, 30, 20], contentWidth);
      
      const rows = data.groupBorrowings.map((g: any) => [
        g.group_id || 'N/A',
        g.class_name || 'Unknown',
        g.book_title || g.books?.title || 'Unknown',
        g.borrowed_date ? new Date(g.borrowed_date).toLocaleDateString() : 'N/A',
        g.due_date ? new Date(g.due_date).toLocaleDateString() : 'N/A',
        g.status || 'Active'
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'library_summary' && data.summary) {
      // Executive summary with multiple sections
      const summaryData = data.summary;
      
      // Books summary
      if (summaryData.books) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('BOOKS COLLECTION SUMMARY', margin, yPosition);
        yPosition += 15;
        
        const bookHeaders = ['Category', 'Total Books', 'Available', 'Borrowed', 'Lost/Damaged'];
        const bookWidths = calculateColumnWidths([40, 30, 30, 30, 35], contentWidth);
        const bookRows = summaryData.books.map((b: any) => [
          b.category || 'Unknown',
          b.total?.toString() || '0',
          b.available?.toString() || '0',
          b.borrowed?.toString() || '0',
          b.lost_damaged?.toString() || '0'
        ]);
        
        addTable(bookHeaders, bookRows, bookWidths);
      }
      
      // Students summary
      if (summaryData.students) {
        checkNewPage(50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('STUDENT ACTIVITY SUMMARY', margin, yPosition);
        yPosition += 15;
        
        const studentHeaders = ['Class', 'Total Students', 'Active Borrowers', 'Overdue Books', 'Total Fines'];
        const studentWidths = calculateColumnWidths([30, 35, 35, 35, 30], contentWidth);
        const studentRows = summaryData.students.map((s: any) => [
          s.class_grade || 'Unknown',
          s.total_students?.toString() || '0',
          s.active_borrowers?.toString() || '0',
          s.overdue_books?.toString() || '0',
          `KSh ${s.total_fines || 0}`
        ]);
        
        addTable(studentHeaders, studentRows, studentWidths);
      }
    }

    else if (reportType === 'staff_overdue_books' && data.overdueBooks) {
      const headers = ['Staff Name', 'Department', 'Position', 'Book Title', 'Due Date', 'Days Overdue', 'Fine Amount'];
      const columnWidths = calculateColumnWidths([35, 25, 25, 40, 25, 20, 25], contentWidth);
      
      const rows = data.overdueBooks.map((b: any) => [
        `${b.staff?.first_name || 'Unknown'} ${b.staff?.last_name || 'Staff'}`.trim(),
        b.staff?.department || 'General',
        b.staff?.position || 'N/A',
        b.book_title || 'Unknown Book',
        b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A',
        formatDaysOverdue(b.days_overdue || 0),
        `KSh ${b.fine_amount || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'staff_activity' && data.staffActivity) {
      const headers = ['Staff Name', 'Department', 'Books Borrowed', 'Active Loans', 'Overdue Books', 'Total Fines'];
      const columnWidths = calculateColumnWidths([40, 30, 25, 25, 20, 25], contentWidth);
      
      const rows = data.staffActivity.map((s: any) => [
        `${s.staff?.first_name || s.first_name || 'Unknown'} ${s.staff?.last_name || s.last_name || ''}`.trim(),
        s.staff?.department || s.department || 'N/A',
        s.total_borrowings?.toString() || s.total_borrowed?.toString() || '0',
        s.active_borrowings?.toString() || s.active_loans?.toString() || '0',
        s.overdue_borrowings?.toString() || s.overdue_count?.toString() || '0',
        `KSh ${s.total_fines || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'staff_borrowing_trends' && data.staffTrends) {
      const headers = ['Date', 'Total Borrowings', 'Unique Staff', 'Returned Same Day', 'Avg Duration (Days)'];
      const columnWidths = calculateColumnWidths([30, 30, 25, 30, 35], contentWidth);
      
      const rows = data.staffTrends.map((t: any) => [
        t.date ? new Date(t.date).toLocaleDateString() : 'N/A',
        t.total_borrowings?.toString() || '0',
        t.unique_staff?.toString() || '0',
        t.returned_same_day?.toString() || '0',
        t.avg_duration_days ? t.avg_duration_days.toFixed(1) : '0.0'
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'staff_most_borrowed' && data.staffMostBorrowed) {
      const headers = ['Book Title', 'Author', 'Borrow Count', 'Unique Staff Borrowers', 'Last Borrowed'];
      const columnWidths = calculateColumnWidths([50, 40, 25, 35, 30], contentWidth);
      
      const rows = data.staffMostBorrowed.map((b: any) => [
        b.book_title || 'Unknown Book',
        b.book_author || 'Unknown Author',
        b.borrow_count?.toString() || '0',
        b.unique_staff_borrowers?.toString() || '0',
        b.last_borrowed ? new Date(b.last_borrowed).toLocaleDateString() : 'N/A'
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'staff_borrowing_history' && data.staffHistory) {
      const headers = ['Staff Name', 'Department', 'Book Title', 'Borrowed Date', 'Due Date', 'Status', 'Days Overdue'];
      const columnWidths = calculateColumnWidths([35, 25, 40, 25, 25, 20, 25], contentWidth);
      
      const rows = data.staffHistory.map((h: any) => [
        `${h.staff_first_name || 'Unknown'} ${h.staff_last_name || 'Staff'}`.trim(),
        h.department || 'General',
        h.book_title || 'Unknown Book',
        h.borrowed_date ? new Date(h.borrowed_date).toLocaleDateString() : 'N/A',
        h.due_date ? new Date(h.due_date).toLocaleDateString() : 'N/A',
        h.status || 'Active',
        h.days_overdue ? formatDaysOverdue(h.days_overdue) : '0 days'
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'class_borrowing_report' && data.classBorrowing) {
      const headers = ['Class Grade', 'Total Students', 'Total Borrowings', 'Active Borrowings', 'Overdue Borrowings'];
      const columnWidths = calculateColumnWidths([30, 30, 35, 35, 35], contentWidth);
      
      const rows = data.classBorrowing.map((c: any) => [
        c.class_grade || 'Unknown Class',
        c.total_students?.toString() || '0',
        c.total_borrowings?.toString() || '0',
        c.active_borrowings?.toString() || '0',
        c.overdue_borrowings?.toString() || '0'
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'book_suppliers' && data.suppliers) {
      const headers = ['Supplier Name', 'Books Supplied', 'Book Categories', 'Total Copies', 'Total Value'];
      const columnWidths = calculateColumnWidths([45, 25, 40, 25, 30], contentWidth);
      
      const rows = data.suppliers.map((s: any) => [
        s.supplier_name || 'Unknown',
        s.books_count?.toString() || '0',
        s.categories || 'N/A',
        s.total_copies?.toString() || '0',
        `KSh ${s.total_value || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    // If no specific data found, try to create a generic table from available data
    else {
      // Try to find any array data that could be displayed as a table
      const dataKeys = Object.keys(data);
      const arrayData = dataKeys.find(key => Array.isArray(data[key]) && data[key].length > 0);
      
      if (arrayData && data[arrayData].length > 0) {
        // Create generic table from first array found
        const items = data[arrayData];
        const firstItem = items[0];
        
        if (typeof firstItem === 'object' && firstItem !== null) {
          // Generate headers from object keys
          const headers = Object.keys(firstItem).map(key => 
            key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          );
          const columnWidths = headers.map(() => Math.floor(contentWidth / headers.length));
          
          // Generate rows from data
          const rows = items.slice(0, 50).map((item: any) => 
            Object.keys(firstItem).map(key => {
              const value = item[key];
              if (value === null || value === undefined) return 'N/A';
              if (typeof value === 'object') return JSON.stringify(value).substring(0, 20) + '...';
              return value.toString();
            })
          );
          
          addTable(headers, rows, columnWidths);
        } else {
          // Simple array of primitives
          const headers = ['Value'];
          const columnWidths = [contentWidth];
          const rows = items.slice(0, 50).map((item: any) => [item?.toString() || 'N/A']);
          
          addTable(headers, rows, columnWidths);
        }
      } else {
        // No data available message
        doc.setFontSize(12);
        doc.setTextColor(107, 114, 128);
        doc.text('No data available for this report type.', margin, yPosition);
        doc.text(`Report Type: ${reportType}`, margin, yPosition + 15);
        doc.text(`Available Data Keys: ${Object.keys(data).join(', ')}`, margin, yPosition + 30);
      }
    }

    // Footer on all pages
    console.log('Adding footers to pages...');
    const totalPages = (doc as any).getNumberOfPages();
    console.log('Total pages:', totalPages);
    
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text('Powered by Tamnet Systems', margin, pageHeight - 10);
      doc.text(`© ${new Date().getFullYear()} Kisii School Library`, pageWidth - 80, pageHeight - 10);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 20);
    }

    console.log('Generating PDF blob...');
    const blob = doc.output('blob');
    console.log('PDF blob generated successfully, size:', blob.size, 'bytes');
    
    return blob;
    
  } catch (error) {
    console.error('Error in generateSimplePDF:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Function to save PDF to downloads folder and show options
const savePDFToDownloads = async (pdfBlob: Blob, filename: string): Promise<string> => {
  try {
    // Get downloads directory
    const downloadsPath = await downloadDir();
    const fullPath = `${downloadsPath}${filename}`;
    
    // Convert blob to array buffer
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Write file using Tauri
    await invoke('write_file', {
      path: fullPath,
      contents: Array.from(uint8Array)
    });
    
    console.log('PDF saved to:', fullPath);
    return fullPath;
  } catch (error) {
    console.error('Error saving PDF to downloads:', error);
    throw error;
  }
};

// Function to show download notification with options
const showDownloadNotification = (filePath: string, filename: string) => {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    max-width: 400px;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: start; gap: 12px;">
      <div style="flex-shrink: 0; width: 40px; height: 40px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <svg width="20" height="20" fill="white" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
      </div>
      <div style="flex: 1;">
        <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #111827;">PDF Generated Successfully!</h3>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">${filename}</p>
        <div style="display: flex; gap: 8px;">
          <button id="openFile" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 500;">
            Open File
          </button>
          <button id="openFolder" style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 500;">
            Go to Folder
          </button>
          <button id="closeNotification" style="background: transparent; color: #6b7280; border: 1px solid #d1d5db; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer;">
            Close
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Add event listeners
  const openFileBtn = notification.querySelector('#openFile') as HTMLButtonElement;
  const openFolderBtn = notification.querySelector('#openFolder') as HTMLButtonElement;
  const closeBtn = notification.querySelector('#closeNotification') as HTMLButtonElement;
  
  openFileBtn.addEventListener('click', async () => {
    try {
      await invoke('open_file', { path: filePath });
      document.body.removeChild(notification);
    } catch (error) {
      console.error('Error opening file:', error);
      alert('Could not open file. Please check your downloads folder.');
    }
  });
  
  openFolderBtn.addEventListener('click', async () => {
    try {
      const downloadsPath = await downloadDir();
      await invoke('open_folder', { path: downloadsPath });
      document.body.removeChild(notification);
    } catch (error) {
      console.error('Error opening folder:', error);
      alert('Could not open downloads folder.');
    }
  });
  
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(notification);
  });
  
  // Auto-close after 10 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 10000);
};

// Main export function
export const generatePDFReport = async (data: any, title: string, reportType: string): Promise<void> => {
  try {
    console.log('=== PDF GENERATION START ===');
    console.log('Title:', title);
    console.log('Report Type:', reportType);
    console.log('Data Keys:', Object.keys(data || {}));
    
    // Validate inputs
    if (!data) {
      throw new Error('No data provided for PDF generation');
    }
    
    if (!title) {
      throw new Error('No title provided for PDF generation');
    }
    
    if (!reportType) {
      throw new Error('No report type provided for PDF generation');
    }
    
    console.log('Calling generateSimplePDF...');
    const pdfBlob = await generateSimplePDF(data, title, reportType);
    console.log('PDF blob created:', pdfBlob);
    
    if (!pdfBlob) {
      throw new Error('Failed to generate PDF blob');
    }
    
    // Clean filename
    const cleanTitle = title.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${cleanTitle}_${timestamp}.pdf`;
    
    console.log('Saving PDF to downloads folder...');
    const filePath = await savePDFToDownloads(pdfBlob, filename);
    
    console.log('=== PDF GENERATION SUCCESS ===');
    
    // Clear data references to prevent memory leaks
    data = null;
    
    // Force garbage collection if available
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }
    
    // Show download notification with options
    showDownloadNotification(filePath, filename);
    
    // Small delay to ensure UI updates before cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
  } catch (error) {
    console.error('=== PDF GENERATION ERROR ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Clear any data references on error
    data = null;
    
    // Show error notification
    if (typeof window !== 'undefined' && window.alert) {
      alert(`Failed to generate PDF report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    throw error;
  }
};
