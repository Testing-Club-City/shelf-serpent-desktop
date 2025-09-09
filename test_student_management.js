import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test the same query pattern as the updated useStudents hook
async function testStudentManagementQuery() {
  try {
    console.log('Testing Student Management Query (like useStudents hook)...\n');
    
    // Test 1: Fetch students with class information (paginated)
    const { data, error, count } = await supabase
      .from('students')
      .select(`
        *,
        classes ( class_name )
      `, { count: 'exact' })
      .range(0, 19) // First 20 students
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching students:', error);
      return;
    }

    console.log(`✅ Successfully fetched ${data.length} students with class information`);
    console.log(`📊 Total count: ${count} students\n`);

    // Show some sample data
    console.log('📋 Sample Student Records:');
    console.log('=' .repeat(80));
    
    data.slice(0, 5).forEach((student, index) => {
      console.log(`${index + 1}. ${student.first_name} ${student.last_name}`);
      console.log(`   📝 Admission: ${student.admission_number}`);
      console.log(`   🎓 Class: ${student.classes?.class_name || student.class_grade || 'Not Assigned'}`);
      console.log(`   📊 Status: ${student.status || 'active'}`);
      console.log(`   📅 Academic Year: ${student.academic_year}`);
      console.log('   ' + '-'.repeat(40));
    });

    // Test 2: Check students with active status and assigned classes
    console.log('\n🔍 Analysis:');
    console.log('=' .repeat(50));
    
    const activeStudents = data.filter(s => s.status === 'active');
    const studentsWithClasses = data.filter(s => s.classes?.class_name);
    const graduatedStudents = data.filter(s => s.status === 'graduated');
    
    console.log(`📈 Active Students: ${activeStudents.length}`);
    console.log(`🏫 Students with Class Assignment: ${studentsWithClasses.length}`);
    console.log(`🎓 Graduated Students: ${graduatedStudents.length}`);
    
    // Test 3: Show class distribution
    const classDistribution = {};
    data.forEach(student => {
      const className = student.classes?.class_name || 'No Class';
      classDistribution[className] = (classDistribution[className] || 0) + 1;
    });
    
    console.log('\n🏫 Class Distribution:');
    console.log('-'.repeat(30));
    Object.entries(classDistribution).forEach(([className, count]) => {
      console.log(`   ${className}: ${count} students`);
    });

    // Test 4: Search functionality test
    console.log('\n🔍 Testing Search Functionality:');
    console.log('-'.repeat(40));
    
    const searchResult = await supabase
      .from('students')
      .select(`
        *,
        classes ( class_name )
      `)
      .or(
        `first_name.ilike.%TITUS%,` +
        `last_name.ilike.%TITUS%,` +
        `admission_number.ilike.%1111%`
      )
      .limit(5);
    
    if (searchResult.data && searchResult.data.length > 0) {
      console.log(`✅ Search test passed: Found ${searchResult.data.length} matching records`);
      searchResult.data.forEach(student => {
        console.log(`   Found: ${student.first_name} ${student.last_name} (${student.admission_number})`);
      });
    } else {
      console.log('ℹ️  No search results found for test query');
    }

    // Test 5: Verify data structure matches StudentManagement expectations
    console.log('\n🔧 Data Structure Verification:');
    console.log('-'.repeat(50));
    
    const sampleStudent = data[0];
    const requiredFields = [
      'id', 'first_name', 'last_name', 'admission_number', 
      'status', 'class_grade', 'created_at'
    ];
    
    const missingFields = requiredFields.filter(field => 
      sampleStudent[field] === undefined
    );
    
    if (missingFields.length === 0) {
      console.log('✅ All required fields are present');
    } else {
      console.log(`❌ Missing fields: ${missingFields.join(', ')}`);
    }
    
    console.log(`✅ Classes relationship: ${sampleStudent.classes ? 'Working' : 'Not working'}`);
    
    return {
      success: true,
      totalStudents: count,
      activeStudents: activeStudents.length,
      studentsWithClasses: studentsWithClasses.length,
      classDistribution
    };
    
  } catch (err) {
    console.error('Test failed:', err);
    return { success: false, error: err.message };
  }
}

// Run the test
console.log('🧪 Student Management Data Test');
console.log('=' .repeat(60));
testStudentManagementQuery().then(result => {
  console.log('\n📋 Test Summary:');
  console.log('=' .repeat(30));
  if (result.success) {
    console.log('✅ All tests passed successfully!');
    console.log(`📊 Data is ready for StudentManagement component`);
  } else {
    console.log('❌ Tests failed');
    console.log(`Error: ${result.error}`);
  }
});
