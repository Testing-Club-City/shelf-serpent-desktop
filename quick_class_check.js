// Quick class verification script
// Run this in your Tauri app's browser console

async function quickClassCheck() {
  console.log('=== Quick Class Check ===');
  
  try {
    // Check classes
    const classes = await window.__TAURI__.core.invoke('get_classes');
    console.log(`\nClasses in local DB: ${classes.length}`);
    
    if (classes.length > 0) {
      console.log('Class names found:');
      classes.forEach((cls, i) => {
        console.log(`  ${i+1}. "${cls.class_name}" (ID: ${cls.id})`);
      });
    } else {
      console.log('❌ NO CLASSES FOUND IN LOCAL DATABASE!');
      console.log('This is likely the root cause of the "Unknown" class issue.');
      return;
    }
    
    // Check students  
    const students = await window.__TAURI__.core.invoke('get_students');
    console.log(`\nStudents in local DB: ${students.length}`);
    
    if (students.length > 0) {
      // Sample first 3 students
      console.log('Sample students:');
      students.slice(0, 3).forEach((student, i) => {
        console.log(`  ${i+1}. ${student.first_name} ${student.last_name}`);
        console.log(`     Class ID: ${student.class_id || 'null'}`);
        console.log(`     Class Grade: "${student.class_grade}"`);
      });
      
      // Count by class_grade
      const counts = {};
      students.forEach(s => {
        const grade = s.class_grade || 'Unknown';
        counts[grade] = (counts[grade] || 0) + 1;
      });
      
      console.log('\nStudent distribution by class_grade:');
      Object.entries(counts).forEach(([grade, count]) => {
        console.log(`  - ${grade}: ${count} students`);
      });
      
    } else {
      console.log('❌ NO STUDENTS FOUND IN LOCAL DATABASE!');
    }
    
    // Expected vs Actual
    console.log('\n=== DIAGNOSIS ===');
    const expectedClasses = ['Graduated', 'Form 2 A', 'Form 4 A'];
    const actualClasses = classes.map(c => c.class_name);
    
    expectedClasses.forEach(expected => {
      const found = actualClasses.includes(expected);
      console.log(`${expected}: ${found ? '✅' : '❌'} ${found ? 'Found' : 'Missing'}`);
    });
    
    if (classes.length === 0) {
      console.log('\n🚨 ROOT CAUSE: No classes in local database');
      console.log('SOLUTION: Run a sync operation to pull classes from Supabase');
    } else if (actualClasses.includes('Unknown')) {
      console.log('\n🚨 ROOT CAUSE: Students have "Unknown" as class_grade');
      console.log('SOLUTION: Check student-class relationship sync');
    } else {
      console.log('\n✅ Local classes look good');
      console.log('Issue might be in frontend data transformation');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('Make sure you\'re running this in the Tauri app console');
  }
}

// Auto-run instructions
console.log('Run: quickClassCheck()');

// Make available globally
if (typeof window !== 'undefined') {
  window.quickClassCheck = quickClassCheck;
}
