// Test how the UI displays student status
// Simulating the current UI logic

function getStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'active':
            return 'bg-green-100 text-green-800';
        case 'inactive':
            return 'bg-red-100 text-red-800';
        case 'graduated':
            return 'bg-blue-100 text-blue-800';
        case 'transferred':
            return 'bg-purple-100 text-purple-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// Test cases based on current database status
const testStudents = [
    { status: 'active', name: 'John Doe' },
    { status: 'inactive', name: 'Jane Smith' },
    { status: null, name: 'Bob Johnson' },
    { status: undefined, name: 'Alice Brown' }
];

console.log('🔍 UI STATUS DISPLAY TEST');
console.log('='.repeat(50));

testStudents.forEach(student => {
    const displayStatus = student.status || 'Active';
    const colorClass = getStatusColor(student.status || 'active');
    
    console.log(`Student: ${student.name}`);
    console.log(`  Database Status: ${student.status || 'NULL'}`);
    console.log(`  UI Display: "${displayStatus}"`);
    console.log(`  Color Class: ${colorClass}`);
    console.log('');
});

console.log('📊 CURRENT ISSUE:');
console.log('- Students with status="inactive" will show as "inactive" (lowercase)');
console.log('- Students with status="active" will show as "active" (lowercase)');
console.log('- This looks unprofessional in the UI');
console.log('');
console.log('💡 SOLUTION NEEDED:');
console.log('- Capitalize the status display text');
console.log('- Make it user-friendly (e.g., "Active", "Inactive")');
