import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unctfxlnmqddykxbxxyt.supabase.co';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6e9lQ6kQ5YNEEzQk6GQAjg_v9H2VATD';

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

export default supabase;
