// This script should be run in the Tauri app's browser console
// It will verify classes exist in the local database and check the Graduated class

async function verifyLocalClasses() {
  console.log('=== Verifying Classes in Local Database ===\n');
  
  try {
    // 1. Get all classes from local database
    console.log('1. Fetching classes from local database...');
    const localClasses = await window.__TAURI__.core.invoke('get_classes');
    console.log(`✅ Found ${localClasses.length} classes in local database\n`);
    
    if (localClasses.length === 0) {
      console.log('❌ No classes found in local database!');
      console.log('This suggests the classes haven\'t been synced to local database.');
      return;
    }
    
    // 2. Display all classes
    console.log('2. Local classes:');
    localClasses.forEach((cls, index) => {
      console.log(`   ${index + 1}. ${cls.class_name}`);
      console.log(`      - ID: ${cls.id}`);
      console.log(`      - Form Level: ${cls.form_level}`);
      console.log(`      - Section: ${cls.class_section || 'N/A'}`);
      console.log(`      - Active: ${cls.is_active}`);
      console.log(`      - Max Books: ${cls.max_books_allowed}`);
      console.log('');
    });
    
    // 3. Check for specific classes
    const graduatedClass = localClasses.find(cls => cls.class_name === 'Graduated');
    const form2AClass = localClasses.find(cls => cls.class_name === 'Form 2 A');
    const form4AClass = localClasses.find(cls => cls.class_name === 'Form 4 A');
    
    console.log('3. Checking for key classes:');
    console.log(`   - "Graduated" class: ${graduatedClass ? '✅ Found' : '❌ Not found'}`);
    if (graduatedClass) {
      console.log(`     ID: ${graduatedClass.id}, Active: ${graduatedClass.is_active}`);
    }
    
    console.log(`   - "Form 2 A" class: ${form2AClass ? '✅ Found' : '❌ Not found'}`);
    if (form2AClass) {
      console.log(`     ID: ${form2AClass.id}, Active: ${form2AClass.is_active}`);
    }
    
    console.log(`   - "Form 4 A" class: ${form4AClass ? '✅ Found' : '❌ Not found'}`);
    if (form4AClass) {
      console.log(`     ID: ${form4AClass.id}, Active: ${form4AClass.is_active}`);
    }
    
    // 4. Get students from local database
    console.log('\n4. Fetching students from local database...');
    const localStudents = await window.__TAURI__.core.invoke('get_students');
    console.log(`✅ Found ${localStudents.length} students in local database\n`);
    
    if (localStudents.length === 0) {
      console.log('❌ No students found in local database!');
      return;
    }
    
    // 5. Analyze student-class relationships
    console.log('5. Analyzing student-class relationships...');
    
    // Sample first 10 students
    const sampleStudents = localStudents.slice(0, 10);
    console.log(`\nSample of ${sampleStudents.length} students:`);
    
    sampleStudents.forEach((student, index) => {
      console.log(`   ${index + 1}. ${student.first_name} ${student.last_name}`);
      console.log(`      - Admission: ${student.admission_number}`);
      console.log(`      - Class ID: ${student.class_id || 'null'}`);
      console.log(`      - Class Grade: "${student.class_grade}"`);
      console.log(`      - Status: ${student.status || 'N/A'}`);
      console.log('');
    });
    
    // 6. Count students by class_grade
    const classCounts = {};
    localStudents.forEach(student => {
      const className = student.class_grade || 'No Class';
      classCounts[className] = (classCounts[className] || 0) + 1;
    });
    
    console.log('6. Students count by class_grade:');
    Object.entries(classCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([className, count]) => {
        console.log(`   - ${className}: ${count} students`);
      });
    
    // 7. Check for orphaned class_id references
    console.log('\n7. Checking for orphaned class_id references...');
    const classIdMap = new Map();
    localClasses.forEach(cls => classIdMap.set(cls.id, cls.class_name));
    
    const orphanedStudents = localStudents.filter(student => 
      student.class_id && !classIdMap.has(student.class_id)
    );
    
    console.log(`   - Students with orphaned class_id: ${orphanedStudents.length}`);
    if (orphanedStudents.length > 0) {
      console.log('   Orphaned students:');
      orphanedStudents.slice(0, 5).forEach(student => {
        console.log(`     - ${student.first_name} ${student.last_name}: class_id=${student.class_id}`);
      });
    }
    
    // 8. Check if class_grade matches class_id
    console.log('\n8. Checking if class_grade matches class_id...');
    const mismatches = [];
    localStudents.forEach(student => {
      if (student.class_id && classIdMap.has(student.class_id)) {
        const expectedClassName = classIdMap.get(student.class_id);
        if (student.class_grade !== expectedClassName) {
          mismatches.push({
            name: `${student.first_name} ${student.last_name}`,
            class_id: student.class_id,
            class_grade: student.class_grade,
            expected: expectedClassName
          });
        }
      }
    });
    
    console.log(`   - Students with class_grade/class_id mismatches: ${mismatches.length}`);
    if (mismatches.length > 0) {
      console.log('   Sample mismatches:');
      mismatches.slice(0, 5).forEach(mismatch => {
        console.log(`     - ${mismatch.name}:`);
        console.log(`       class_grade: "${mismatch.class_grade}"`);
        console.log(`       expected: "${mismatch.expected}"`);
      });
    }
    
    // 9. Compare with known Supabase IDs
    console.log('\n9. Comparing with known Supabase class IDs...');
    const supabaseForm2A = '19b961af-4525-44b9-b8d6-fd8bbfb11eb5';
    const supabaseForm4A = '0170cb4e-d19f-47f0-8d62-513437ea5bdf';
    const supabaseGraduated = 'd1873395-7f9c-4f43-835d-e83402206f79';
    
    const localForm2A = form2AClass?.id;
    const localForm4A = form4AClass?.id;
    const localGraduated = graduatedClass?.id;
    
    console.log('   Class ID comparisons:');
    console.log(`   - Form 2 A: Local=${localForm2A} | Supabase=${supabaseForm2A} | Match=${localForm2A === supabaseForm2A ? '✅' : '❌'}`);
    console.log(`   - Form 4 A: Local=${localForm4A} | Supabase=${supabaseForm4A} | Match=${localForm4A === supabaseForm4A ? '✅' : '❌'}`);
    console.log(`   - Graduated: Local=${localGraduated} | Supabase=${supabaseGraduated} | Match=${localGraduated === supabaseGraduated ? '✅' : '❌'}`);
    
    // 10. Summary and recommendations
    console.log('\n=== SUMMARY AND RECOMMENDATIONS ===');
    
    if (localClasses.length === 0) {
      console.log('🚨 CRITICAL: No classes found in local database');
      console.log('   Action: Run a sync operation to pull classes from Supabase');
    } else if (orphanedStudents.length > 0) {
      console.log('⚠️  WARNING: Students with orphaned class_id references found');
      console.log('   Action: Clean up orphaned references or re-sync data');
    } else if (mismatches.length > 0) {
      console.log('⚠️  WARNING: Class name/ID mismatches found');
      console.log('   Action: Update student records to match class names');
    } else if (!graduatedClass) {
      console.log('⚠️  WARNING: "Graduated" class not found in local database');
      console.log('   Action: Ensure "Graduated" class is synced from Supabase');
    } else {
      console.log('✅ Local database classes appear to be in good condition');
      console.log('   The issue might be in the frontend data transformation');
    }
    
    console.log('\n🎯 Next steps:');
    console.log('1. If classes are missing or mismatched, run a sync operation');
    console.log('2. Check the StudentManagement component data flow');
    console.log('3. Verify the useStudentsOffline hook is working correctly');
    
  } catch (error) {
    console.error('❌ Error verifying local classes:', error);
    console.log('\nThis suggests either:');
    console.log('1. The app is not running or Tauri commands are not available');
    console.log('2. The local database is not initialized');
    console.log('3. There\'s an issue with the database commands');
  }
}

// Instructions for running
console.log('📋 Instructions:');
console.log('1. Open your Tauri app');
console.log('2. Open browser dev tools (F12)');
console.log('3. Paste this script in the console');
console.log('4. Run: verifyLocalClasses()');
console.log('');

// Make function available globally
if (typeof window !== 'undefined') {
  window.verifyLocalClasses = verifyLocalClasses;
}
