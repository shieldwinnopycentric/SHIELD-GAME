import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Shared singleton so server.js (leaderboard writes) and challenges.js
// (admin content CRUD) don't create two separate clients.
export const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;