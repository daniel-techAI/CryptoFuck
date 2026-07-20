import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

export const isCloudProfilesConfigured = Boolean(supabaseUrl && supabaseKey);

let clientPromise: Promise<SupabaseClient | null> | undefined;

export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!isCloudProfilesConfigured) return Promise.resolve(null);
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(
    supabaseUrl!,
    supabaseKey!,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    },
  ));
  return clientPromise;
}

export function authRedirectUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}
