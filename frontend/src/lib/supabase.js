import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export async function fetchGlobalLeaderboard(limit = 10) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("global_leaderboard")
    .select("*")
    .order("best_score", { ascending: false })
    .order("best_time_ms", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.error("fetchGlobalLeaderboard error:", error.message);
    throw error;
  }
  return data;
}
