import { useEffect, useState } from "react";
import { supabase, fetchGlobalLeaderboard } from "../lib/supabase.js";

function formatTime(ms) {
  if (ms == null) return "—";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const CHAR_LABELS = { nexus: "Nexus", cypher: "Cypher", helix: "Helix" };

// All-time leaderboard across every past session (not just this room),
// read from the `global_leaderboard` view in Supabase. Requires
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to be set in frontend/.env
// AND SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in backend/.env (so the
// backend actually writes results after each game — see README).
export default function GlobalLeaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    fetchGlobalLeaderboard(10)
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (!supabase) {
    return (
      <div className="bg-panel border border-line rounded-lg p-4 text-sm text-parchment/50">
        Leaderboard global (lintas sesi) belum aktif — set{" "}
        <code>VITE_SUPABASE_URL</code> &amp; <code>VITE_SUPABASE_ANON_KEY</code> di{" "}
        <code>frontend/.env</code>, dan pastikan backend juga sudah diisi{" "}
        <code>SUPABASE_URL</code>/<code>SUPABASE_SERVICE_ROLE_KEY</code> supaya hasil game
        benar-benar tersimpan.
      </div>
    );
  }

  if (loading) return <p className="text-parchment/40 text-sm">Memuat leaderboard global...</p>;
  if (error) return <p className="text-danger text-sm">Gagal memuat leaderboard global: {error}</p>;
  if (rows.length === 0) {
    return (
      <p className="text-parchment/40 text-sm">
        Belum ada data sesi sebelumnya di leaderboard global.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[460px] text-sm">
        <thead>
          <tr className="bg-panel text-parchment/50 uppercase text-xs tracking-wider">
            <th className="px-2 sm:px-4 py-3 text-left">Rank</th>
            <th className="px-2 sm:px-4 py-3 text-left">Nama</th>
            <th className="px-2 sm:px-4 py-3 text-left">Avatar</th>
            <th className="px-2 sm:px-4 py-3 text-left">Skor</th>
            <th className="px-2 sm:px-4 py-3 text-left">Waktu</th>
            <th className="px-2 sm:px-4 py-3 text-left">Sesi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.player_name}-${r.character}`}
              className={`border-t border-line ${i === 0 ? "bg-gold/10" : "bg-panel/40"}`}
            >
              <td className="px-2 sm:px-4 py-3 font-display font-bold text-gold">#{i + 1}</td>
              <td className="px-2 sm:px-4 py-3 whitespace-nowrap">{r.player_name}</td>
              <td className="px-2 sm:px-4 py-3 text-parchment/60">{CHAR_LABELS[r.character] || r.character}</td>
              <td className="px-2 sm:px-4 py-3 font-display font-bold">{r.best_score}</td>
              <td className="px-2 sm:px-4 py-3">{formatTime(r.best_time_ms)}</td>
              <td className="px-2 sm:px-4 py-3 text-parchment/60">{r.sessions_played}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}