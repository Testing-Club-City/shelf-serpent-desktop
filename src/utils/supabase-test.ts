import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function testSupabaseConnection() {
  try {
    // Test basic connection with a simple query
    const { data, error } = await supabase.from('books').select('count', { count: 'exact', head: true })
    
    if (error) {
      console.error('❌ Supabase connection error:', error.message)
      console.log('🔧 Error details:', error)
      return false
    }
    
    console.log('✅ Supabase connection successful')
    console.log('🌐 Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
    return true
  } catch (err) {
    console.error('❌ Supabase connection failed:', err)
    return false
  }
}

export async function listSupabaseTables() {
  try {
    // Query information_schema to get table names
    const { data, error } = await supabase.rpc('get_table_names')
    
    if (error) {
      console.error('Error fetching tables:', error)
      // Fallback: try to query known tables including classes
      const knownTables = ['books', 'students', 'borrowings', 'categories', 'staff', 'fines', 'classes']
      console.log('📋 Checking known tables:')
      
      for (const table of knownTables) {
        try {
          const { error: tableError } = await supabase.from(table).select('*').limit(1)
          console.log(tableError ? `❌ ${table}` : `✅ ${table}`)
        } catch {
          console.log(`❌ ${table}`)
        }
      }
      return
    }
    
    console.log('📋 Available tables:', data)
    return data
  } catch (err) {
    console.error('❌ Error listing tables:', err)
  }
}

export async function checkClassesTable() {
  try {
    console.log('🔍 Checking classes table specifically...')
    
    // First, get table structure
    const { data: structureData, error: structureError } = await supabase
      .from('classes')
      .select('*')
      .limit(1)
    
    if (structureError) {
      console.error('❌ Classes table error:', structureError.message)
      return null
    }
    
    // Get column names from first record
    const columns = structureData && structureData.length > 0 ? Object.keys(structureData[0]) : []
    console.log('📋 Classes table columns:', columns.join(', '))
    
    // Get all classes data with count
    const { data, error, count } = await supabase
      .from('classes')
      .select('*', { count: 'exact' })
      .order('id', { ascending: true })
    
    if (error) {
      console.error('❌ Classes table error:', error.message)
      return null
    }
    
    console.log(`✅ Classes table found with ${count} total records`)
    
    if (data && data.length > 0) {
      console.log('\n📊 CLASSES DATA:')
      console.log('=' .repeat(60))
      
      data.forEach((classItem, index) => {
        console.log(`\n🏫 Class ${index + 1}:`)
        Object.entries(classItem).forEach(([key, value]) => {
          const displayValue = typeof value === 'object' && value !== null 
            ? JSON.stringify(value, null, 2)
            : String(value)
          console.log(`   ${key}: ${displayValue}`)
        })
      })
      
      console.log('\n' + '=' .repeat(60))
      console.log(`📈 Total classes displayed: ${data.length}`)
    } else {
      console.log('⚠️ No class data found')
    }
    
    return data
  } catch (err) {
    console.error('❌ Error checking classes table:', err)
    return null
  }
}

// Run tests
export async function runSupabaseTests() {
  console.log('🔍 Testing Supabase connection...')
  
  const isConnected = await testSupabaseConnection()
  if (isConnected) {
    await listSupabaseTables()
    console.log('\n' + '='.repeat(50))
    await checkClassesTable()
  }
}