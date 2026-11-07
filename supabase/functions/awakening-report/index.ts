import { createHandler } from './handler.mjs';

const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(createHandler(async (name: string, args: unknown) => {
  if (!url || !key) throw new Error('Unavailable');
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Database operation failed');
  return response.json();
}));
