'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestSupabasePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testConnection() {
      const result = await supabase
        .from('vehicles')
        .select('*')
        .order('name');

      console.log('SUPABASE DATA:', result.data);
      console.log('SUPABASE ERROR:', result.error);

      if (result.error) {
        setError(result.error.message);
      } else {
        setData(result.data);
      }

      setLoading(false);
    }

    testConnection();
  }, []);

  if (loading) {
    return <div style={{ padding: 40 }}>Menghubungkan ke Supabase...</div>;
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Supabase Connection Test</h1>

      {error ? (
        <div>
          <h2>❌ Error</h2>
          <pre>{error}</pre>
        </div>
      ) : (
        <div>
          <h2>✅ Supabase Terhubung</h2>

          <pre>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}