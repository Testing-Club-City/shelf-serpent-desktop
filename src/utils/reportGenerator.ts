import { invoke } from '@tauri-apps/api/core';
import { downloadDir } from '@tauri-apps/api/path';
import jsPDF from 'jspdf';

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

// Helper function to truncate text with ellipsis
const truncateText = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (!text) return '';
  const textStr = text.toString();
  
  if (doc.getTextWidth(textStr) <= maxWidth) {
    return textStr;
  }
  
  let truncated = textStr;
  while (doc.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  
  return truncated + '...';
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
      // Professional header background
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, pageWidth, 55, 'F');

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
      
      // Add Tamnet watermark
      if (tamnetLogoBase64) {
        try {
          const centerX = pageWidth / 2;
          const centerY = pageHeight / 2;
          doc.saveGraphicsState();
          doc.setGState(new doc.GState({ opacity: 0.08 }));
          doc.addImage(tamnetLogoBase64, 'PNG', centerX - 60, centerY - 60, 120, 120);
          doc.restoreGraphicsState();
        } catch (error) {
          console.warn('Error adding watermark:', error);
        }
      }
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
      const headerHeight = 10;
      
      console.log(`Adding table with ${rows.length} rows`);
      
      checkNewPage(headerHeight + Math.min(rows.length * rowHeight, 100));
      
      // Table header
      doc.setFillColor(59, 130, 246); // Blue header
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      let xPos = margin;
      headers.forEach((header, i) => {
        doc.rect(xPos, yPosition, columnWidths[i], headerHeight, 'F');
        doc.text(truncateText(doc, header, columnWidths[i] - 4), xPos + 2, yPosition + 7);
        xPos += columnWidths[i];
      });
      
      yPosition += headerHeight;
      
      // Table rows
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      rows.forEach((row, rowIndex) => {
        if (checkNewPage(rowHeight)) {
          // Re-add header on new page
          doc.setFillColor(59, 130, 246);
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          
          xPos = margin;
          headers.forEach((header, i) => {
            doc.rect(xPos, yPosition, columnWidths[i], headerHeight, 'F');
            doc.text(truncateText(doc, header, columnWidths[i] - 4), xPos + 2, yPosition + 7);
            xPos += columnWidths[i];
          });
          
          yPosition += headerHeight;
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
        }
        
        // Alternate row colors
        if (rowIndex % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, yPosition, contentWidth, rowHeight, 'F');
        }
        
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
      const headers = ['Book Title', 'Student Name', 'Class/Grade', 'Date Borrowed', 'Due Date', 'Status'];
      const columnWidths = [50, 40, 20, 25, 25, 25];
      
      const rows = data.borrowings.map((b: any) => [
        b.book_title || b.books?.title || 'Unknown',
        `${b.student_name || b.students?.first_name || 'Unknown'} ${b.students?.last_name || ''}`.trim(),
        b.class_grade || b.students?.class_grade || 'N/A',
        b.borrowed_date ? new Date(b.borrowed_date).toLocaleDateString() : 'N/A',
        b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A',
        b.status || 'Active'
      ]);
      
      addTable(headers, rows, columnWidths);
    }
    
    else if (reportType === 'overdue_books' && data.overdueBooks) {
      const headers = ['Book Title', 'Borrower Name', 'Due Date', 'Days Overdue', 'Fine Amount'];
      const columnWidths = [55, 45, 30, 25, 30];
      
      const rows = data.overdueBooks.map((b: any) => [
        b.book_title || b.books?.title || 'Unknown',
        b.borrower_name || `${b.students?.first_name || b.staff?.first_name || 'Unknown'} ${b.students?.last_name || b.staff?.last_name || ''}`.trim(),
        b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A',
        b.days_overdue?.toString() || '0',
        `KSh ${b.fine_amount || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }
    
    else if (reportType === 'popular_books' && data.popularBooks) {
      const headers = ['Book Title', 'Author Name', 'Times Borrowed', 'Category', 'Availability'];
      const columnWidths = [50, 40, 25, 30, 30];
      
      const rows = data.popularBooks.map((b: any) => [
        b.title || 'Unknown',
        b.author || 'Unknown',
        b.borrow_count?.toString() || '0',
        b.category || 'N/A',
        b.available_copies ? `${b.available_copies} available` : 'N/A'
      ]);
      
      addTable(headers, rows, columnWidths);
    }
    
    else if (reportType === 'student_activity' && data.studentActivity) {
      const headers = ['Student Name', 'Class/Grade', 'Books Borrowed', 'Active Loans', 'Overdue Books', 'Total Fines'];
      const columnWidths = [40, 20, 25, 25, 20, 25];
      
      const rows = data.studentActivity.map((s: any) => [
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
      const columnWidths = [40, 45, 25, 20, 25, 20];
      
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
      const headers = ['Book Title', 'Author Name', 'Student Name', 'Class/Grade', 'Date Lost', 'Replacement Cost'];
      const columnWidths = [45, 35, 35, 20, 25, 25];
      
      const rows = data.lostBooks.map((b: any) => [
        b.book_title || b.books?.title || 'Unknown',
        b.book_author || b.books?.author || 'Unknown',
        b.student_name || `${b.students?.first_name || 'Unknown'} ${b.students?.last_name || ''}`.trim(),
        b.class_grade || b.students?.class_grade || 'N/A',
        b.date_lost ? new Date(b.date_lost).toLocaleDateString() : 'N/A',
        `KSh ${b.replacement_cost || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'theft_reports' && data.theftReports) {
      const headers = ['Book Title', 'Reported By', 'Date Reported', 'Investigation Status', 'Investigation Notes'];
      const columnWidths = [45, 35, 25, 20, 60];
      
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
      const columnWidths = [25, 30, 50, 30, 30, 20];
      
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
        const bookWidths = [40, 30, 30, 30, 35];
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
        const studentWidths = [30, 35, 35, 35, 30];
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

    else if (reportType === 'staff_activity' && data.staffActivity) {
      const headers = ['Staff Name', 'Department', 'Books Borrowed', 'Active Loans', 'Overdue Books', 'Total Fines'];
      const columnWidths = [40, 30, 25, 25, 20, 25];
      
      const rows = data.staffActivity.map((s: any) => [
        `${s.first_name || 'Unknown'} ${s.last_name || ''}`.trim(),
        s.department || 'N/A',
        s.total_borrowed?.toString() || '0',
        s.active_loans?.toString() || '0',
        s.overdue_count?.toString() || '0',
        `KSh ${s.total_fines || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    else if (reportType === 'book_suppliers' && data.suppliers) {
      const headers = ['Supplier Name', 'Books Supplied', 'Book Categories', 'Total Copies', 'Total Value'];
      const columnWidths = [45, 25, 40, 25, 30];
      
      const rows = data.suppliers.map((s: any) => [
        s.supplier_name || 'Unknown',
        s.books_count?.toString() || '0',
        s.categories || 'N/A',
        s.total_copies?.toString() || '0',
        `KSh ${s.total_value || 0}`
      ]);
      
      addTable(headers, rows, columnWidths);
    }

    // If no specific data found, show a message
    else {
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.text('No data available for this report type.', margin, yPosition);
      doc.text(`Report Type: ${reportType}`, margin, yPosition + 15);
      doc.text(`Available Data Keys: ${Object.keys(data).join(', ')}`, margin, yPosition + 30);
    }

    // Footer on all pages
    console.log('Adding footers to pages...');
    const totalPages = doc.getNumberOfPages();
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
