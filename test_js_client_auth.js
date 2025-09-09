import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

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

async function testWithAuth() {
  console.log('Testing classes query with authentication...');
  
  try {
    // First check if there's an existing session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
    }
    
    console.log('Current session:', session ? 'Authenticated' : 'Not authenticated');
    
    // Test classes query without auth
    console.log('\n--- Testing without authentication ---');
    const { data: unauthData, error: unauthError, count: unauthCount } = await supabase
      .from('classes')
      .select('*', { count: 'exact' });
    
    if (unauthError) {
      console.error('Unauth error:', unauthError);
    } else {
      console.log(`Unauthenticated: Found ${unauthCount} classes`);
    }
    
    // Try to sign in with a test account (you'll need to provide credentials)
    console.log('\n--- Attempting authentication ---');
    console.log('Note: This test needs valid credentials to demonstrate the difference');
    console.log('The UI likely has an authenticated session that allows access to more data');
    
  } catch (err) {
    console.error('Exception:', err);
  }
}

testWithAuth();