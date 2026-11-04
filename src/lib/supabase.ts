import { createClient } from '@supabase/supabase-js';

export function isOfflineMode(): boolean {
  if (typeof window !== 'undefined') {
    const loc = window.location;
    if (
      loc.port === '3456' ||
      loc.hostname === 'localhost' ||
      loc.hostname === '127.0.0.1' ||
      !loc.hostname.includes('vercel.app')
    ) {
      return true;
    }
  }
  if (
    (global as any).__IS_OFFLINE__ === true ||
    process.env.OFFLINE_MODE === 'true' ||
    process.env.DATABASE_MODE === 'sqlite' ||
    process.env.IS_OFFLINE_BUNDLE === 'true' ||
    process.env.PORT === '3456' ||
    Boolean(process.env.NEXT_PUBLIC_OFFLINE_MODE)
  ) {
    return true;
  }
  if (
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true' ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV)
  ) {
    return false;
  }
  return true;
}

export function createOfflineMock(): any {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: any) => resolve({ data: [], error: null });
      }
      if (prop === 'data') return [];
      if (prop === 'error') return null;
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => Promise.resolve({ data: null, error: null });
      }
      if (prop === 'upload') {
        return () => Promise.resolve({ data: { path: '' }, error: null });
      }
      if (prop === 'getPublicUrl') {
        return () => ({ data: { publicUrl: '/logo.png' } });
      }
      if (prop === 'getUser') {
        return () => Promise.resolve({ data: { user: null }, error: null });
      }
      if (prop === 'getSession') {
        return () => Promise.resolve({ data: { session: null }, error: null });
      }
      if (prop === 'signInWithPassword') {
        return () => Promise.resolve({ data: null, error: new Error('Offline mode') });
      }
      if (prop === 'signOut') {
        return () => Promise.resolve({ error: null });
      }
      return (...args: any[]) => new Proxy({}, handler);
    }
  };

  return new Proxy({}, handler);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unctfxlnmqddykxbxxyt.supabase.co';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6e9lQ6kQ5YNEEzQk6GQAjg_v9H2VATD';

export const supabase = isOfflineMode() ? createOfflineMock() : createClient(supabaseUrl, supabasePublishableKey);

export default supabase;
