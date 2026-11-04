import { createClient } from '@supabase/supabase-js';

const isOffline = 
  process.env.NEXT_PUBLIC_OFFLINE_MODE === 'true' ||
  process.env.OFFLINE_MODE === 'true' ||
  process.env.DATABASE_MODE === 'sqlite' ||
  process.env.IS_OFFLINE_BUNDLE === 'true';

function createOfflineMock(): any {
  const chain: any = {
    select: () => chain,
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    throwOnError: () => chain,
    then: (resolve: any) => resolve({ data: [], error: null }),
  };

  return {
    from: () => chain,
    channel: () => ({
      on: () => ({ subscribe: () => ({}), on: () => ({ subscribe: () => ({}) }) }),
      subscribe: () => ({}),
      send: () => Promise.resolve({ error: null }),
    }),
    removeChannel: () => ({}),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: { path: '' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '/logo.png' } }),
      }),
    },
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unctfxlnmqddykxbxxyt.supabase.co';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6e9lQ6kQ5YNEEzQk6GQAjg_v9H2VATD';

export const supabase = isOffline ? createOfflineMock() : createClient(supabaseUrl, supabasePublishableKey);

export default supabase;
