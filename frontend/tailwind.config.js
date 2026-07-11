/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Base neutrals. The "black" role is carried by void (near-black) —
        // panels/borders/text sit on top of it. Tinted cool/blue-black (bukan
        // olive lagi) supaya menyatu dengan latar Mario-blue di index.css.
        void: "#0B1016",       // near-black, faint blue cast
        panel: "#141C24",      // card/panel background (dark slate-blue)
        line: "#263340",       // hairline borders
        parchment: "#EDE6D6",  // warm off-white text on dark panels

        // Mario-logo palette (KONSEP_GAME_SHIELD.pdf) — the single source of
        // truth for every accent in the UI.
        marioBlack: "#000000",
        marioBlue: "#049CD8",
        marioYellow: "#FBD000",
        marioRed: "#E52521",
        marioGreen: "#43B047",

        // Semantic roles mapped onto the Mario palette:
        primary: "#049CD8",  // blue   — tombol utama, interactive/link, Level 1
        success: "#43B047",  // green  — benar/sukses, status "Siap", Level 2
        danger: "#E52521",   // red    — salah/nyawa, tombol destruktif, Level 3
        gold: "#FBD000",     // yellow — skor, CTA paling penting, rank #1

        // Back-compat aliases, repointed off the retired teal/amber onto the
        // palette so any untouched class still lands on a palette colour.
        shield: "#049CD8",   // was teal  → now primary blue
        alert: "#FBD000",    // was amber → now gold/highlight
      },
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        pixel: ["'Press Start 2P'", "monospace"],
      },
    },
  },
  plugins: [],
};
