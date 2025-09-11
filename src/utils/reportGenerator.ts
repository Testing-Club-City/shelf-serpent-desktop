import { invoke } from '@tauri-apps/api/core';
import { downloadDir } from '@tauri-apps/api/path';
import jsPDF from 'jspdf';

// Function to convert image to base64 for PDF
const getLogoBase64 = async (): Promise<string | null> => {
  try {
    // Try to load the logo from the workspace
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

// Enhanced Professional PDF generation without autoTable dependency
const generateSimplePDF = async (data: any, title: string, reportType: string): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Load school logo
  const logoBase64 = await getLogoBase64();

  // Professional header with school logo and branding
  doc.setFillColor(248, 250, 252); // Light gray background
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Add school logo if available
  if (logoBase64) {
    try {
      // Add logo on the left side (30x30 size)
      doc.addImage(logoBase64, 'PNG', 15, 12, 25, 25);

      // School name next to logo
      doc.setTextColor(31, 41, 55); // Dark gray
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('KISII SCHOOL LIBRARY', 45, 22);

      // Report title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(title.toUpperCase(), 45, 35);
    } catch (error) {
      console.warn('Error adding logo to PDF:', error);
      // Fallback to text-only header
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('KISII SCHOOL LIBRARY', 20, 22);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(title.toUpperCase(), 20, 35);
    }
  } else {
    // Text-only header if logo not available
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('KISII SCHOOL LIBRARY', 20, 22);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(title.toUpperCase(), 20, 35);
  }

  // Generation date only (no time)
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // Medium gray
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 80, 22);

  // Reset text color for body
  doc.setTextColor(0, 0, 0);
  yPosition = 60;

  // Helper function to add professional section headers
  const addSectionHeader = (text: string) => {
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFillColor(229, 231, 235); // Professional gray
    doc.rect(15, yPosition - 5, pageWidth - 30, 15, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55); // Dark professional color
    doc.text(text.toUpperCase(), 20, yPosition + 5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    yPosition += 25;
  };

  // Helper function to add a data row with alternating background
  const addDataRow = (label: string, value: string, isAlternate = false) => {
    if (yPosition > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
    }

    if (isAlternate) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, yPosition - 3, pageWidth - 30, 12, 'F');
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', 20, yPosition + 5);
    doc.setFont('helvetica', 'normal');

    // Wrap long text
    const maxWidth = pageWidth - 100;
    const wrappedText = doc.splitTextToSize(value, maxWidth);
    doc.text(wrappedText, 80, yPosition + 5);

    yPosition += Math.max(12, wrappedText.length * 6);
  };

  // Helper function to create a professional table
  const addTable = (headers: string[], rows: string[][], title?: string) => {
    if (title) {
      addSectionHeader(title);
    }

    const colWidth = (pageWidth - 40) / headers.length;
    const rowHeight = 12;

    // Table headers
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(37, 99, 235);
    doc.rect(20, yPosition, pageWidth - 40, rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    headers.forEach((header, index) => {
      doc.text(header, 22 + (index * colWidth), yPosition + 8);
    });

    yPosition += rowHeight;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Table rows
    rows.forEach((row, rowIndex) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }

      // Alternating row colors
      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(20, yPosition, pageWidth - 40, rowHeight, 'F');
      }

      row.forEach((cell, colIndex) => {
        const cellText = doc.splitTextToSize(cell, colWidth - 4);
        doc.text(cellText, 22 + (colIndex * colWidth), yPosition + 8);
      });

      yPosition += rowHeight;
    });

    yPosition += 10;
  };

  // Generate content based on report type
  switch (reportType) {
    case 'library_summary':
      const { totalBooks, totalBorrowings, activeBorrowings, overdueCount, popularBooks, recentBorrowings } = data;

      // Summary Statistics Section (no redundant header)
      doc.setFillColor(248, 250, 252); // Professional light background
      doc.rect(20, yPosition - 5, pageWidth - 40, 60, 'F');

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55); // Professional dark color

      doc.text(`${totalBooks || 0}`, 30, yPosition + 10);
      doc.text(`${totalBorrowings || 0}`, 30, yPosition + 25);
      doc.text(`${activeBorrowings || 0}`, 30, yPosition + 40);
      doc.text(`${overdueCount || 0}`, 30, yPosition + 55);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      doc.text('Total Books in Library', 80, yPosition + 10);
      doc.text('Total Borrowings (All Time)', 80, yPosition + 25);
      doc.text('Currently Active Borrowings', 80, yPosition + 40);
      doc.text('Overdue Books', 80, yPosition + 55);

      yPosition += 75;

      // Popular Books Table
      if (popularBooks && popularBooks.length > 0) {
        const popularRows = popularBooks.map((item: any, index: number) => [
          `${index + 1}`,
          item.book?.title || 'Unknown Book',
          item.book?.author || 'Unknown Author',
          `${item.borrowCount || 0}`
        ]);

        addTable(['Rank', 'Book Title', 'Author', 'Times Borrowed'], popularRows, 'MOST POPULAR BOOKS');
      }

      // Recent Borrowings Table
      if (recentBorrowings && recentBorrowings.length > 0) {
        const recentRows = recentBorrowings.map((item: any) => [
          item.student?.class_grade || 'Unknown Class',
          item.student?.first_name && item.student?.last_name
            ? `${item.student.first_name} ${item.student.last_name}`
            : 'Unknown Student',
          item.student?.admission_number || 'N/A',
          item.book?.title || 'Unknown Book',
          item.legacy_book_id || 'N/A',
          new Date(item.borrowed_date).toLocaleDateString(),
          item.status === 'active' ? 'Active' : 'Returned'
        ]);

        addTable(['Class', 'Student Name', 'Admission No.', 'Book Title', 'Legacy Book ID', 'Borrowed Date', 'Status'], recentRows, 'RECENT BORROWING ACTIVITY');
      }
      break;

    case 'borrowing_history':
      const { borrowings, returnedBooks, studentsInvolved } = data;

      if (borrowings && borrowings.length > 0) {
        // Summary with calculated statistics
        doc.setFillColor(248, 250, 252);
        doc.rect(20, yPosition - 5, pageWidth - 40, 45, 'F');
        doc.setFontSize(12);
        doc.text(`Total Records: ${data.totalBorrowings || borrowings.length}`, 25, yPosition + 5);
        doc.text(`Active Borrowings: ${data.activeBorrowings || borrowings.filter((b: any) => b.status === 'active').length}`, 25, yPosition + 15);
        doc.text(`Returned Books: ${returnedBooks || borrowings.filter((b: any) => b.status === 'returned').length}`, 25, yPosition + 25);
        doc.text(`Students Involved: ${studentsInvolved || new Set(borrowings.map((b: any) => b.student_id).filter(id => id)).size}`, 25, yPosition + 35);
        doc.text(`Date Range: ${data.reportPeriod || 'All Time'}`, 25, yPosition + 45);
        yPosition += 55;

        const borrowingRows = borrowings.map((item: any) => [
          item.student?.class_grade || 'Unknown Class',
          item.student?.first_name && item.student?.last_name
            ? `${item.student.first_name} ${item.student.last_name}`
            : 'Unknown Student',
          item.student?.admission_number || 'N/A',
          item.book?.title || 'Unknown Book',
          item.legacy_book_id || 'N/A',
          new Date(item.borrowed_date).toLocaleDateString(),
          new Date(item.due_date).toLocaleDateString(),
          item.status === 'active' ? 'Active' :
            item.status === 'returned' ? 'Returned' :
              item.status === 'overdue' ? 'Overdue' : item.status
        ]);

        addTable(['Class', 'Student Name', 'Admission No.', 'Book Title', 'Legacy Book ID', 'Borrowed', 'Due Date', 'Status'], borrowingRows);
      } else {
        doc.setFillColor(248, 250, 252);
        doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'F');
        doc.text('No borrowing records found for the selected criteria.', 25, yPosition + 5);
      }
      break;

    case 'overdue_books':
      const { overdueBooks } = data;

      if (overdueBooks && overdueBooks.length > 0) {
        // Summary with professional styling
        doc.setFillColor(248, 250, 252);
        doc.rect(20, yPosition - 5, pageWidth - 40, 25, 'F');
        doc.setFontSize(12);
        doc.setTextColor(31, 41, 55);
        doc.text(`${overdueBooks.length} overdue books found`, 25, yPosition + 5);
        doc.setTextColor(0, 0, 0);
        doc.text(`Report generated: ${data.reportPeriod || new Date().toLocaleDateString()}`, 25, yPosition + 15);
        yPosition += 35;

        const overdueRows = overdueBooks.map((item: any) => {
          const daysOverdue = Math.floor((new Date().getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24));
          return [
            item.student?.class_grade || 'Unknown Class',
            item.student?.first_name && item.student?.last_name
              ? `${item.student.first_name} ${item.student.last_name}`
              : 'Unknown Student',
            item.student?.admission_number || 'N/A',
            item.book?.title || 'Unknown Book',
            item.legacy_book_id || 'N/A',
            new Date(item.due_date).toLocaleDateString(),
            `${daysOverdue} days`
          ];
        });

        addTable(['Class', 'Student Name', 'Admission No.', 'Book Title', 'Legacy Book ID', 'Due Date', 'Days Overdue'], overdueRows);
      } else {
        doc.setFillColor(248, 250, 252);
        doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'F');
        doc.text('No overdue books found.', 25, yPosition + 5);
      }
      break;

    case 'popular_books':
      const { popularBooks: books } = data;

      if (books && books.length > 0) {
        // Summary without redundant header
        doc.setFillColor(248, 250, 252);
        doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'F');
        doc.setFontSize(11);
        doc.text(`Showing ${books.length} books based on borrowing history`, 25, yPosition + 8);
        yPosition += 30;

        const popularRows = books.map((book: any, index: number) => {
          const rank = index + 1;

          return [
            `${rank}`,
            book.book?.title || book.title || 'Unknown Book',
            book.book?.author || book.author || 'Unknown Author',
            book.book?.category_name || book.category_name || 'General',
            `${book.borrowCount || 0}`
          ];
        });

        addTable(['Rank', 'Book Title', 'Author', 'Category', 'Times Borrowed'], popularRows);
      } else {
        doc.setFillColor(248, 250, 252);
        doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'F');
        doc.text('No popular books data available for the selected period.', 25, yPosition + 5);
      }
      break;

    case 'student_activity':
      const { studentActivity } = data;

      if (studentActivity && studentActivity.length > 0) {
        // Summary
        doc.setFillColor(248, 250, 252);
        doc.rect(20, yPosition - 5, pageWidth - 40, 25, 'F');
        doc.setFontSize(12);
        doc.text(`Total Students: ${studentActivity.length}`, 25, yPosition + 5);
        doc.text(`Report Period: ${data.reportPeriod || 'All Time'}`, 25, yPosition + 15);
        yPosition += 35;

        const studentRows = studentActivity.map((student: any, index: number) => [
          student.class_grade || 'Unknown Class',
          student.first_name && student.last_name
            ? `${student.first_name} ${student.last_name}`
            : 'Unknown Student',
          student.admission_number || 'N/A',
          `${student.totalBorrowings || student.borrowCount || 0}`,
          `${student.activeBorrowings || 0}`
        ]);

        addTable(['Class', 'Student Name', 'Admission No.', 'Total Borrowed', 'Currently Borrowed'], studentRows);
      } else {
        doc.setFillColor(248, 250, 252);
        doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'F');
        doc.text('No student activity data found for the selected criteria.', 25, yPosition + 5);
      }
      break;

    default:
      addSectionHeader(`${reportType.replace('_', ' ').toUpperCase()} REPORT`);
      doc.text('This report contains the following data:', 20, yPosition);
      yPosition += 15;

      Object.keys(data).forEach((key, index) => {
        addDataRow(key.replace('_', ' ').toUpperCase(), Array.isArray(data[key]) ? `${data[key].length} items` : String(data[key]), index % 2 === 0);
      });
  }

  // Professional footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Kisii School Library - Page ${i} of ${totalPages}`, 20, pageHeight - 8);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 80, pageHeight - 8);
  }

  return new Blob([doc.output('blob')], { type: 'application/pdf' });
};

// Professional PDF generation utility with enhanced preview
export const generatePDFReport = async (data: any, title: string, reportType: string) => {
  console.log('📊 Generating professional report:', { title, reportType, dataKeys: Object.keys(data) });

  // Show download notification
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="position: fixed; top: 20px; right: 20px; background: #2563eb; color: white; padding: 16px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; max-width: 400px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 20px; height: 20px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <div>
          <div style="font-weight: 600; margin-bottom: 4px;">Generating Report</div>
          <div style="font-size: 14px; opacity: 0.9;">${title}</div>
        </div>
      </div>
    </div>
    <style>
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  `;
  document.body.appendChild(notification);

  // Auto-remove notification after 10 seconds if something goes wrong
  const timeoutId = setTimeout(() => {
    if (notification.parentNode) {
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #dc2626; color: white; padding: 16px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; max-width: 400px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 20px;">!</div>
            <div>
              <div style="font-weight: 600; margin-bottom: 4px;">Generation Timeout</div>
              <div style="font-size: 14px; opacity: 0.9;">Please try again</div>
            </div>
          </div>
        </div>
      `;
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 3000);
    }
  }, 10000);

  try {
    // Create professional HTML document for PDF generation
    const htmlContent = generateHTMLReport(data, title, reportType);
    clearTimeout(timeoutId);

    // Try to open popup window
    const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes,resizable=yes,menubar=yes,toolbar=yes');
    if (!printWindow) {
      // Generate PDF file instead of HTML
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      const pdfBlob = await generateSimplePDF(data, title, reportType);
      const url = URL.createObjectURL(pdfBlob);

      // Set up global functions for buttons
      (window as any).__openFile = async (fileName: string) => {
        try {
          const downloadsPath = await downloadDir();
          const filePath = `${downloadsPath}${fileName}`;
          await invoke('open_file', { path: filePath });
        } catch (error) {
          console.error('Error opening file:', error);
          window.open(url, '_blank');
        }
      };

      (window as any).__openFolder = async () => {
        try {
          const downloadsPath = await downloadDir();
          await invoke('open_folder', { path: downloadsPath });
        } catch (error) {
          console.error('Error opening folder:', error);
          alert('Could not open downloads folder');
        }
      };

      // Save PDF to Downloads folder and trigger download
      try {
        const downloadsPath = await downloadDir();
        const filePath = `${downloadsPath}\\${fileName}`;

        // Convert blob to array buffer for Tauri
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Save file using Tauri
        await invoke('save_file', { path: filePath, contents: Array.from(uint8Array) });

        // Update global functions to use actual file path
        (window as any).__openFile = async () => {
          await invoke('open_file', { path: filePath });
        };

        (window as any).__openFolder = async () => {
          await invoke('open_folder', { path: downloadsPath });
        };
      } catch (error) {
        console.error('Error saving file:', error);
        // Fallback to browser download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Update notification for download
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #059669; color: white; padding: 16px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; max-width: 400px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 20px;">↓</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: 4px;">Report Downloaded</div>
              <div style="font-size: 12px; opacity: 0.8; margin-bottom: 8px;">${fileName}</div>
              <div style="display: flex; gap: 8px;">
                <button onclick="window.__openFile('${fileName}')" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">Open File</button>
                <button onclick="window.__openFolder()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">Go to Folder</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Don't revoke URL immediately so buttons can use it
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      // Remove notification after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 5000);
      return;
    }

    try {
      // Update notification for popup success
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #059669; color: white; padding: 16px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; max-width: 400px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 20px;">✓</div>
            <div>
              <div style="font-weight: 600; margin-bottom: 4px;">Report Preview Opened</div>
              <div style="font-size: 14px; opacity: 0.9;">Use Ctrl+P to print or save as PDF</div>
            </div>
          </div>
        </div>
      `;

      // Set window title
      printWindow.document.title = title;

      // Write enhanced content to popup window
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Enhanced window loading with professional features
      printWindow.onload = function () {
        // Add professional toolbar
        const toolbar = printWindow.document.createElement('div');
        toolbar.innerHTML = `
          <div style="position: fixed; top: 0; left: 0; right: 0; background: #2563eb; color: white; padding: 10px; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto;">
              <h3 style="margin: 0; font-size: 16px;">${title}</h3>
              <div>
                <button onclick="window.print()" style="background: white; color: #2563eb; border: none; padding: 8px 16px; margin-right: 8px; border-radius: 4px; cursor: pointer; font-weight: 500;">Print/Save PDF</button>
                <button onclick="window.close()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 500;">Close</button>
              </div>
            </div>
          </div>
        `;
        printWindow.document.body.insertBefore(toolbar, printWindow.document.body.firstChild);

        // Adjust body padding to account for toolbar
        printWindow.document.body.style.paddingTop = '70px';

        // Focus window and show success message
        setTimeout(() => {
          printWindow.focus();
          console.log('✅ Professional report preview opened successfully');
        }, 500);
      };

      // Remove notification after 4 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 4000);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error writing to popup window:', error);
      printWindow.close();

      // Fallback to download
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      const pdfBlob = await generateSimplePDF(data, title, reportType);
      const url = URL.createObjectURL(pdfBlob);

      // Set up global functions for buttons
      (window as any).__openFile = async (fileName: string) => {
        try {
          const downloadsPath = await downloadDir();
          const filePath = `${downloadsPath}${fileName}`;
          await invoke('open_file', { path: filePath });
        } catch (error) {
          console.error('Error opening file:', error);
          window.open(url, '_blank');
        }
      };

      (window as any).__openFolder = async () => {
        try {
          const downloadsPath = await downloadDir();
          await invoke('open_folder', { path: downloadsPath });
        } catch (error) {
          console.error('Error opening folder:', error);
          alert('Could not open downloads folder');
        }
      };

      // Update notification for download fallback
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #059669; color: white; padding: 16px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; max-width: 400px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 20px;">↓</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: 4px;">Report Downloaded</div>
              <div style="font-size: 12px; opacity: 0.8; margin-bottom: 8px;">${fileName}</div>
              <div style="display: flex; gap: 8px;">
                <button onclick="window.__openFile('${fileName}')" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">Open File</button>
                <button onclick="window.__openFolder()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">Go to Folder</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Don't revoke URL immediately so buttons can use it
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      // Remove notification after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 5000);
      return;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('PDF generation error:', error);

    // Show error notification
    notification.innerHTML = `
      <div style="position: fixed; top: 20px; right: 20px; background: #dc2626; color: white; padding: 16px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; max-width: 400px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 20px;">X</div>
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">Generation Error</div>
            <div style="font-size: 14px; opacity: 0.9;">Please try again</div>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 5000);
  }
};

// Old PDF generation function using autoTable - Disabled due to compatibility issues
// Now using generateSimplePDF function instead

const generateHTMLReport = (data: any, title: string, reportType: string): string => {
  const currentDate = new Date().toLocaleDateString();

  let content = '';

  switch (reportType) {
    case 'borrowing_history':
      content = generateBorrowingHistoryHTML(data);
      break;
    case 'overdue_books':
      content = generateOverdueBooksHTML(data);
      break;
    case 'popular_books':
      content = generatePopularBooksHTML(data);
      break;
    case 'student_activity':
      content = generateStudentActivityHTML(data);
      break;
    case 'fine_collection':
      content = generateFineCollectionHTML(data);
      break;
    case 'lost_books':
      content = generateLostBooksHTML(data);
      break;
    case 'library_summary':
      content = generateLibrarySummaryHTML(data);
      break;
    case 'theft_reports':
      content = generateTheftReportsHTML(data);
      break;
    case 'group_borrowings':
      content = generateGroupBorrowingsHTML(data);
      break;
    case 'staff_most_borrowed':
      content = generateStaffMostBorrowedHTML(data);
      break;
    case 'staff_activity':
      content = generateStaffActivityHTML(data);
      break;
    case 'staff_borrowing_trends':
      content = generateStaffBorrowingTrendsHTML(data);
      break;
    case 'staff_borrowing_history':
      content = generateStaffBorrowingHistoryHTML(data);
      break;
    case 'book_suppliers':
      content = generateBookSuppliersHTML(data);
      break;
    case 'staff_overdue_books':
      content = generateStaffOverdueBooksHTML(data);
      break;
    default:
      content = '<p>Report type not supported</p>';
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; 
          padding: 20px; 
          line-height: 1.6;
          color: #333;
          background: #fff;
        }
        .header { 
          text-align: center; 
          margin-bottom: 40px; 
          border-bottom: 3px solid #2563eb; 
          padding-bottom: 25px;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          padding: 30px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .title { 
          font-size: 28px; 
          font-weight: 700; 
          margin-bottom: 15px; 
          color: #1e293b;
          text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .subtitle {
          font-size: 16px;
          color: #64748b;
          margin-bottom: 10px;
        }
        .date { 
          color: #64748b; 
          font-size: 14px;
          font-weight: 500;
        }
        .school-info {
          text-align: center;
          margin-bottom: 20px;
          padding: 15px;
          background: #f1f5f9;
          border-radius: 6px;
          border-left: 4px solid #2563eb;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 25px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        th, td { 
          border: 1px solid #e2e8f0; 
          padding: 12px 15px; 
          text-align: left;
          vertical-align: top;
        }
        th { 
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); 
          color: white;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.5px;
        }
        tr:nth-child(even) { background-color: #f8fafc; }
        tr:hover { background-color: #f1f5f9; }
        .stats { 
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .stat-item { 
          text-align: center;
          padding: 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .stat-number { 
          font-size: 32px; 
          font-weight: 700; 
          color: #2563eb;
          margin-bottom: 5px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .stat-label { 
          color: #64748b; 
          font-size: 14px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin: 30px 0 15px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #e2e8f0;
        }
        .no-data {
          text-align: center;
          padding: 40px;
          color: #64748b;
          font-style: italic;
          background: #f8fafc;
          border-radius: 8px;
          border: 2px dashed #cbd5e1;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 12px;
        }
        @media print { 
          body { margin: 0; padding: 15px; }
          .header { break-inside: avoid; }
          table { break-inside: avoid; }
          .stat-item { break-inside: avoid; }
          .stats { break-inside: avoid; }
        }
        @page {
          margin: 1in;
          size: A4;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">📊 ${title}</div>
        <div class="subtitle">Professional Library Management Report</div>
        <div class="date">Generated on: ${currentDate}</div>
      </div>
      
      <div class="school-info">
        <strong>Library Management System</strong><br>
        Professional Reporting Module
      </div>
      
      ${content}
      
      <div class="footer">
        <p>This report was generated automatically by the Library Management System.</p>
        <p>For questions or support, please contact the library administration.</p>
      </div>
    </body>
    </html>
  `;
};

const generateBorrowingHistoryHTML = (data: any): string => {
  const { borrowings, books, students, totalBorrowings, activeBorrowings, returnedBooks, studentsInvolved } = data;

  // Calculate statistics if not provided
  const actualTotalBorrowings = totalBorrowings || borrowings?.length || 0;
  const actualActiveBorrowings = activeBorrowings || borrowings?.filter((b: any) => b.status === 'active').length || 0;
  const actualReturnedBooks = returnedBooks || borrowings?.filter((b: any) => b.status === 'returned').length || 0;
  const actualStudentsInvolved = studentsInvolved || new Set(borrowings?.map((b: any) => b.student_id).filter(id => id)).size || 0;

  let rows = '';
  borrowings.forEach((borrowing: any) => {
    const student = students?.find((s: any) => s.id === borrowing.student_id);
    const book = books?.find((b: any) => b.id === borrowing.book_id);

    // Get book copy information
    const bookCopyInfo = borrowing.book_copies
      ? `Copy #${borrowing.book_copies.copy_number}${borrowing.book_copies.tracking_code ? ` (${borrowing.book_copies.tracking_code})` : ''}`
      : borrowing.tracking_code
        ? `General (${borrowing.tracking_code})`
        : 'No copy info';

    rows += `
      <tr>
        <td>${student ? `${student.first_name} ${student.last_name}` : 'Unknown'}</td>
        <td>${student?.admission_number || 'N/A'}</td>
        <td>${book?.title || 'Unknown'}</td>
        <td>${book?.author || 'Unknown'}</td>
        <td>${bookCopyInfo}</td>
        <td>${borrowing.borrowed_date}</td>
        <td>${borrowing.due_date}</td>
        <td>${borrowing.returned_date || 'Not returned'}</td>
        <td>${borrowing.status}</td>
      </tr>
    `;
  });

  return `
    <h2>Borrowing History</h2>
    <div class="stats">
      <div class="stat-item">
        <div class="stat-number">${actualTotalBorrowings}</div>
        <div class="stat-label">Total Borrowings</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${actualActiveBorrowings}</div>
        <div class="stat-label">Active Borrowings</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${actualReturnedBooks}</div>
        <div class="stat-label">Returned Books</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${actualStudentsInvolved}</div>
        <div class="stat-label">Students Involved</div>
      </div>
    </div>
    <p>Total Records: ${actualTotalBorrowings}</p>
    <table>
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Admission No.</th>
          <th>Book Title</th>
          <th>Author</th>
          <th>Book Code/Copy</th>
          <th>Borrowed Date</th>
          <th>Due Date</th>
          <th>Returned Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

const generateOverdueBooksHTML = (data: any): string => {
  const { overdueBooks, books, students } = data;

  let rows = '';
  overdueBooks.forEach((borrowing: any) => {
    const student = students?.find((s: any) => s.id === borrowing.student_id);
    const book = books?.find((b: any) => b.id === borrowing.book_id);
    const daysOverdue = Math.floor((new Date().getTime() - new Date(borrowing.due_date).getTime()) / (1000 * 60 * 60 * 24));

    // Get book copy information
    const bookCopyInfo = borrowing.book_copies
      ? `Copy #${borrowing.book_copies.copy_number}${borrowing.book_copies.tracking_code ? ` (${borrowing.book_copies.tracking_code})` : ''}`
      : borrowing.tracking_code
        ? `General (${borrowing.tracking_code})`
        : 'No copy info';

    rows += `
      <tr>
        <td>${student ? `${student.first_name} ${student.last_name}` : 'Unknown'}</td>
        <td>${student?.admission_number || 'N/A'}</td>
        <td>${book?.title || 'Unknown'}</td>
        <td>${bookCopyInfo}</td>
        <td>${borrowing.due_date}</td>
        <td style="color: red; font-weight: bold;">${daysOverdue} days</td>
      </tr>
    `;
  });

  return `
    <h2>Overdue Books Report</h2>
    <p style="color: red; font-weight: bold;">Total Overdue Books: ${overdueBooks.length}</p>
    <table>
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Admission No.</th>
          <th>Book Title</th>
          <th>Book Code/Copy</th>
          <th>Due Date</th>
          <th>Days Overdue</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

const generatePopularBooksHTML = (data: any): string => {
  const { popularBooks } = data;

  let rows = '';
  popularBooks.forEach((book: any, index: number) => {
    rows += `
      <tr>
        <td>${index + 1}</td>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.borrowCount}</td>
        <td>${book.available_copies}/${book.total_copies}</td>
      </tr>
    `;
  });

  return `
    <h2>Popular Books Report</h2>
    <p>Top ${popularBooks.length} most borrowed books</p>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Title</th>
          <th>Author</th>
          <th>Times Borrowed</th>
          <th>Availability</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

const generateStudentActivityHTML = (data: any): string => {
  const { studentActivity } = data;

  let rows = '';
  studentActivity.forEach((student: any) => {
    rows += `
      <tr>
        <td>${student.class_grade || 'Unknown Class'}</td>
        <td>${student.first_name || 'Unknown'} ${student.last_name || 'Student'}</td>
        <td>${student.admission_number || 'N/A'}</td>
        <td>${student.totalBorrowings || student.borrowCount || 0}</td>
        <td>${student.activeBorrowings || 0}</td>
      </tr>
    `;
  });

  return `
    <h2>Student Activity Report</h2>
    <p>Student borrowing statistics (All ${studentActivity.length} students)</p>
    <table>
      <thead>
        <tr>
          <th>Class</th>
          <th>Student Name</th>
          <th>Admission No.</th>
          <th>Total Borrowed</th>
          <th>Currently Borrowed</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

const generateFineCollectionHTML = (data: any): string => {
  const { fineCollection, totalFines, selectedClass, reportDate } = data;

  let rows = '';
  fineCollection.forEach((item: any, index: number) => {
    rows += `
      <tr>
        <td>${index + 1}</td>
        <td>${item.student_name}</td>
        <td>${item.admission_number}</td>
        <td>${item.class_name}</td>
        <td>${item.fine_count}</td>
        <td style="font-weight: bold; color: #c2410c;">KES ${item.total_fine_amount.toFixed(2)}</td>
      </tr>
    `;
  });

  return `
    <h2>Fine Collection Report</h2>
    <p>Report for ${selectedClass} as of ${reportDate}</p>
    
    <div class="stats">
      <div class="stat-item">
        <div class="stat-number" style="color: #c2410c;">KES ${totalFines}</div>
        <div class="stat-label">Total Fines</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${fineCollection.length}</div>
        <div class="stat-label">Students with Fines</div>
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Student Name</th>
          <th>Admission No.</th>
          <th>Class</th>
          <th>Fine Count</th>
          <th>Total Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    
    ${fineCollection.length > 0 ? `
      <h3>Fine Details</h3>
      ${fineCollection.map((item: any) => `
        <div style="margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
          <h4>${item.student_name} (${item.admission_number})</h4>
          <p>Total Fines: KES ${item.total_fine_amount.toFixed(2)}</p>
          <table>
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Days Overdue</th>
                <th>Fine Amount</th>
                <th>Return Date</th>
              </tr>
            </thead>
            <tbody>
              ${item.fines.map((fine: any) => `
                <tr>
                  <td>${fine.book_title}</td>
                  <td>${fine.days_overdue}</td>
                  <td>KES ${fine.fine_amount.toFixed(2)}</td>
                  <td>${fine.returned_date}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    ` : '<p>No fine details available</p>'}
  `;
};

const generateLostBooksHTML = (data: any): string => {
  const { lostBooks, studentLostBooks, totalReplacementCost, selectedClass } = data;

  // Generate the books table
  let booksRows = '';
  lostBooks.forEach((book: any) => {
    const student = book.borrowings?.[0]?.students;
    booksRows += `
      <tr>
        <td>${book.books?.title || 'Unknown'}</td>
        <td>${book.books?.author || 'Unknown'}</td>
        <td>${book.tracking_code || 'N/A'}</td>
        <td>${student ? `${student.first_name} ${student.last_name}` : 'Unknown'}</td>
        <td>${student?.admission_number || 'N/A'}</td>
        <td>${student?.class_grade || 'N/A'}</td>
        <td>${book.borrowings?.[0]?.returned_date || 'Unknown'}</td>
        <td style="text-align: right;">KSh ${book.borrowings?.[0]?.fine_amount?.toFixed(2) || '0.00'}</td>
      </tr>
    `;
  });

  // Generate the students table
  let studentsRows = '';
  studentLostBooks.forEach((entry: any) => {
    studentsRows += `
      <tr>
        <td>${entry.student?.first_name} ${entry.student?.last_name}</td>
        <td>${entry.student?.admission_number || 'N/A'}</td>
        <td>${entry.student?.class_grade || 'N/A'}</td>
        <td>${entry.books.length}</td>
        <td>${entry.books.map((book: any) => book.books?.title).join(', ')}</td>
        <td style="text-align: right;">KSh ${entry.totalFine.toFixed(2)}</td>
      </tr>
    `;
  });

  return `
    <h2>Lost Books Report - ${selectedClass}</h2>
    <div class="stats">
      <div class="stat-item">
        <div class="stat-number">${lostBooks.length}</div>
        <div class="stat-label">Lost Books</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${studentLostBooks.length}</div>
        <div class="stat-label">Students</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" style="color: #e11d48;">KSh ${totalReplacementCost.toFixed(2)}</div>
        <div class="stat-label">Total Replacement Cost</div>
      </div>
    </div>
    
    <h3>Lost Books</h3>
    <table>
      <thead>
        <tr>
          <th>Book Title</th>
          <th>Author</th>
          <th>Tracking Code</th>
          <th>Student</th>
          <th>Admission No.</th>
          <th>Class</th>
          <th>Lost Date</th>
          <th style="text-align: right;">Replacement Cost</th>
        </tr>
      </thead>
      <tbody>
        ${booksRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7" style="text-align: right; font-weight: bold;">Total Replacement Cost:</td>
          <td style="text-align: right; font-weight: bold;">KSh ${totalReplacementCost.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    
    <h3>Students with Lost Books</h3>
    <table>
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Admission No.</th>
          <th>Class</th>
          <th>Books Lost</th>
          <th>Book Titles</th>
          <th style="text-align: right;">Total Fine</th>
        </tr>
      </thead>
      <tbody>
        ${studentsRows}
      </tbody>
    </table>
  `;
};

const generateLibrarySummaryHTML = (data: any): string => {
  const { totalBooks, totalStudents, activeBorrowings, overdueBooks, popularBooks, recentBorrowings } = data;

  let popularBooksRows = '';
  if (popularBooks && Array.isArray(popularBooks)) {
    popularBooks.forEach((item: any, index: number) => {
      const book = item.book || item; // Handle both structures
      const borrowCount = item.borrowCount || 0;
      popularBooksRows += `
        <tr>
          <td>${index + 1}</td>
          <td>${book?.title || 'Unknown Title'}</td>
          <td>${borrowCount}</td>
        </tr>
      `;
    });
  }

  // Add recent borrowings section
  let recentBorrowingsRows = '';
  if (recentBorrowings && Array.isArray(recentBorrowings)) {
    recentBorrowings.forEach((borrowing: any) => {
      const book = borrowing.book || { title: 'Unknown Book' };
      const student = borrowing.student || { first_name: 'Unknown', last_name: 'Student', class_grade: 'Unknown Class', admission_number: 'N/A' };
      recentBorrowingsRows += `
        <tr>
          <td>${student.class_grade}</td>
          <td>${student.first_name} ${student.last_name}</td>
          <td>${student.admission_number}</td>
          <td>${book.title}</td>
          <td>${new Date(borrowing.borrowed_date).toLocaleDateString()}</td>
          <td>${borrowing.status}</td>
        </tr>
      `;
    });
  }

  return `
    <h2>Library Summary Report</h2>
    <p><strong>Report Period:</strong> ${data.reportPeriod || 'All Time'}</p>
    <p><strong>Class:</strong> ${data.selectedClass || 'All Classes'}</p>
    
    <div class="stats">
      <div class="stat-item">
        <div class="stat-number">${totalBooks || 0}</div>
        <div class="stat-label">Total Books</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${totalStudents || 0}</div>
        <div class="stat-label">Total Students</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${activeBorrowings || 0}</div>
        <div class="stat-label">Active Borrowings</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" style="color: #dc2626;">${overdueBooks || 0}</div>
        <div class="stat-label">Overdue Books</div>
      </div>
    </div>
    
    <h3>Top 5 Popular Books</h3>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Title</th>
          <th>Times Borrowed</th>
        </tr>
      </thead>
      <tbody>
        ${popularBooksRows || '<tr><td colspan="3">No popular books data available</td></tr>'}
      </tbody>
    </table>
    
    <h3>Recent Borrowings</h3>
    <table>
      <thead>
        <tr>
          <th>Class</th>
          <th>Student Name</th>
          <th>Admission No.</th>
          <th>Book</th>
          <th>Borrowed Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${recentBorrowingsRows || '<tr><td colspan="6">No recent borrowings data available</td></tr>'}
      </tbody>
    </table>
  `;
};

const generateTheftReportsHTML = (data: any): string => {
  const { theftReports = [], statusStats } = data;

  let rows = '';
  theftReports.forEach((report: any, index: number) => {
    const victim = report.students;
    const perpetrator = report.borrowings?.students;
    const totalFines = report.theft_fines?.reduce((sum: number, fine: any) => sum + fine.amount, 0) || 0;

    rows += `
      <tr>
        <td>${index + 1}</td>
        <td style="color: #dc2626; font-weight: bold;">${report.id.slice(0, 8).toUpperCase()}</td>
        <td>${victim ? `${victim.first_name} ${victim.last_name}` : 'Unknown'}<br/>
            <small style="color: #666;">${victim?.admission_number || 'N/A'} - ${victim?.class_grade || 'N/A'}</small></td>
        <td>${perpetrator ? `${perpetrator.first_name} ${perpetrator.last_name}` : 'Under Investigation'}<br/>
            <small style="color: #666;">${perpetrator?.admission_number || 'Unknown'} - ${perpetrator?.class_grade || 'Unknown'}</small></td>
        <td>${report.books.title}<br/>
            <small style="color: #666;">by ${report.books.author}</small></td>
        <td>Expected: ${report.expected_tracking_code}<br/>
            Returned: ${report.returned_tracking_code}</td>
        <td style="font-weight: bold;">KES ${totalFines.toFixed(2)}</td>
        <td style="color: ${report.status === 'resolved' ? '#16a34a' : report.status === 'investigating' ? '#ca8a04' : '#dc2626'}; font-weight: bold;">
          ${report.status.toUpperCase()}
        </td>
        <td>${new Date(report.reported_date).toLocaleDateString()}</td>
      </tr>
    `;
  });

  return `
    <h2>Official Theft Investigation Report</h2>
    <p style="color: #666; font-style: italic;">Professional theft incident management and tracking system</p>
    
    <div class="stats">
      <div class="stat-item">
        <div class="stat-number">${statusStats?.total || 0}</div>
        <div class="stat-label">Total Cases</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" style="color: #dc2626;">${statusStats?.reported || 0}</div>
        <div class="stat-label">Active Reports</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" style="color: #ca8a04;">${statusStats?.investigating || 0}</div>
        <div class="stat-label">Investigating</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" style="color: #16a34a;">${statusStats?.resolved || 0}</div>
        <div class="stat-label">Resolved</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" style="color: #dc2626;">KES ${(statusStats?.totalFines || 0).toFixed(2)}</div>
        <div class="stat-label">Total Fines</div>
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th style="width: 3%;">#</th>
          <th style="width: 10%;">Case ID</th>
          <th style="width: 15%;">Victim</th>
          <th style="width: 15%;">Perpetrator</th>
          <th style="width: 20%;">Book Details</th>
          <th style="width: 15%;">Tracking Codes</th>
          <th style="width: 8%;">Fines</th>
          <th style="width: 8%;">Status</th>
          <th style="width: 10%;">Reported</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="9" style="text-align: center; color: #666;">No theft reports found</td></tr>'}
      </tbody>
    </table>
    
    ${theftReports.length > 0 ? `
      <h3>Case Details Summary</h3>
      ${theftReports.map((report: any, index: number) => `
        <div style="margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
          <h4 style="color: #dc2626; margin: 0 0 10px 0;">Case #${index + 1}: ${report.id.slice(0, 8).toUpperCase()}</h4>
          <p><strong>Status:</strong> ${report.status.toUpperCase()}</p>
          <p><strong>Incident:</strong> ${report.theft_reason || 'Book tracking code mismatch detected'}</p>
          <p><strong>Victim:</strong> ${report.students?.first_name} ${report.students?.last_name} (${report.students?.admission_number})</p>
          <p><strong>Perpetrator:</strong> ${report.borrowings?.students ? `${report.borrowings.students.first_name} ${report.borrowings.students.last_name} (${report.borrowings.students.admission_number})` : 'Under Investigation'}</p>
          <p><strong>Book:</strong> "${report.books.title}" by ${report.books.author}</p>
          <p><strong>Evidence:</strong> Expected tracking code "${report.expected_tracking_code}" but received "${report.returned_tracking_code}"</p>
          ${report.investigation_notes ? `<p><strong>Investigation Notes:</strong> ${report.investigation_notes}</p>` : ''}
          ${report.theft_fines && report.theft_fines.length > 0 ? `
            <p><strong>Financial Penalties:</strong></p>
            <ul>
              ${report.theft_fines.map((fine: any) => `
                <li>${fine.description}: KES ${fine.amount.toFixed(2)} (${fine.status})</li>
              `).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('')}
    ` : ''}
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #333; text-align: center; color: #666;">
      <p><strong>CONFIDENTIAL REPORT</strong> - For authorized personnel only</p>
      <p>This report contains sensitive information and should be handled according to institutional policies.</p>
    </div>
  `;
};

const generateGroupBorrowingsHTML = (data: any): string => {
  const { groupBorrowings, selectedClass } = data;

  // Calculate statistics
  const totalBorrowings = groupBorrowings.length;
  const activeBorrowings = groupBorrowings.filter((b: any) => b.status === 'active').length;
  const returnedBorrowings = groupBorrowings.filter((b: any) => b.status === 'returned').length;
  const totalStudentsInvolved = new Set(
    groupBorrowings.flatMap((b: any) => b.student_ids || [])
  ).size;
  const totalFines = groupBorrowings.reduce((sum: number, b: any) => sum + (b.fine_amount || 0), 0);
  const averageGroupSize = groupBorrowings.reduce((sum: number, b: any) => sum + b.student_count, 0) / totalBorrowings;

  // Generate statistics HTML
  const statsHTML = `
    <div class="stats">
      <div class="stat-item">
        <div class="stat-number">${totalBorrowings}</div>
        <div class="stat-label">Total Borrowings</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${activeBorrowings}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${returnedBorrowings}</div>
        <div class="stat-label">Returned</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${totalStudentsInvolved}</div>
        <div class="stat-label">Students Involved</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">KSh ${totalFines.toLocaleString()}</div>
        <div class="stat-label">Total Fines</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${averageGroupSize.toFixed(1)}</div>
        <div class="stat-label">Avg. Group Size</div>
      </div>
    </div>
  `;

  // Generate borrowings table
  let borrowingsHTML = '';
  groupBorrowings.forEach((borrowing: any) => {
    // Access the book data from the books relationship
    const book = borrowing.books;
    const bookTitle = book ? book.title : 'Unknown Book';
    const bookAuthor = book ? book.author : 'Unknown Author';
    const bookCode = borrowing.book_copies?.tracking_code || borrowing.tracking_code || 'No Code';

    const membersHTML = borrowing.student_ids
      .map((studentId: string) => {
        const student = borrowing.students?.find((s: any) => s.id === studentId);
        if (!student) return '';
        return `
          <div class="member">
            ${student.admission_number} - ${student.first_name} ${student.last_name} (${student.class_grade})
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    borrowingsHTML += `
      <div class="borrowing-entry">
        <h3>${bookTitle}</h3>
        <div class="book-details">
          <span class="author">by ${bookAuthor}</span>
          <span class="code">Code: ${bookCode}</span>
        </div>
        <div class="borrowing-details">
          <div class="detail-row">
            <span class="label">Borrowed Date:</span>
            <span>${new Date(borrowing.borrowed_date).toLocaleDateString()}</span>
          </div>
          <div class="detail-row">
            <span class="label">Due Date:</span>
            <span>${new Date(borrowing.due_date).toLocaleDateString()}</span>
          </div>
          <div class="detail-row">
            <span class="label">Status:</span>
            <span class="status-${borrowing.status}">${borrowing.status}</span>
          </div>
          <div class="detail-row">
            <span class="label">Group Size:</span>
            <span>${borrowing.student_count} members</span>
          </div>
          ${borrowing.fine_amount ? `
            <div class="detail-row">
              <span class="label">Fine Amount:</span>
              <span>KSh ${borrowing.fine_amount.toLocaleString()}</span>
            </div>
          ` : ''}
        </div>
        <div class="members-section">
          <h4>Group Members</h4>
          <div class="members-list">
            ${membersHTML}
          </div>
        </div>
        ${(borrowing.notes || borrowing.return_notes) ? `
          <div class="notes-section">
            <h4>Notes</h4>
            ${borrowing.notes ? `
              <div class="note">
                <strong>Borrowing Note:</strong> ${borrowing.notes}
              </div>
            ` : ''}
            ${borrowing.return_notes ? `
              <div class="note">
                <strong>Return Note:</strong> ${borrowing.return_notes}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  });

  const additionalStyles = `
    <style>
      .borrowing-entry {
        border: 1px solid #ddd;
        margin-bottom: 20px;
        padding: 15px;
        border-radius: 5px;
      }
      .borrowing-entry h3 {
        margin: 0;
        color: #2563eb;
      }
      .book-details {
        color: #666;
        font-size: 0.9em;
        margin: 5px 0 15px;
      }
      .book-details .author {
        margin-right: 15px;
      }
      .book-details .code {
        color: #2563eb;
      }
      .borrowing-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
        margin-bottom: 15px;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
      }
      .label {
        color: #666;
        font-weight: 500;
      }
      .status-active {
        color: #059669;
        font-weight: bold;
      }
      .status-returned {
        color: #6B7280;
      }
      .status-overdue {
        color: #dc2626;
        font-weight: bold;
      }
      .status-lost {
        color: #7c2d12;
        font-weight: bold;
      }
      .members-section {
        background: #f8fafc;
        padding: 10px;
        border-radius: 4px;
        margin-top: 10px;
      }
      .members-section h4 {
        margin: 0 0 10px 0;
        color: #4B5563;
      }
      .member {
        padding: 5px 0;
        border-bottom: 1px solid #e5e7eb;
      }
      .member:last-child {
        border-bottom: none;
      }
      .notes-section {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #e5e7eb;
      }
      .notes-section h4 {
        margin: 0 0 10px 0;
        color: #4B5563;
      }
      .note {
        margin-bottom: 8px;
        font-size: 0.9em;
      }
    </style>
  `;

  return `
    ${additionalStyles}
    <h2>Group Borrowings Report - ${selectedClass}</h2>
    ${statsHTML}
    <div class="borrowings-list">
      ${borrowingsHTML}
    </div>
  `;
};

const generateStaffMostBorrowedHTML = (data: any): string => {
  const { staffMostBorrowed } = data;

  let staffHTML = '';
  staffMostBorrowed.forEach((staff: any) => {
    let booksRows = '';
    staff.mostBorrowedBooks.forEach((item: any, index: number) => {
      booksRows += `
        <tr>
          <td>${index + 1}</td>
          <td>${item.book?.title || 'Unknown'}</td>
          <td>${item.book?.author || 'Unknown'}</td>
          <td>${item.count}</td>
        </tr>
      `;
    });

    staffHTML += `
      <div style="margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
        <h3>${staff.staff?.first_name} ${staff.staff?.last_name} - ${staff.staff?.department || 'N/A'}</h3>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Book Title</th>
              <th>Author</th>
              <th>Times Borrowed</th>
            </tr>
          </thead>
          <tbody>
            ${booksRows}
          </tbody>
        </table>
      </div>
    `;
  });

  return `
    <h2>Staff Most Borrowed Books Report</h2>
    ${staffHTML}
  `;
};

const generateStaffActivityHTML = (data: any): string => {
  const { staffActivity } = data;

  let rows = '';
  staffActivity.forEach((activity: any) => {
    rows += `
      <tr>
        <td>${activity.staff?.first_name} ${activity.staff?.last_name}</td>
        <td>${activity.staff?.department || 'N/A'}</td>
        <td>${activity.totalBorrowings}</td>
        <td>${activity.activeBorrowings}</td>
        <td>${activity.returnedBorrowings}</td>
        <td>${activity.overdueBorrowings}</td>
      </tr>
    `;
  });

  return `
    <h2>Staff Activity Report</h2>
    <table>
      <thead>
        <tr>
          <th>Staff Name</th>
          <th>Department</th>
          <th>Total Borrowings</th>
          <th>Active</th>
          <th>Returned</th>
          <th>Overdue</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

const generateStaffBorrowingTrendsHTML = (data: any): string => {
  const { staffTrends } = data;

  let staffHTML = '';
  staffTrends.forEach((staff: any) => {
    let trendRows = '';
    staff.trendData.forEach((trend: any) => {
      trendRows += `
        <tr>
          <td>${trend.month}</td>
          <td>${trend.count}</td>
        </tr>
      `;
    });

    staffHTML += `
      <div style="margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
        <h3>${staff.staff?.first_name} ${staff.staff?.last_name} - ${staff.staff?.department || 'N/A'}</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Borrowings</th>
            </tr>
          </thead>
          <tbody>
            ${trendRows}
          </tbody>
        </table>
      </div>
    `;
  });

  return `
    <h2>Staff Borrowing Trends Report</h2>
    ${staffHTML}
  `;
};

const generateStaffBorrowingHistoryHTML = (data: any): string => {
  const { staffHistory } = data;

  let staffHTML = '';
  staffHistory.forEach((staff: any) => {
    let historyRows = '';
    staff.borrowingHistory.forEach((borrowing: any) => {
      historyRows += `
        <tr>
          <td>${borrowing.book?.title || 'Unknown'}</td>
          <td>${borrowing.legacy_book_id || borrowing.book?.legacy_book_id || borrowing.book_copies?.legacy_book_id || 'N/A'}</td>
          <td>Copy #${borrowing.book_copy?.copy_number || 'N/A'}</td>
          <td>${new Date(borrowing.borrowed_date || borrowing.created_at).toLocaleDateString()}</td>
          <td>${new Date(borrowing.due_date).toLocaleDateString()}</td>
          <td>${borrowing.status}</td>
        </tr>
      `;
    });

    staffHTML += `
      <div style="margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
        <h3>${staff.staff?.first_name} ${staff.staff?.last_name} - ${staff.staff?.department || 'N/A'}</h3>
        <table>
          <thead>
            <tr>
              <th>Book Title</th>
              <th>Legacy Book ID</th>
              <th>Copy Info</th>
              <th>Borrowed Date</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${historyRows}
          </tbody>
        </table>
      </div>
    `;
  });

  return `
    <h2>Staff Borrowing History Report</h2>
    ${staffHTML}
  `;
};

const generateBookSuppliersHTML = (data: any): string => {
  const { suppliers } = data;

  let rows = '';
  suppliers.forEach((supplier: any, index: number) => {
    rows += `
      <tr>
        <td>${index + 1}</td>
        <td>${supplier.supplier_type}</td>
        <td>${supplier.supplier_name}</td>
        <td>${supplier.book_count}</td>
        <td>${supplier.total_copies}</td>
      </tr>
    `;
  });

  return `
    <h2>Book Suppliers Report</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Supplier Type</th>
          <th>Supplier Name</th>
          <th>Books</th>
          <th>Total Copies</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

const generateStaffOverdueBooksHTML = (data: any): string => {
  const { overdueBooks } = data;

  let rows = '';
  overdueBooks.forEach((borrowing: any, index: number) => {
    rows += `
      <tr>
        <td>${index + 1}</td>
        <td>${borrowing.staff?.first_name} ${borrowing.staff?.last_name}</td>
        <td>${borrowing.staff?.staff_id || 'N/A'}</td>
        <td>${borrowing.book?.title || 'Unknown'}</td>
        <td>${new Date(borrowing.due_date).toLocaleDateString()}</td>
        <td>${borrowing.days_overdue} days</td>
      </tr>
    `;
  });

  return `
    <h2>Staff Overdue Books Report</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Staff Name</th>
          <th>Staff ID</th>
          <th>Book Title</th>
          <th>Due Date</th>
          <th>Days Overdue</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};




