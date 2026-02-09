import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Só cria o cliente Supabase se as credenciais estiverem configuradas
let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('[Supabase] Cliente inicializado');
} else {
  console.warn('[Supabase] Credenciais não configuradas - usando API local');
}

export { supabase };
export default supabase;
