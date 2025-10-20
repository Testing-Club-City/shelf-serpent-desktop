import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dbPath = 'C:\\Users\\kariu\\AppData\\Roaming\\library-management-system\\library.db';

console.log('🔍 Checking Class Borrowing Limits in Local Database');
console.log('='.repeat(80));
console.log(`📂 Database: ${dbPath}\n`);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Get all classes with their limits
  const classes = db.prepare(`
    SELECT 
      id,
      class_name,
      form_level,
      class_section,
      max_books_allowed,
      is_active
    FROM classes
    WHERE deleted = 0
    ORDER BY form_level, class_section
  `).all();
  
  console.log(`📊 Total Classes: ${classes.length}\n`);
  
  // Group by form level
  const formGroups = {};
  let nullCount = 0;
  
  classes.forEach(cls => {
    if (cls.max_books_allowed === null) {
      nullCount++;
    }
    
    if (!formGroups[cls.form_level]) {
      formGroups[cls.form_level] = [];
    }
    formGroups[cls.form_level].push(cls);
  });
  
  // Display by form level
  Object.keys(formGroups).sort((a, b) => a - b).forEach(formLevel => {
    console.log('─'.repeat(80));
    console.log(`FORM ${formLevel}`);
    console.log('─'.repeat(80));
    
    const formClasses = formGroups[formLevel];
    
    // Calculate stats
    const limits = formClasses
      .filter(c => c.max_books_allowed !== null)
      .map(c => c.max_books_allowed);
    
    if (limits.length > 0) {
      const avg = limits.reduce((a, b) => a + b, 0) / limits.length;
      const min = Math.min(...limits);
      const max = Math.max(...limits);
      
      console.log(`  Average Limit: ${avg.toFixed(1)} books`);
      console.log(`  Min Limit: ${min} books`);
      console.log(`  Max Limit: ${max} books`);
    }
    
    console.log(`\n  ${'Class Name'.padEnd(30)} ${'Section'.padEnd(10)} ${'Max Books'.padEnd(15)} ${'Active'.padEnd(10)}`);
    console.log(`  ${'-'.repeat(65)}`);
    
    formClasses.forEach(cls => {
      const className = cls.class_name.substring(0, 29).padEnd(30);
      const section = (cls.class_section || 'N/A').padEnd(10);
      const maxBooks = cls.max_books_allowed === null 
        ? '⚠️  NULL'.padEnd(15)
        : `${cls.max_books_allowed} books`.padEnd(15);
      const active = cls.is_active ? '✅ Yes' : '❌ No';
      
      console.log(`  ${className} ${section} ${maxBooks} ${active}`);
    });
    
    console.log('');
  });
  
  // Show warnings
  console.log('='.repeat(80));
  console.log('⚠️  WARNINGS & ISSUES');
  console.log('='.repeat(80));
  
  if (nullCount > 0) {
    console.log(`\n❌ ${nullCount} classes have NULL max_books_allowed!`);
    console.log('   These classes will default to 2 books in the borrowing logic.');
    console.log('   Action needed: Set borrowing limits in Admin Panel → System Settings\n');
    
    // Show which classes have NULL
    console.log('   Classes with NULL limits:');
    classes.filter(c => c.max_books_allowed === null).forEach(cls => {
      console.log(`   - ${cls.class_name} (Form ${cls.form_level})`);
    });
  } else {
    console.log('\n✅ All classes have max_books_allowed set!');
  }
  
  // Check for students in classes with NULL limits
  const studentsInNullClasses = db.prepare(`
    SELECT COUNT(DISTINCT s.id) as student_count
    FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE c.max_books_allowed IS NULL
    AND s.deleted = 0
    AND c.deleted = 0
  `).get();
  
  if (studentsInNullClasses.student_count > 0) {
    console.log(`\n⚠️  ${studentsInNullClasses.student_count} students are in classes with NULL limits!`);
    console.log('   These students can only borrow 2 books (default).');
  }
  
  // Show current borrowing statistics
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 CURRENT BORROWING STATISTICS');
  console.log('='.repeat(80));
  
  const stats = db.prepare(`
    SELECT 
      c.class_name,
      c.form_level,
      c.max_books_allowed,
      COUNT(DISTINCT s.id) as total_students,
      COUNT(DISTINCT CASE WHEN b.status = 'active' THEN s.id END) as students_with_books,
      COUNT(CASE WHEN b.status = 'active' THEN b.id END) as total_active_borrowings
    FROM classes c
    LEFT JOIN students s ON c.id = s.class_id AND s.deleted = 0
    LEFT JOIN borrowings b ON s.id = b.student_id AND b.deleted = 0
    WHERE c.deleted = 0
    GROUP BY c.id, c.class_name, c.form_level, c.max_books_allowed
    HAVING total_students > 0
    ORDER BY c.form_level, c.class_section
  `).all();
  
  console.log(`\n${'Class'.padEnd(25)} ${'Form'.padEnd(8)} ${'Max Books'.padEnd(12)} ${'Students'.padEnd(12)} ${'Borrowing'.padEnd(12)} ${'Total Books'.padEnd(12)}`);
  console.log('-'.repeat(90));
  
  stats.forEach(stat => {
    const className = stat.class_name.substring(0, 24).padEnd(25);
    const formLevel = `Form ${stat.form_level}`.padEnd(8);
    const maxBooks = (stat.max_books_allowed === null ? 'NULL' : stat.max_books_allowed.toString()).padEnd(12);
    const totalStudents = stat.total_students.toString().padEnd(12);
    const studentsWithBooks = stat.students_with_books.toString().padEnd(12);
    const totalBooks = stat.total_active_borrowings.toString().padEnd(12);
    
    console.log(`${className} ${formLevel} ${maxBooks} ${totalStudents} ${studentsWithBooks} ${totalBooks}`);
  });
  
  // Check for students exceeding limits
  console.log(`\n${'='.repeat(80)}`);
  console.log('🚨 STUDENTS EXCEEDING BORROWING LIMITS');
  console.log('='.repeat(80));
  
  const violations = db.prepare(`
    SELECT 
      s.first_name || ' ' || s.last_name as student_name,
      s.admission_number,
      c.class_name,
      c.form_level,
      c.max_books_allowed,
      COUNT(b.id) as current_borrowings
    FROM students s
    JOIN classes c ON s.class_id = c.id
    LEFT JOIN borrowings b ON s.id = b.student_id 
      AND b.status = 'active' 
      AND b.deleted = 0
    WHERE s.deleted = 0 
      AND c.deleted = 0
      AND c.max_books_allowed IS NOT NULL
    GROUP BY s.id, student_name, s.admission_number, c.class_name, c.form_level, c.max_books_allowed
    HAVING COUNT(b.id) > c.max_books_allowed
    ORDER BY current_borrowings DESC
  `).all();
  
  if (violations.length > 0) {
    console.log(`\n⚠️  Found ${violations.length} students exceeding their borrowing limit:\n`);
    console.log(`${'Student'.padEnd(30)} ${'Admission'.padEnd(15)} ${'Class'.padEnd(20)} ${'Borrowed'.padEnd(15)} ${'Limit'}`);
    console.log('-'.repeat(100));
    
    violations.forEach(v => {
      const studentName = v.student_name.substring(0, 29).padEnd(30);
      const admission = v.admission_number.padEnd(15);
      const className = v.class_name.substring(0, 19).padEnd(20);
      const borrowed = v.current_borrowings.toString().padEnd(15);
      const limit = v.max_books_allowed.toString();
      
      console.log(`${studentName} ${admission} ${className} ${borrowed} ${limit}`);
    });
  } else {
    console.log('\n✅ No students currently exceeding their borrowing limits!');
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ Report Complete');
  console.log('='.repeat(80));
  
  db.close();
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
