// Browser Supabase client for the GvG project database.
// Publishable (anon) key is public by design.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export const GVG_SUPABASE_URL = 'https://aabaapmktkfwmvgcirxb.supabase.co';
export const GVG_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MBLfvi1fzfED-yHIPG4Zjw_keR88XKs';

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, k) => headers.set(k, value));
    }
    if (headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
    headers.set('apikey', key);
    return fetch(input, { ...init, headers });
  };
}

function create() {
  return createClient<Database>(GVG_SUPABASE_URL, GVG_SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(GVG_SUPABASE_PUBLISHABLE_KEY) },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _client: ReturnType<typeof create> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof create>, {
  get(_, prop, receiver) {
    if (!_client) _client = create();
    return Reflect.get(_client, prop, receiver);
  },
});
