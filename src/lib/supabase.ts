import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clearSupabaseStoredSession,
  getSupabaseSessionPersistenceMode,
  isSupabaseConfigured,
  setSupabaseSessionPersistence,
  supabase as typedSupabase,
  supabaseAnonKey,
  supabaseUrl,
  type AuthPersistenceMode,
} from "@/services/supabase";

// Legacy services still expect untyped supabase responses.
const supabase = typedSupabase as unknown as SupabaseClient<any>;

export {
  clearSupabaseStoredSession,
  getSupabaseSessionPersistenceMode,
  isSupabaseConfigured,
  setSupabaseSessionPersistence,
  supabase,
  supabaseAnonKey,
  supabaseUrl,
  type AuthPersistenceMode,
};
