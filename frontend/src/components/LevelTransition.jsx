// Interstitial di akhir sebuah level:
//  - "failed" : salah melebihi jatah -> masuk ruang bertema (Ruang Bimbingan /
//    Rumah Sakit) lalu mengulang level (repeatLevel).
//  - "passed" : lolos ke level berikutnya (won=true = menang di Level 3 ->
//    lanjut ke leaderboard).
export default function LevelTransition({ info, onContinue }) {
  if (!info) return null;

  if (info.type === "failed") {
    const room = info.failRoom || "Ruang Pemulihan";
    return (
      <div className="fixed inset-0 bg-void/90 flex items-center justify-center z-50 p-4">
        <div className="bg-panel border-2 border-danger rounded-lg max-w-md w-full p-7 text-center pixel-card">
          <p className="font-pixel text-danger text-[11px] leading-relaxed tracking-[0.12em] uppercase mb-3">
            {room}
          </p>
          <h3 className="font-display text-3xl font-bold mb-3">Belum Lolos Level {info.failedLevel}</h3>
          <p className="text-parchment/70 text-sm">
            Kamu salah <span className="text-danger font-semibold">{info.wrongCount}</span> soal
            (batas lolos maks {info.maxWrong}). Masuk dulu ke{" "}
            <span className="text-parchment font-semibold">{room}</span> untuk memperbaiki
            pemahaman, lalu ulangi Level {info.repeatLevel}.
          </p>
          <button
            onClick={onContinue}
            className="mt-6 w-full bg-danger text-void font-display text-lg font-bold py-3 rounded-md pixel-btn"
          >
            Ulangi Level {info.repeatLevel}
          </button>
        </div>
      </div>
    );
  }

  // info.type === "passed"
  return (
    <div className="fixed inset-0 bg-void/90 flex items-center justify-center z-50 p-4">
      <div className="bg-panel border-2 border-success rounded-lg max-w-md w-full p-7 text-center pixel-card">
        <p className="font-display text-success text-sm tracking-[0.2em] uppercase mb-2">
          Level {info.level} Selesai
        </p>
        <h3 className="font-display text-3xl font-bold mb-3">
          {info.won ? "Kamu Menang! 🎉" : "Lanjut ke Level Berikutnya"}
        </h3>
        <p className="text-parchment/70 text-sm">
          {info.won
            ? "Semua level berhasil diselesaikan. Kerja bagus!"
            : `Level ${info.level} lolos! Dekati NPC Level ${info.level + 1} di map untuk lanjut.`}
        </p>

        <button
          onClick={onContinue}
          className="mt-6 w-full bg-success text-void font-display text-lg font-bold py-3 rounded-md pixel-btn"
        >
          {info.won ? "Lihat Leaderboard" : "Lanjutkan"}
        </button>
      </div>
    </div>
  );
}