// Supabase public configuration — ISP Consulte external project
// These are PUBLIC keys (anon key is safe to expose in client-side code)
import { createClient } from "@supabase/supabase-js";
import { supabaseMemoryStorage } from "@/modules/shared/storage";

export const SUPABASE_URL = "https://stubkeeuttixteqckshd.supabase.co";

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0dWJrZWV1dHRpeHRlcWNrc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjQ0OTIsImV4cCI6MjA3MzA0MDQ5Mn0.YcpSKrTSb1P1REC8lgkdduDITX52h_z7ArPD6XIkrlU";

/**
 * Single Supabase client for the external ISP Consulte project.
 * All modules should import this instead of creating their own clients.
 */
export const supabaseExt = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: supabaseMemoryStorage,
    persistSession: false,
    autoRefreshToken: true,
  },
});
