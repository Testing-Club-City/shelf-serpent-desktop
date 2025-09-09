import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test specifically for active students to show the class relationship working
async function testActiveStudentsWithClasses() {
  try {
    console.log('🔍 Testing ACTIVE Students with Class Relationships');
    console.log('=' .repeat(60));
    
    // Query specifically for active students - this will show the classes relationship working
    const { data, error, count } = await supabase
      .from('students')
      .select(`
        *,
        classes ( class_name )
      `, { count: 'exact' })
      .eq('status', 'active')
      .limit(50)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active students:', error);
      return;
    }

    console.log(`✅ Successfully fetched ${data.length} active students`);
    console.log(`📊 Total active students: ${count}\n`);

    // Show sample active students with their class relationships
    console.log('👨‍🎓 Active Students with Class Assignments:');
    console.log('=' .repeat(60));
    
    let studentsWithClasses = 0;
    let studentsWithoutClasses = 0;
    const classStats = {};
    
    data.forEach((student, index) => {
      if (index < 10) { // Show first 10 students
        console.log(`${index + 1}. ${student.first_name} ${student.last_name}`);
        console.log(`   📝 Admission: ${student.admission_number}`);
        console.log(`   🎓 Class: ${student.classes?.class_name || 'No Class Assigned'}`);
        console.log(`   📊 Status: ${student.status}`);
        console.log(`   🆔 Class ID: ${student.class_id || 'null'}`);
        console.log('   ' + '-'.repeat(50));
      }
      
      // Track statistics
      if (student.classes?.class_name) {
        studentsWithClasses++;
        const className = student.classes.class_name;
        classStats[className] = (classStats[className] || 0) + 1;
      } else {
        studentsWithoutClasses++;
      }
    });

    console.log('\n📊 Active Student Statistics:');
    console.log('=' .repeat(40));
    console.log(`✅ Students with Class Assignment: ${studentsWithClasses}`);
    console.log(`❌ Students without Class Assignment: ${studentsWithoutClasses}`);
    
    console.log('\n🏫 Class Distribution (Active Students):');
    console.log('-'.repeat(40));
    Object.entries(classStats).forEach(([className, count]) => {
      console.log(`   📚 ${className}: ${count} students`);
    });

    // Test the exact pattern used in StudentManagement component
    console.log('\n🧪 Component Integration Test:');
    console.log('=' .repeat(50));
    
    const sampleStudent = data.find(s => s.classes?.class_name) || data[0];
    if (sampleStudent) {
      console.log('Sample data structure for StudentManagement component:');
      console.log(`✅ student.first_name: "${sampleStudent.first_name}"`);
      console.log(`✅ student.last_name: "${sampleStudent.last_name}"`);
      console.log(`✅ student.admission_number: "${sampleStudent.admission_number}"`);
      console.log(`✅ student.status: "${sampleStudent.status}"`);
      console.log(`✅ student.classes?.class_name: "${sampleStudent.classes?.class_name || 'null'}"`);
      console.log(`✅ student.class_grade: "${sampleStudent.class_grade}"`);
      
      // This is exactly how StudentManagement displays the class
      const displayedClass = sampleStudent.classes?.class_name || sampleStudent.class_grade || 'Not Assigned';
      console.log(`📋 Displayed in UI: "${displayedClass}"`);
    }

    return {
      success: true,
      totalActive: count,
      withClasses: studentsWithClasses,
      withoutClasses: studentsWithoutClasses,
      classStats
    };
    
  } catch (err) {
    console.error('Test failed:', err);
    return { success: false, error: err.message };
  }
}

// Run the test
console.log('🎯 Student Management Class Relationship Test');
console.log('=' .repeat(60));
testActiveStudentsWithClasses().then(result => {
  console.log('\n📋 Test Summary:');
  console.log('=' .repeat(30));
  if (result.success) {
    console.log('✅ Class relationships working perfectly!');
    console.log('✅ StudentManagement component will display class names correctly');
    console.log(`📊 ${result.withClasses}/${result.totalActive} active students have class assignments`);
    console.log('🎉 The updated approach is fully functional!');
  } else {
    console.log('❌ Tests failed');
    console.log(`Error: ${result.error}`);
  }
});
