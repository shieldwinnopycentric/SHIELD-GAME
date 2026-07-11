import { useState } from "react";
import BackButton from "../components/BackButton.jsx";
import PageBackground from "../components/PageBackground.jsx";

export default function Login({ player, setPlayer, onNext, onBack }) {
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!player.name.trim()) {
      setError("Nama pemain wajib diisi.");
      return;
    }
    setError("");
    onNext();
  }
  

  return (
    <div className="w-full max-w-md">
      <PageBackground src="/assets/bg-login.jpg" />
      {onBack && <BackButton onClick={onBack} label="Beranda" />}

      <div className="text-center mb-8">
        <p className="font-pixel text-primary text-[10px] tracking-[0.2em] uppercase mb-3">
          Langkah 1 / 4
        </p>
        <h1 className="font-pixel text-4xl sm:text-5xl text-parchment drop-shadow-[0_3px_0_rgba(0,0,0,0.7)]">
          SHIELD
        </h1>
        <p className="text-parchment/60 text-sm mt-3">
          Battlefield game edukasi - kenali & tangkis ajakan berbahaya.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-panel border-2 border-line rounded-lg p-6 scanline-panel pixel-card"
      >
        <label className="block text-sm text-parchment/70 mb-2">Nama Pemain</label>
        <input
          autoFocus
          value={player.name}
          onChange={(e) => setPlayer({ ...player, name: e.target.value })}
          placeholder="Masukkan nama panggilanmu"
          maxLength={20}
          className="w-full bg-void border border-line rounded-md px-4 py-3 text-parchment placeholder:text-parchment/30 focus:outline-none focus:border-shield transition-colors"
        />
        {error && <p className="text-danger text-sm mt-2">{error}</p>}

        <button
          type="submit"
          className="mt-6 w-full bg-primary text-void font-display text-lg font-bold py-3 rounded-md pixel-btn"
        >
          Masuk
        </button>
      </form>

      <p className="text-center text-parchment/30 text-xs mt-6">
        Maks. 10 pemain per room · Durasi sesi: 15 menit
      </p>
    </div>
  );
}
