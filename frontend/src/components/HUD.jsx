function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const LEVEL_TEXT = { 1: "text-primary", 2: "text-gold", 3: "text-danger" };

export default function HUD({ level, questionNumber, totalQuestions, lives, maxLives, score, timeLeftMs }) {
  const total = maxLives ?? 0;
  const left = Math.max(0, lives ?? 0);
  const hearts = Array.from({ length: total }, (_, i) => i < left);
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
      <div className="flex items-center gap-1">
        <span className="text-parchment/50 text-[10px] uppercase tracking-wider">Nyawa</span>
        <span className="text-sm sm:text-base leading-none tracking-tight" aria-label={`${left} dari ${total} nyawa`}>
          {hearts.map((full, i) => (
            <span key={i} className={full ? "text-danger" : "text-parchment/25"}>
              {full ? "♥" : "♡"}
            </span>
          ))}
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
