import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with known credentials
const supabaseUrl = 'https://mrzexdptpuzttgiwjpaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yemV4ZHB0cHV6dHRnaXdqcGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAyMTc0OTMsImV4cCI6MjA0NTc5MzQ5M30.vUZ-4YrKsA-YvHHyI3p8IHdRLRHkfXhN-IFE_mYdT6c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkClassIdConsistency() {
  console.log('=== Checking Class ID Consistency Between Local and Supabase ===\n');
  
  try {
    // 1. First, check the Supabase data structure
    console.log('1. Analyzing Supabase classes...');
    const { data: supabaseClasses, error: classError } = await supabase
      .from('classes')
      .select('*')
      .order('class_name');
    
    if (classError) {
      throw new Error(`Supabase classes error: ${classError.message}`);
    }
    
    console.log(`✅ Found ${supabaseClasses.length} classes in Supabase:`);
    supabaseClasses.forEach(cls => {
      console.log(`   - ${cls.class_name} (ID: ${cls.id}) - Active: ${cls.is_active}`);
    });
    
    // 2. Check students with class relationships
    console.log('\n2. Analyzing student-class relationships in Supabase...');
    const { data: supabaseStudents, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        admission_number,
        class_id,
        classes (
          id,
          class_name,
          is_active
        )
      `)
      .limit(50)  // Limit for analysis
      .order('first_name, last_name');
    
    if (studentError) {
      throw new Error(`Supabase students error: ${studentError.message}`);
    }
    
    console.log(`✅ Analyzed ${supabaseStudents.length} students from Supabase`);
    
    // 3. Categorize students
    const studentsWithClasses = supabaseStudents.filter(s => s.classes && s.class_id);
    const studentsWithoutClasses = supabaseStudents.filter(s => !s.classes && !s.class_id);
    const studentsWithBrokenRefs = supabaseStudents.filter(s => s.class_id && !s.classes);
    
    console.log(`\n📊 Student-Class Relationship Analysis:`);
    console.log(`   - Students with valid classes: ${studentsWithClasses.length}`);
    console.log(`   - Students without classes: ${studentsWithoutClasses.length}`);
    console.log(`   - Students with broken class references: ${studentsWithBrokenRefs.length}`);
    
    // 4. Show sample students with classes
    if (studentsWithClasses.length > 0) {
      console.log('\n3. Sample students with valid class assignments:');
      studentsWithClasses.slice(0, 5).forEach(student => {
        console.log(`   - ${student.first_name} ${student.last_name}`);
        console.log(`     Admission: ${student.admission_number}`);
        console.log(`     Class ID: ${student.class_id}`);
        console.log(`     Class Name: ${student.classes.class_name}`);
        console.log();
      });
    }
    
    // 5. Show broken references if any
    if (studentsWithBrokenRefs.length > 0) {
      console.log('4. Students with broken class references:');
      studentsWithBrokenRefs.forEach(student => {
        console.log(`   - ${student.first_name} ${student.last_name}`);
        console.log(`     Has class_id: ${student.class_id}`);
        console.log(`     But no class found`);
      });
    }
    
    // 6. Create class ID mapping for reference
    console.log('\n5. Class ID Mapping (for local database comparison):');
    const classIdMapping = {};
    supabaseClasses.forEach(cls => {
      classIdMapping[cls.class_name] = cls.id;
      console.log(`   "${cls.class_name}" -> ${cls.id}`);
    });
    
    // 7. Check for potential sync issues
    console.log('\n6. Potential Local Database Sync Issues to Check:');
    console.log('\nRun this in your Tauri app console to compare:');
    console.log('```javascript');
    console.log('// Get local classes');
    console.log('const localClasses = await window.__TAURI__.core.invoke("get_classes");');
    console.log('console.log("Local classes:", localClasses);');
    console.log('');
    console.log('// Get local students with classes');
    console.log('const localStudents = await window.__TAURI__.core.invoke("get_students");');
    console.log('console.log("Local students sample:", localStudents.slice(0, 5));');
    console.log('```');
    
    // 8. Summary
    console.log('\n=== SUMMARY ===');
    
    if (studentsWithBrokenRefs.length > 0) {
      console.log('🚨 ISSUE DETECTED: Broken class references in Supabase');
      console.log('This needs to be fixed before comparing with local data.');
    } else if (studentsWithClasses.length > 0) {
      console.log('✅ Supabase data integrity looks good');
      console.log('📋 Next step: Compare these IDs with your local database');
      
      console.log('\n📝 Expected class IDs in local database:');
      Object.entries(classIdMapping).forEach(([name, id]) => {
        const studentCount = studentsWithClasses.filter(s => s.classes.class_name === name).length;
        console.log(`   - ${name}: ${id} (${studentCount} students in sample)`);
      });
      
    } else {
      console.log('⚠️ No students with class assignments found in sample');
      console.log('Try increasing the sample size or check if data exists');
    }
    
    console.log('\n🎯 NEXT ACTIONS:');
    console.log('1. Run the browser console commands above in your Tauri app');
    console.log('2. Compare the class IDs between local and Supabase');
    console.log('3. If they don\'t match, run a sync operation');
    console.log('4. Check if local database schema matches Supabase schema');
    
  } catch (error) {
    console.error('❌ Error checking class ID consistency:', error);
    console.log('\nThis error suggests either:');
    console.log('1. Supabase connection issues');
    console.log('2. Environment variables not set correctly');
    console.log('3. Database schema differences');
  }
}

// Run the check
checkClassIdConsistency();
