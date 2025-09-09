import { SupabaseTest } from '../components/SupabaseTest'

export function SupabaseTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-6">Supabase Connection Test</h1>
        <SupabaseTest />
      </div>
    </div>
  )
}