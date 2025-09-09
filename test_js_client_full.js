import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Use the same configuration as the main app client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'shelf-serpent-archive-manager'
    }
  }
});

async function testClassesQuery() {
  console.log('Testing classes query with full client configuration...');
  
  try {
    const { data, error, count } = await supabase
      .from('classes')
      .select('*', { count: 'exact' });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log(`Found ${count} classes`);
    if (data && data.length > 0) {
      console.log('First record:', data[0]);
    }
    
  } catch (err) {
    console.error('Exception:', err);
  }
}

testClassesQuery();