import { useState } from "react";

// One question at a time within the current level's encounter. Progress
// (soal X/N, salah Y/allowed) is shown in the header so players can see
// how close they are to the end-of-level pass/fail threshold.
export default function ChallengeModal({ challenge, onAnswer, resultState, onContinue }) {
  const [selected, setSelected] = useState(null);

  if (!challenge) return null;

  function submit() {
    if (selected === null) return;
    onAnswer(selected);
    setSelected(null);
  }

  return (
    <div className="fixed inset-0 bg-void/80 flex items-center justify-center z-50 p-4">
      <div className="bg-panel border-2 border-line rounded-lg max-w-lg w-full p-6 scanline-panel pixel-card">
        <div className="flex items-center justify-between mb-1">
          <p className="font-display text-primary text-sm tracking-[0.2em] uppercase">
            {challenge.levelName} · 1 vs {challenge.opponents}
          </p>
          <p className="text-parchment/50 text-xs font-display">
            Soal {challenge.questionNumber}/{challenge.totalQuestions}
          </p>
        </div>
        <p className="text-parchment/60 text-xs mb-4">NPC: {challenge.npc}</p>

        <p className="text-lg mb-5 leading-relaxed">{challenge.prompt}</p>

        {!resultState && (
          <div className="space-y-2 mb-5">
            {challenge.options.map((opt) => (
              <button
                key={opt.idx}
                onClick={() => setSelected(opt.idx)}
                className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
                  selected === opt.idx
                    ? "border-shield bg-shield/10"
                    : "border-line hover:border-shield/50"
                }`}
              >
                {opt.text}
              </button>
            ))}
          </div>
        )}

        {resultState && (
          <div
            className={`rounded-md p-4 mb-5 border ${
              resultState.correct ? "border-success bg-success/10" : "border-danger bg-danger/10"
            }`}
          >
            <p className="font-display font-bold mb-1">
              {resultState.correct
                ? "Benar — berhasil menangkis ajakan!"
                : "Kurang tepat — jawaban salahmu di level ini bertambah."}
            </p>
            <p className="text-sm text-parchment/80">{resultState.feedback}</p>
          </div>
        )}

        {!resultState ? (
          <button
            disabled={selected === null}
            onClick={submit}
            className="w-full bg-gold disabled:bg-line disabled:text-parchment/40 text-void font-display text-lg font-bold py-3 rounded-md pixel-btn"
          >
            Kirim Jawaban
          </button>
        ) : (
          <button
            onClick={onContinue}
            className="w-full bg-primary text-void font-display text-lg font-bold py-3 rounded-md pixel-btn"
          >
            Lanjutkan
          </button>
        )}
      </div>
    </div>
  );
}