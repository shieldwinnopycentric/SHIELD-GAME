import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Optional: only used to *read* the public `global_leaderboard` view.
// Writing results always goes through the backend (service role key),
// never directly from the browser.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export async function fetchGlobalLeaderboard(limit = 10) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("global_leaderboard")
    .select("*")
    .limit(limit);
  if (error) {
    console.error("fetchGlobalLeaderboard error:", error.message);
    throw error; // let the caller (GlobalLeaderboard.jsx) show a real error
                 // message instead of silently looking like "no data yet"
  }
  return data;
}