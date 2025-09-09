import { supabase } from './src/integrations/supabase/client.ts';

async function checkClassConsistency() {
  console.log('=== Checking Class ID Consistency ===\n');
  
  try {
    // 1. Get all classes from Supabase
    console.log('1. Fetching classes from Supabase...');
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('*')
      .order('class_name');
    
    if (classError) throw classError;
    
    console.log(`✅ Found ${classes.length} classes in Supabase:`);
    classes.forEach(cls => {
      console.log(`   - ${cls.class_name} (ID: ${cls.id}) - Active: ${cls.is_active}`);
    });
    
    // 2. Get students with their class assignments
    console.log('\n2. Fetching students with class assignments...');
    const { data: studentsWithClasses, error: studentError } = await supabase
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
      .order('first_name, last_name');
    
    if (studentError) throw studentError;
    
    // 3. Analyze the data
    const studentsWithValidClasses = studentsWithClasses.filter(s => s.classes && s.class_id);
    const studentsWithoutClasses = studentsWithClasses.filter(s => !s.classes || !s.class_id);
    const studentsWithOrphanedClassIds = studentsWithClasses.filter(s => s.class_id && !s.classes);
    
    console.log(`\n✅ Total students: ${studentsWithClasses.length}`);
    console.log(`✅ Students with valid class assignments: ${studentsWithValidClasses.length}`);
    console.log(`⚠️ Students without classes: ${studentsWithoutClasses.length}`);
    console.log(`🚨 Students with orphaned class_ids: ${studentsWithOrphanedClassIds.length}`);
    
    // 4. Show sample students with classes
    if (studentsWithValidClasses.length > 0) {
      console.log('\n3. Sample students with valid class assignments:');
      studentsWithValidClasses.slice(0, 10).forEach(student => {
        console.log(`   - ${student.first_name} ${student.last_name} (${student.admission_number})`);
        console.log(`     Class ID: ${student.class_id}`);
        console.log(`     Class Name: ${student.classes.class_name}`);
        console.log(`     Class Active: ${student.classes.is_active}`);
        console.log();
      });
    }
    
    // 5. Show students with issues
    if (studentsWithOrphanedClassIds.length > 0) {
      console.log('\n4. Students with orphaned class_ids (class_id exists but no matching class):');
      studentsWithOrphanedClassIds.slice(0, 5).forEach(student => {
        console.log(`   - ${student.first_name} ${student.last_name}`);
        console.log(`     Orphaned class_id: ${student.class_id}`);
      });
    }
    
    // 6. Check for class ID consistency issues
    const classIdMap = new Map();
    classes.forEach(cls => classIdMap.set(cls.id, cls));
    
    console.log('\n5. Checking class ID consistency...');
    let inconsistencyCount = 0;
    
    studentsWithValidClasses.forEach(student => {
      const expectedClass = classIdMap.get(student.class_id);
      if (!expectedClass) {
        console.log(`❌ Student ${student.first_name} ${student.last_name} has class_id ${student.class_id} but no matching class found`);
        inconsistencyCount++;
      } else if (expectedClass.class_name !== student.classes.class_name) {
        console.log(`❌ Student ${student.first_name} ${student.last_name} class name mismatch:`);
        console.log(`   Expected: ${expectedClass.class_name}`);
        console.log(`   Got: ${student.classes.class_name}`);
        inconsistencyCount++;
      }
    });
    
    // 7. Summary and recommendations
    console.log('\n=== ANALYSIS SUMMARY ===');
    
    if (inconsistencyCount === 0 && studentsWithOrphanedClassIds.length === 0) {
      console.log('✅ No class ID inconsistencies detected in Supabase data.');
      console.log('✅ All student-class relationships appear to be valid.');
      
      if (studentsWithValidClasses.length > 0) {
        console.log('\n📊 Class Distribution:');
        const classDistribution = {};
        studentsWithValidClasses.forEach(student => {
          const className = student.classes.class_name;
          classDistribution[className] = (classDistribution[className] || 0) + 1;
        });
        
        Object.entries(classDistribution)
          .sort(([,a], [,b]) => b - a)
          .forEach(([className, count]) => {
            console.log(`   - ${className}: ${count} students`);
          });
      }
      
      console.log('\n🎯 NEXT STEPS:');
      console.log('Since Supabase data looks consistent, the issue might be:');
      console.log('1. Local database sync - run a sync operation');
      console.log('2. Data transformation in the frontend hooks');
      console.log('3. Local database schema differences');
      
    } else {
      console.log('🚨 ISSUES DETECTED:');
      console.log(`   - Inconsistencies: ${inconsistencyCount}`);
      console.log(`   - Orphaned class_ids: ${studentsWithOrphanedClassIds.length}`);
      
      console.log('\n🔧 RECOMMENDATIONS:');
      console.log('1. Clean up orphaned class_id references');
      console.log('2. Verify class data integrity');
      console.log('3. Run data migration/cleanup scripts');
      console.log('4. Re-sync local database from clean Supabase data');
    }
    
  } catch (error) {
    console.error('❌ Error checking class consistency:', error);
  }
}

// Run the check
checkClassConsistency();
