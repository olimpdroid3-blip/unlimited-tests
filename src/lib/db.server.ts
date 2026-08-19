// Server-only Supabase client (service role) for the GvG project database.
// Bypasses RLS — never import from client code.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, k) => headers.set(k, value));
    }
    headers.set('apikey', key);
    headers.set('Authorization', `Bearer ${key}`);
    return fetch(input, { ...init, headers });
  };
}

function create() {
  const url = process.env.GVG_SUPABASE_URL;
  const key = process.env.GVG_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing GVG_SUPABASE_URL / GVG_SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _admin: ReturnType<typeof create> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof create>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = create();
    return Reflect.get(_admin, prop, receiver);
  },
});
