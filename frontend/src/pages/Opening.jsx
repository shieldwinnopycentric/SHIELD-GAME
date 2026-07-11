import { useState } from "react";

function LogoBadge({ asset, label }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="w-16 h-16 rounded-full bg-panel/80 border border-line flex items-center justify-center text-xs text-parchment/50 text-center px-1">
        {label}
      </div>
    );
  }
  return (
    <img
      src={asset}
      alt={label}
      onError={() => setBroken(true)}
      className="w-16 h-16 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
    />
  );
}

function BackgroundImage() {
  const [broken, setBroken] = useState(false);
  if (broken) return null; // falls back to the plain dark gradient body background
  return (
    <img
      src="/assets/opening-background.jpg"
      alt=""
      onError={() => setBroken(true)}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

export default function Opening({ onNext }) {
  return (
    // fixed + inset-0 so this escapes App.jsx's centered/padded wrapper and
    // becomes a true full-bleed splash screen.
    <div className="fixed inset-0 overflow-hidden bg-void">
      <BackgroundImage />
      {/* Readability overlay over whatever background image is used */}
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/75 to-void/50" />

      <div className="relative h-full flex flex-col justify-between p-6 md:p-14">
        {/* Top row: logos left/right, "Proudly Present" between — not centered as a block */}
        <div className="flex items-center justify-between">
          <LogoBadge asset="/assets/logo-sma35.png" label="SMA 35" />
          <p className="font-pixel text-[10px] md:text-xs text-parchment/70 tracking-widest">
            PROUDLY PRESENT
          </p>
          <LogoBadge asset="/assets/logo-opsi.png" label="OPSI" />
        </div>

        {/* Title: large, centered together with the tag/button/tagline below it */}
        <div className="flex flex-col items-center text-center gap-5 mx-auto">
          <h1 className="font-pixel zoom-in-title text-5xl sm:text-6xl md:text-8xl leading-[1.15] text-shield drop-shadow-[0_3px_0_rgba(0,0,0,0.7)]">
            GAME
            <br />
            SHIELD
          </h1>

          <span className="inline-block bg-marioRed text-parchment font-display font-bold px-5 py-2 rounded-full text-base md:text-lg">
            Educative Game
          </span>

          <button
            onClick={onNext}
            className="bg-gold text-void font-display text-2xl font-bold px-12 py-4 rounded-md pixel-btn"
          >
            Mulai
          </button>

          <p className="text-parchment/40 text-xs max-w-md">
            SHIELD - Social-Inoculation &amp; Hazard Identification for Early Learning Deterrence
          </p>
        </div>

        {/* Spacer to balance the flex layout now that the bottom block above
            is centered rather than pinned to the bottom edge */}
        <div />
      </div>
    </div>
  );
}