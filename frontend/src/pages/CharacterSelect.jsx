import { useState } from "react";
import BackButton from "../components/BackButton.jsx";
import PageBackground from "../components/PageBackground.jsx";

const CHARACTERS = [
  {
    id: "nexus",
    label: "Nexus",
    tagline: "The Visionary Leader",
    asset: "/assets/character-nexus.png",
    fallbackColor: "#049CD8",
  },
  {
    id: "cypher",
    label: "Cypher",
    tagline: "The Tech Prodigy",
    asset: "/assets/character-cypher.png",
    fallbackColor: "#43B047",
  },
  {
    id: "helix",
    label: "Helix",
    tagline: "The Unstoppable Bastion",
    asset: "/assets/character-helix.png",
    fallbackColor: "#E52521",
  },
];

function CharacterPreview({ asset, label, fallbackColor }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div
        className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-full mb-3 sm:mb-4 flex items-center justify-center font-display text-xl sm:text-2xl text-void"
        style={{ backgroundColor: fallbackColor }}
      >
        {label[0]}
      </div>
    );
  }

  return (
    <img
      src={asset}
      alt={label}
      onError={() => setBroken(true)}
      className="w-14 h-14 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 object-contain"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export default function CharacterSelect({ player, setPlayer, onBack, onNext }) {
  return (
    <div className="w-full max-w-2xl text-center">
      <PageBackground src="/assets/bg-character.jpg" />
      <BackButton onClick={onBack} label="Kembali" />

      <p className="font-pixel text-primary text-[10px] tracking-[0.2em] uppercase mb-4">
        Langkah 2 / 4
      </p>
      <h2 className="font-display text-4xl font-bold mb-8">Pilih Avatarmu</h2>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {CHARACTERS.map((c) => {
          const selected = player.character === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setPlayer({ ...player, character: c.id })}
              className={`border-2 rounded-lg p-2.5 sm:p-5 transition-all ${
                selected
                  ? "border-primary bg-panel scale-[1.02] pixel-card"
                  : "border-line bg-panel/50 hover:border-primary/50"
              }`}
            >
              <CharacterPreview
                asset={c.asset}
                label={c.label}
                fallbackColor={c.fallbackColor}
              />
              <p className="font-display text-base sm:text-xl">{c.label}</p>
              <p className="text-parchment/50 text-[10px] sm:text-xs mt-1 leading-tight">{c.tagline}</p>
            </button>
          );
        })}
      </div>

      <button
        onClick={onNext}
        className="w-full mt-8 bg-primary text-void font-display text-lg font-bold rounded-md py-3 pixel-btn"
      >
        Lanjut ke Lobby
      </button>
    </div>
  );
}
