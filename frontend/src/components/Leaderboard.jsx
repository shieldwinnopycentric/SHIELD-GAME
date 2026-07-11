function formatTime(ms) {
  if (ms == null) return "—";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Leaderboard({ rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="bg-panel text-parchment/50 uppercase text-xs tracking-wider">
            <th className="px-2 sm:px-4 py-3 text-left">Rank</th>
            <th className="px-2 sm:px-4 py-3 text-left">Nama</th>
            <th className="px-2 sm:px-4 py-3 text-left">Waktu</th>
            <th className="px-2 sm:px-4 py-3 text-left">Benar</th>
            <th className="px-2 sm:px-4 py-3 text-left">Level</th>
            <th className="px-2 sm:px-4 py-3 text-left">Skor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.rank}
              className={`border-t border-line ${r.rank === 1 ? "bg-gold/10" : "bg-panel/40"}`}
            >
              <td className="px-2 sm:px-4 py-3 font-display font-bold text-gold">#{r.rank}</td>
              <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                {r.name}{" "}
                {r.won && <span className="text-gold text-xs">🏆 menang</span>}
                {r.disconnected && <span className="text-parchment/30 text-xs">(keluar)</span>}
              </td>
              <td className="px-2 sm:px-4 py-3">{formatTime(r.finishTimeMs)}</td>
              <td className="px-2 sm:px-4 py-3">{r.correctCount}</td>
              <td className="px-2 sm:px-4 py-3 font-display">{r.level ?? "-"}/3</td>
              <td className="px-2 sm:px-4 py-3 font-display font-bold">{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}