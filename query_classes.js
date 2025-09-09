
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getClasses() {
  try {
    const { data, error } = await supabase.from('classes').select('*');
    if (error) {
      console.error('Error fetching classes:', error);
      return;
    }
    console.log('Classes:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

getClasses();
