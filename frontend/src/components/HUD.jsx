function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Mekanik ambang salah per-level (tidak ada nyawa global): tiap level punya
// jumlah soal (3/6/10) dan jatah salah (maks 1/2/2). HUD menampilkan progres
// soal + berapa salah yang sudah dipakai dari jatahnya.
// Rendered as a translucent overlay INSIDE the game frame (see GameScreen),
// so it never eats vertical space or overflows off-screen on mobile. Compact
// on phones, roomier on larger screens.
// Level number takes on its zone colour (Level 1 biru, 2 kuning, 3 merah) so
// the HUD echoes the map markers and the palette's level roles.
const LEVEL_TEXT = { 1: "text-primary", 2: "text-gold", 3: "text-danger" };

export default function HUD({ level, questionNumber, totalQuestions, wrongInLevel, maxWrong, score, timeLeftMs }) {
  const wrong = wrongInLevel ?? 0;
  const limit = maxWrong ?? 0;
  const overBudget = wrong > limit; // sudah pasti gagal kalau level ini diselesaikan sekarang
  return (
    <div className="flex items-center justify-between gap-x-2 gap-y-1 bg-void/70 backdrop-blur-sm border border-line/60 rounded-md px-2.5 py-1.5 font-display flex-wrap text-parchment">
      <div className="flex items-baseline gap-1">
        <span className="text-parchment/50 text-[10px] uppercase tracking-wider">Lvl</span>
        <span className={`${LEVEL_TEXT[level] || "text-primary"} text-sm sm:text-base font-bold`}>{level}/3</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-parchment/50 text-[10px] uppercase tracking-wider">Soal</span>
        <span className="text-sm sm:text-base font-bold">
          {questionNumber ?? "-"}/{totalQuestions ?? "-"}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-parchment/50 text-[10px] uppercase tracking-wider">Salah</span>
        <span className={`text-sm sm:text-base font-bold ${overBudget ? "text-danger" : "text-parchment"}`}>
          {wrong}
          <span className="text-parchment/40 font-normal">/{limit}</span>
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-parchment/50 text-[10px] uppercase tracking-wider">Skor</span>
        <span className="text-marioYellow text-sm sm:text-base font-bold">{score}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-parchment/50 text-[10px] uppercase tracking-wider">Waktu</span>
        <span className="text-sm sm:text-base font-bold">{formatTime(timeLeftMs)}</span>
      </div>
    </div>
  );
}