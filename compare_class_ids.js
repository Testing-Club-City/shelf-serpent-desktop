// This script needs to be run within the Tauri app context
// You can run it in the browser console when the app is open

async function compareClassIds() {
  console.log('=== Comparing Class IDs: Local DB vs Supabase ===\n');
  
  try {
    // 1. Get classes from local database (Tauri backend)
    console.log('1. Fetching classes from local database...');
    const localClasses = await window.__TAURI__.core.invoke('get_classes');
    console.log(`✅ Found ${localClasses.length} classes in local database`);
    
    // 2. Get classes from Supabase
    console.log('\n2. Fetching classes from Supabase...');
    // Import supabase client (you might need to adjust this import path)
    const { supabase } = await import('/src/integrations/supabase/client.js');
    const { data: supabaseClasses, error } = await supabase
      .from('classes')
      .select('*');
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    console.log(`✅ Found ${supabaseClasses.length} classes in Supabase`);
    
    // 3. Create maps for easier comparison
    const localClassMap = new Map();
    const supabaseClassMap = new Map();
    
    localClasses.forEach(cls => {
      localClassMap.set(cls.class_name, {
        id: cls.id,
        class_name: cls.class_name,
        form_level: cls.form_level,
        class_section: cls.class_section,
        is_active: cls.is_active
      });
    });
    
    supabaseClasses.forEach(cls => {
      supabaseClassMap.set(cls.class_name, {
        id: cls.id,
        class_name: cls.class_name,
        form_level: cls.form_level,
        class_section: cls.class_section,
        is_active: cls.is_active
      });
    });
    
    // 4. Compare classes
    console.log('\n3. Comparing classes...');
    
    const matchingClasses = [];
    const mismatchedIds = [];
    const localOnlyClasses = [];
    const supabaseOnlyClasses = [];
    
    // Check classes in both databases
    for (const [className, localClass] of localClassMap) {
      if (supabaseClassMap.has(className)) {
        const supabaseClass = supabaseClassMap.get(className);
        if (localClass.id === supabaseClass.id) {
          matchingClasses.push({
            name: className,
            id: localClass.id,
            local: localClass,
            supabase: supabaseClass
          });
        } else {
          mismatchedIds.push({
            name: className,
            localId: localClass.id,
            supabaseId: supabaseClass.id,
            local: localClass,
            supabase: supabaseClass
          });
        }
      } else {
        localOnlyClasses.push(localClass);
      }
    }
    
    // Check for Supabase-only classes
    for (const [className, supabaseClass] of supabaseClassMap) {
      if (!localClassMap.has(className)) {
        supabaseOnlyClasses.push(supabaseClass);
      }
    }
    
    // 5. Report results
    console.log('\n=== COMPARISON RESULTS ===');
    console.log(`\n✅ Matching Classes (same ID): ${matchingClasses.length}`);
    if (matchingClasses.length > 0) {
      matchingClasses.forEach(match => {
        console.log(`   - ${match.name}: ${match.id}`);
      });
    }
    
    console.log(`\n⚠️  Classes with Mismatched IDs: ${mismatchedIds.length}`);
    if (mismatchedIds.length > 0) {
      mismatchedIds.forEach(mismatch => {
        console.log(`   - ${mismatch.name}:`);
        console.log(`     Local ID:    ${mismatch.localId}`);
        console.log(`     Supabase ID: ${mismatch.supabaseId}`);
      });
    }
    
    console.log(`\n📱 Local-Only Classes: ${localOnlyClasses.length}`);
    if (localOnlyClasses.length > 0) {
      localOnlyClasses.forEach(cls => {
        console.log(`   - ${cls.class_name}: ${cls.id}`);
      });
    }
    
    console.log(`\n☁️  Supabase-Only Classes: ${supabaseOnlyClasses.length}`);
    if (supabaseOnlyClasses.length > 0) {
      supabaseOnlyClasses.forEach(cls => {
        console.log(`   - ${cls.class_name}: ${cls.id}`);
      });
    }
    
    // 6. Check student class assignments
    console.log('\n4. Checking student class assignments...');
    const localStudents = await window.__TAURI__.core.invoke('get_students');
    const { data: supabaseStudents } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, class_id');
    
    console.log(`Local students: ${localStudents.length}`);
    console.log(`Supabase students: ${supabaseStudents.length}`);
    
    // Sample a few students to check class_id matching
    const sampleStudents = localStudents.slice(0, 5);
    console.log('\nSample student class_id comparison:');
    
    for (const localStudent of sampleStudents) {
      const supabaseStudent = supabaseStudents.find(s => 
        s.admission_number === localStudent.admission_number
      );
      
      if (supabaseStudent) {
        const idsMatch = localStudent.class_id === supabaseStudent.class_id;
        console.log(`   - ${localStudent.first_name} ${localStudent.last_name}:`);
        console.log(`     Local class_id:    ${localStudent.class_id || 'null'}`);
        console.log(`     Supabase class_id: ${supabaseStudent.class_id || 'null'}`);
        console.log(`     IDs Match: ${idsMatch ? '✅' : '❌'}`);
      }
    }
    
    console.log('\n=== SUMMARY ===');
    if (mismatchedIds.length > 0) {
      console.log('🚨 CLASS ID MISMATCH DETECTED!');
      console.log('This could be causing the class display issues.');
      console.log('Consider running a sync operation to align the IDs.');
    } else if (matchingClasses.length > 0) {
      console.log('✅ Class IDs appear to be synchronized.');
      console.log('The issue might be elsewhere in the data flow.');
    } else {
      console.log('⚠️ No overlapping classes found between databases.');
    }
    
  } catch (error) {
    console.error('❌ Error comparing class IDs:', error);
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure you\'re running this in the Tauri app context');
    console.log('2. Check if the local database has been initialized');
    console.log('3. Verify Supabase connection is working');
  }
}

// Instructions for running this script
console.log('To run this comparison:');
console.log('1. Open your Tauri app');
console.log('2. Open browser dev tools (F12)');
console.log('3. Paste this script in the console');
console.log('4. Call: compareClassIds()');

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { compareClassIds };
}
