// Test script to sync classes and verify borrowing limits
// Run this in the browser console when the app is running

async function testClassesSync() {
  try {
    console.log('🔄 Testing classes sync with borrowing limits...');
    
    // First, check current classes
    console.log('\n📋 Current classes before sync:');
    const classesBefore = await window.__TAURI__.invoke('get_classes');
    console.log(`Found ${classesBefore.length} classes`);
    
    if (classesBefore.length > 0) {
      console.log('Sample classes:');
      classesBefore.slice(0, 5).forEach(cls => {
        console.log(`  - ${cls.class_name}: max_books=${cls.max_books_allowed || 'undefined'}`);
      });
    }
    
    // Sync classes from Supabase
    console.log('\n🔄 Syncing classes from Supabase...');
    const syncResult = await window.__TAURI__.invoke('sync_classes_only');
    console.log(`✅ Classes sync completed: ${syncResult} records`);
    
    // Check classes after sync
    console.log('\n📋 Classes after sync:');
    const classesAfter = await window.__TAURI__.invoke('get_classes');
    console.log(`Found ${classesAfter.length} classes`);
    
    if (classesAfter.length > 0) {
      console.log('Sample classes with borrowing limits:');
      classesAfter.slice(0, 10).forEach(cls => {
        console.log(`  - ${cls.class_name}: max_books=${cls.max_books_allowed}, active=${cls.is_active}`);
      });
      
      // Check if we have varied borrowing limits (not all 2)
      const uniqueLimits = [...new Set(classesAfter.map(c => c.max_books_allowed))];
      console.log(`\n📊 Unique borrowing limits found: ${uniqueLimits.join(', ')}`);
      
      if (uniqueLimits.length === 1 && uniqueLimits[0] === 2) {
        console.log('⚠️  All classes still have default limit (2) - sync may not be working properly');
      } else {
        console.log('✅ Borrowing limits are properly synced from Supabase!');
      }
    }
    
    // Test borrowing limit enforcement
    console.log('\n🧪 Testing borrowing limit enforcement...');
    
    // Get a student with a class
    const students = await window.__TAURI__.invoke('get_students');
    const studentWithClass = students.find(s => s.class_id);
    
    if (studentWithClass) {
      const studentClass = classesAfter.find(c => c.id === studentWithClass.class_id);
      if (studentClass) {
        console.log(`📚 Student: ${studentWithClass.first_name} ${studentWithClass.last_name}`);
        console.log(`📚 Class: ${studentClass.class_name}`);
        console.log(`📚 Max books allowed: ${studentClass.max_books_allowed}`);
        
        // Check current borrowings
        const borrowings = await window.__TAURI__.invoke('get_borrowings');
        const studentBorrowings = borrowings.filter(b => b.student_id === studentWithClass.id && b.status === 'active');
        console.log(`📚 Current active borrowings: ${studentBorrowings.length}`);
        
        if (studentBorrowings.length >= studentClass.max_books_allowed) {
          console.log('⚠️  Student has reached or exceeded borrowing limit');
        } else {
          console.log('✅ Student can borrow more books');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing classes sync:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  }
}

// Run the test
testClassesSync();
