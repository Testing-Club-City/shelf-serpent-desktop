// Simple PDF generation utility
export const generatePDFReport = async (data: any, title: string, reportType: string) => {
  // Create a simple HTML document for PDF generation
  const htmlContent = generateHTMLReport(data, title, reportType);
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to generate PDF reports');
    return;
  }
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  // Wait for content and images to load before printing
  printWindow.onload = function() {
    // Add a small delay to ensure all CSS is applied
    setTimeout(() => {
      try {
        printWindow.focus(); // Focus the window before printing
        printWindow.print();
      } catch (error) {
        console.error('Error during printing:', error);
        alert('There was an error generating the PDF. Please try again.');
      }
    }, 500);
  };
};

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
    default:
      content = '<p>Report type not supported</p>';
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .date { color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-item { text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #2563eb; }
        .stat-label { color: #666; font-size: 14px; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${title}</div>
        <div class="date">Generated on: ${currentDate}</div>
      </div>
      ${content}
    </body>
    </html>
  `;
};

const generateBorrowingHistoryHTML = (data: any): string => {
  const { borrowings, books, students } = data;
  
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
    <p>Total Records: ${borrowings.length}</p>
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
  studentActivity.slice(0, 50).forEach((student: any) => {
    rows += `
      <tr>
        <td>${student.first_name} ${student.last_name}</td>
        <td>${student.admission_number}</td>
        <td>${student.class_grade}</td>
        <td>${student.borrowCount}</td>
        <td>${student.activeBorrowings}</td>
        <td>${student.status}</td>
      </tr>
    `;
  });
  
  return `
    <h2>Student Activity Report</h2>
    <p>Student borrowing statistics (Top 50 active students)</p>
    <table>
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Admission No.</th>
          <th>Class</th>
          <th>Total Borrowed</th>
          <th>Currently Borrowed</th>
          <th>Status</th>
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
  popularBooks.forEach((book: any, index: number) => {
    popularBooksRows += `
      <tr>
        <td>${index + 1}</td>
        <td>${book.title}</td>
        <td>${book.borrowCount}</td>
      </tr>
    `;
  });
  
  return `
    <h2>Library Summary Report</h2>
    
    <div class="stats">
      <div class="stat-item">
        <div class="stat-number">${totalBooks}</div>
        <div class="stat-label">Total Books</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${totalStudents}</div>
        <div class="stat-label">Total Students</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${activeBorrowings}</div>
        <div class="stat-label">Active Borrowings</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" style="color: #dc2626;">${overdueBooks}</div>
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
        ${popularBooksRows}
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
