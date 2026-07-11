import Leaderboard from "../components/Leaderboard.jsx";
import GlobalLeaderboard from "../components/GlobalLeaderboard.jsx";
import BackButton from "../components/BackButton.jsx";
import PageBackground from "../components/PageBackground.jsx";

export default function ResultsScreen({ leaderboard, onPlayAgain }) {
  return (
    <div className="w-full max-w-2xl">
      <PageBackground src="/assets/bg-results.jpg" />
      <BackButton onClick={onPlayAgain} label="Beranda" />

      <p className="font-pixel text-primary text-[10px] tracking-[0.2em] uppercase mb-3 text-center">
        Sesi Selesai
      </p>
      <h2 className="font-display text-4xl font-bold mb-6 text-center">Hasil & Leaderboard</h2>

      <Leaderboard rows={leaderboard} />

      <p className="font-pixel text-gold text-[10px] tracking-[0.15em] uppercase mt-8 mb-3">
        Leaderboard Global (Semua Sesi)
      </p>
      <GlobalLeaderboard />

      <button
        type="button"
        onClick={onPlayAgain}
        className="mt-6 w-full bg-gold text-void font-display text-lg font-bold py-3 rounded-md pixel-btn"
      >
        Main Lagi
      </button>
    </div>
  );
}