import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testClassesQuery() {
  console.log('Testing classes query with JavaScript client...');
  
  try {
    const { data, error, count } = await supabase
      .from('classes')
      .select('*', { count: 'exact' });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log(`Found ${count} classes`);
    console.log('First few records:', data?.slice(0, 3));
    
  } catch (err) {
    console.error('Exception:', err);
  }
}

testClassesQuery();