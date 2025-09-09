
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getStudents() {
  try {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        classes ( class_name )
      `);

    if (error) {
      console.error('Error fetching students:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('Yes, the classes have students. Here is the list of students and their classes:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('No, the classes do not have any students.');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

getStudents();
