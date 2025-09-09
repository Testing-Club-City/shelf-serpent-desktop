import { useState } from 'react'
import { runSupabaseTests } from '../utils/supabase-test'

export function SupabaseTest() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<string>('')

  const handleTest = async () => {
    setIsLoading(true)
    setResults('')
    
    // Capture console output
    const originalLog = console.log
    const originalError = console.error
    let output = ''
    
    console.log = (...args) => {
      output += args.join(' ') + '\n'
      originalLog(...args)
    }
    
    console.error = (...args) => {
      output += 'ERROR: ' + args.join(' ') + '\n'
      originalError(...args)
    }
    
    try {
      await runSupabaseTests()
    } catch (err) {
      output += `EXCEPTION: ${err}\n`
    }
    
    // Restore console
    console.log = originalLog
    console.error = originalError
    
    setResults(output)
    setIsLoading(false)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Supabase Connection Test</h2>
      
      <button
        onClick={handleTest}
        disabled={isLoading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isLoading ? 'Testing...' : 'Test Supabase Connection'}
      </button>
      
      {results && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">Results:</h3>
          <pre className="whitespace-pre-wrap text-sm">{results}</pre>
        </div>
      )}
    </div>
  )
}