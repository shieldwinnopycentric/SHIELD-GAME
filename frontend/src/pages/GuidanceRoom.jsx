import { useEffect, useRef, useState } from "react";

// Ruang kegagalan sebagai HALAMAN penuh (bukan popup). Pemain otomatis masuk
// ke sini begitu salah melebihi jatah nyawa di sebuah level. Alur:
//   1. Avatar 2D + gelembung chat sambutan (dengan animasi masuk).
//   2. Materi literasi (harus dibaca sampai selesai).
//   3. Tombol "Kembali ke Game" yang AWALNYA TERKUNCI — baru aktif setelah
//      materi digulir sampai bawah DAN sudah cukup waktu membaca.
// Setelah kembali, pemain mengulang level (repeatLevel) dengan nyawa penuh.

// Sprite karakter yang sudah ada dipakai sebagai "avatar 2D" pembicara. Ganti
// path di sini kalau nanti ada aset khusus (konselor/dokter/petugas).
const CHARACTER_SPRITE = {
  konselor: "/assets/konselor.png",
  cypher: "/assets/character-cypher.png",
  sipir: "/assets/sipir.png",
};

// Resolusi URL backend mengikuti pola lib/socket.js: hormati VITE_SERVER_URL
// kalau menunjuk host remote, selain itu ikut host halaman (supaya tetap
// jalan saat dibuka dari HP lewat LAN).
const envUrl = import.meta.env.VITE_SERVER_URL;
const isLocalEnv = !envUrl || /localhost|127\.0\.0\.1/.test(envUrl);
const SERVER_URL = isLocalEnv
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : envUrl;

// Tema visual per ruang (warna/gambar) — tetap di frontend karena bukan
// konten edukasi. KONTEN (pembicara, sapaan, judul, bagian materi) datang
// dari backend (/api/room-materials, dikelola lewat /admin); DEFAULT_CONTENT
// di bawah adalah fallback bila fetch gagal/belum selesai.
const ROOM_THEME = {
  "Ruang Bimbingan": {
    accentBorder: "border-primary",
    accentText: "text-primary",
    glow: "rgba(4,156,216,0.16)",
    bg: "/assets/bg-bimbingan.jpg",
    
  },
  "Rumah Sakit": {
    accentBorder: "border-danger",
    accentText: "text-danger",
    glow: "rgba(229,37,33,0.16)",
    bg: "/assets/bg-rumah-sakit.jpg",
  },
  Penjara: {
    accentBorder: "border-gold",
    accentText: "text-gold",
    glow: "rgba(251,208,0,0.14)",
    bg: "/assets/bg-penjara.jpg",
  },
};

const DEFAULT_CONTENT = {
  "Ruang Bimbingan": {
    speaker: "Konselor",
    greeting:
      "Selamat datang di Ruang Bimbingan. Mohon untuk melakukan literasi sebanyak-banyaknya terkait aksi penyalahgunaan inhalan.",
    title: "Literasi Dasar: Kenali Inhalan",
    sections: [
      {
        heading: "Apa itu inhalan?",
        body:
          "Inhalan adalah zat yang uapnya sengaja dihirup untuk memberi efek 'melayang' sesaat — misalnya gas N2O (dinitrogen oksida) pada tabung krim, lem, cat semprot, atau pengharsum. Banyak produknya legal dijual untuk fungsi tertentu (kuliner, industri), TAPI legal untuk satu fungsi tidak berarti aman untuk dihirup.",
      },
      {
        heading: "Kenapa ajakan terdengar meyakinkan?",
        body:
          "Ajakan biasanya memakai pola: 'ini legal kok', 'figur publik juga pakai', atau 'cuma sekali, biar having fun'. Popularitas dan legalitas produk BUKAN bukti keamanan. Pisahkan selalu antara 'sedang tren' dan 'aman bagi kesehatan'.",
      },
      {
        heading: "Cara menolak dengan tegas",
        body:
          "Siapkan alasan menolak sejak awal dan sampaikan dengan percaya diri: 'Aku tetap tidak mau, ini soal kesehatanku.' Menolak dengan alasan jelas jauh lebih kuat daripada menghindar tanpa berkata apa-apa. Cari juga teman yang sepaham sebagai pendukung.",
      },
      {
        heading: "Ingat",
        body:
          "Menyalahgunakan inhalan berisiko bagi otak, jantung, dan paru-paru bahkan sejak pemakaian pertama. Keputusan sehat diambil untuk melindungi dirimu sendiri — bukan untuk ikut-ikutan.",
      },
    ],
  },
  "Rumah Sakit": {
    speaker: "Dokter",
    greeting:
      "Kamu dirawat di Rumah Sakit karena menyerah pada tekanan. Sebelum kembali, pahami dulu apa yang sebenarnya terjadi pada tubuhmu.",
    title: "Dampak Kesehatan Penyalahgunaan Inhalan",
    sections: [
      {
        heading: "Otak & sistem saraf",
        body:
          "Inhalan menekan kerja sistem saraf pusat. Efek jangka pendek: pusing, kehilangan kesadaran, kejang. Jangka panjang: kerusakan sel otak permanen yang memengaruhi daya ingat, konsentrasi, dan kemampuan belajar.",
      },
      {
        heading: "Jantung — bahaya paling mendadak",
        body:
          "Menghirup inhalan bisa memicu 'Sudden Sniffing Death' — jantung berdetak sangat cepat lalu berhenti tiba-tiba, bahkan pada pemakaian PERTAMA dan pada orang yang sehat. Tidak ada dosis yang benar-benar 'aman'.",
      },
      {
        heading: "Paru-paru & organ lain",
        body:
          "Uap kimia melukai saluran napas dan paru, mengurangi kadar oksigen dalam darah. Pemakaian berulang juga merusak hati dan ginjal, serta mengganggu kondisi mental dan emosional (cemas, depresi).",
      },
      {
        heading: "'Cuma sekali' itu jebakan",
        body:
          "Euforia inhalan bersifat sangat singkat dan mendorong pemakaian berulang — inilah awal ketergantungan. Risiko tidak berkurang hanya karena dianggap 'sekali saja'.",
      },
    ],
  },
  Penjara: {
    speaker: "Petugas",
    greeting:
      "Kamu berakhir di Penjara karena termakan misinformasi yang menyeretmu pada penyalahgunaan. Renungkan konsekuensinya sebelum mencoba lagi.",
    title: "Konsekuensi Hukum & Literasi Digital",
    sections: [
      {
        heading: "Bukan sekadar urusan kesehatan",
        body:
          "Penyalahgunaan dan pengedaran zat dapat berujung pada masalah hukum, catatan kriminal, serta rusaknya masa depan pendidikan dan pekerjaan. Satu keputusan impulsif bisa berdampak bertahun-tahun.",
      },
      {
        heading: "Kenali taktik misinformasi",
        body:
          "Konten viral sering memakai: klaim 'dipakai di rumah sakit jadi aman' (padahal dosis medis diawasi ketat), label 'natural/organik', 'ada penelitiannya' tanpa sumber, atau tekanan FOMO 'ketinggalan zaman'. Semua itu manipulasi, bukan bukti.",
      },
      {
        heading: "Verifikasi sebelum percaya",
        body:
          "Jumlah views, likes, dan komentar 'aman kok' BUKAN validasi ilmiah. Periksa ke sumber resmi seperti Kemenkes, BNN, atau BPOM sebelum mempercayai — apalagi sebelum ikut menyebarkan.",
      },
      {
        heading: "Tanggung jawab digital",
        body:
          "Menahan diri untuk tidak ikut menyebarkan misinformasi adalah bentuk perlindungan bagi teman-temanmu. Sikap kritis adalah 'perisai' terbaikmu di dunia maya.",
      },
    ],
  },
};

const MIN_READ_SECONDS = 6; // waktu baca minimal sebelum tombol bisa aktif

// Cache modul: materi dari server cukup diambil sekali per sesi tab, supaya
// pemain yang gagal berkali-kali tidak menunggu fetch ulang tiap masuk ruang.
let cachedMaterials = null;
let materialsPromise = null;
function fetchRoomMaterials() {
  if (cachedMaterials) return Promise.resolve(cachedMaterials);
  if (!materialsPromise) {
    materialsPromise = fetch(`${SERVER_URL}/api/room-materials`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        cachedMaterials = data.rooms || {};
        return cachedMaterials;
      })
      .catch(() => {
        // Gagal ambil dari server (offline/belum jalan) — pakai konten bawaan
        // saja, dan biarkan percobaan berikutnya mencoba fetch lagi.
        materialsPromise = null;
        return null;
      });
  }
  return materialsPromise;
}

export default function GuidanceRoom({ info, onBackToGame }) {
  const room = info?.failRoom || "Ruang Bimbingan";
  const theme = ROOM_THEME[room] || ROOM_THEME["Ruang Bimbingan"];
  const avatar = CHARACTER_SPRITE[info?.character] || CHARACTER_SPRITE.konselor;

  // Mulai dari konten bawaan, ganti dengan versi server (hasil kelola admin)
  // begitu tersedia. Kalau server tidak menjawab, bawaan tetap tampil.
  const [serverMaterials, setServerMaterials] = useState(cachedMaterials);
  useEffect(() => {
    let alive = true;
    fetchRoomMaterials().then((rooms) => {
      if (alive && rooms) setServerMaterials(rooms);
    });
    return () => {
      alive = false;
    };
  }, []);

  const content =
    (serverMaterials && serverMaterials[room]) ||
    DEFAULT_CONTENT[room] ||
    DEFAULT_CONTENT["Ruang Bimbingan"];

  const scrollRef = useRef(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(MIN_READ_SECONDS);

  // Hitung mundur waktu baca minimal.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  // Kalau materi ternyata tidak bisa digulir (muat penuh di layar besar),
  // anggap sudah "sampai bawah" supaya tombol tidak terkunci selamanya.
  // Dicek ulang saat konten berubah (materi dari server datang setelah mount).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setReachedEnd(true);
  }, [content]);

  function handleScroll(e) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReachedEnd(true);
  }

  const canLeave = reachedEnd && secondsLeft <= 0;
  const hint = !reachedEnd
    ? "Gulir & baca materi sampai bawah untuk membuka tombol."
    : secondsLeft > 0
    ? `Sebentar lagi… (${secondsLeft}s)`
    : "Materi selesai — kamu boleh kembali.";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center p-3 sm:p-4 overflow-hidden bg-center bg-cover"
      style={{
        // Gambar ruang sebagai background + lapisan gelap tipis (biar teks
        // terbaca) + glow aksen per ruang. Kalau file gambar belum ada, warna
        // dasar #0b1016 tetap tampil (fallback aman).
        backgroundColor: "#0b1016",
        backgroundImage: `radial-gradient(circle at 50% -10%, ${theme.glow}, transparent 60%), linear-gradient(rgba(11,16,22,0.55), rgba(11,16,22,0.82)), url(${theme.bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        className={`bg-panel/85 backdrop-blur-md border-2 ${theme.accentBorder} rounded-lg w-full max-w-2xl flex flex-col max-h-full pixel-card overflow-hidden`}
      >
        {/* Header: nama ruang */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <p className={`font-pixel ${theme.accentText} text-[11px] tracking-[0.12em] uppercase`}>
            {room}
          </p>
        </div>

        {/* Avatar 2D + gelembung chat (beranimasi) */}
        <div className="flex items-start gap-3 px-5 pb-4 shrink-0">
          <div className="room-avatar-in shrink-0">
            <img
              src={avatar}
              alt="Avatar pembimbing"
              className="room-avatar-float w-16 h-16 sm:w-20 sm:h-20 rounded-md border border-line bg-void/40 object-contain pixelated"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
          <div className="room-bubble-in relative flex-1 bg-void/60 border border-line rounded-lg px-4 py-3">
            <span className="absolute -left-2 top-4 w-3 h-3 rotate-45 bg-void/60 border-l border-b border-line" />
            <p className="text-[10px] uppercase tracking-wider text-parchment/50 mb-1">
              {content.speaker}
            </p>
            <p className="text-sm text-parchment/90 leading-relaxed">{content.greeting}</p>
          </div>
        </div>

        {/* Materi literasi — harus dibaca sampai bawah */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="room-fade-up flex-1 min-h-0 overflow-y-auto px-5 py-4 border-t border-line/60 scanline-panel"
        >
          <h3 className="font-display text-2xl font-bold mb-4">{content.title}</h3>
          <div className="space-y-4">
            {content.sections.map((s) => (
              <div key={s.heading}>
                <p className={`font-display font-bold text-base mb-1 ${theme.accentText}`}>
                  {s.heading}
                </p>
                <p className="text-sm text-parchment/80 leading-relaxed">{s.body}</p>
              </div>
            ))}
            <p className="text-center text-parchment/30 text-xs pt-2">— selesai —</p>
          </div>
        </div>

        {/* Footer: hint + tombol kembali (terkunci sampai materi kelar) */}
        <div className="px-5 py-4 border-t border-line/60 shrink-0">
          <p className={`text-center text-xs mb-2 ${canLeave ? "text-success" : "text-parchment/50"}`}>
            {hint}
          </p>
          <button
            type="button"
            disabled={!canLeave}
            onClick={onBackToGame}
            className="w-full bg-success disabled:bg-line disabled:text-parchment/40 disabled:cursor-not-allowed text-void font-display text-lg font-bold py-3 rounded-md pixel-btn flex items-center justify-center gap-2"
          >
            {canLeave ? (
              <>Kembali ke Game — Ulangi Level {info?.repeatLevel} ▶</>
            ) : (
              <>🔒 Baca materinya dulu</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
