
import { invoke } from '@tauri-apps/api/core';

// Test the ISBN fix
async function testFix() {
  try {
    console.log('🔧 Fixing ISBN constraint...');
    const result = await invoke('fix_isbn_constraint');
    console.log('✅ Fix result:', result);
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

testFix();

