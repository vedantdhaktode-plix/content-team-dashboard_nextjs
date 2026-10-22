import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "./config";

let browserClient;

export function createClient() {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
  }
  return browserClient;
}
