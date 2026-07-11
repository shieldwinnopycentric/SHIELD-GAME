# SHIELD — Battlefield Game Edukasi Preventif Inhalan

Prototipe **web-based multiplayer educational RPG** sesuai proposal OPSI
"SHIELD: Social-Inoculation & Hazard Identification for Early Learning
Deterrence" + revisi `KONSEP_GAME_SHIELD.pdf`. Battle di dalam game adalah
representasi visual dari pemain "menangkis" ajakan/misinformasi tentang
penyalahgunaan inhalan (pendekatan Teori Inokulasi) — bukan konten kekerasan.

## Struktur Proyek

```
shield-game/
├── backend/          Node.js + Express + Socket.IO (lobby, room, game-state, leaderboard, admin API)
│   ├── server.js
│   ├── lib/supabaseClient.js  # shared Supabase client
│   ├── game/
│   │   ├── roomManager.js     # room/lobby/level-progress/score logic (maks. 10 pemain)
│   │   └── challenges.js      # bank soal 3/6/10 per level + admin CRUD helpers
│   └── supabase/schema.sql    # game_results, challenges, room_snapshots
└── frontend/          React + Vite + Tailwind + Phaser 3
    ├── src/pages/      Opening, Login, CharacterSelect, Lobby, GameScreen, ResultsScreen, AdminPage
    ├── src/game/       PhaserGame.jsx + MainScene.js (map, movement, NPC zones, enemy count, smoke fx)
    └── src/components/ HUD, ChallengeModal, LevelTransition, Leaderboard
```

## Alur Gameplay

1. **Opening (splash screen)** → logo SMA 35 & OPSI, "Proudly Present",
   judul "GAME SHIELD" (font pixel, animasi zoom-in), tag "Educative Game".
   Logo hanya tampil di sini, tidak muncul lagi di dalam map.
2. **Login** → isi nama pemain.
3. **Pilih Avatar** → **Nexus** (The Visionary Leader) / **Cypher** (The Tech
   Prodigy) / **Helix** (The Unstoppable Bastion) — non-gender-based, sesuai
   revisi konsep.
4. **Lobby** → buat room (dapat kode 5 karakter) atau join dengan kode.
   Setiap pemain menekan **Siap**; game mulai otomatis saat semua siap
   (maks. **10 pemain/room**, sesuai jumlah subjek penelitian).
5. **Game (maks. 15 menit)**:
   - Semua pemain muncul di map yang sama secara real-time, map dibuat
     variatif (variasi tile, jalur, dekorasi) + efek asap ambient (tema inhalan)
     + tiap zona level punya warna khas dari palet Mario (biru/kuning/merah).
   - 3 titik NPC = **Level 1 (1 vs 1), Level 2 (1 vs 3), Level 3 (1 vs 5)** —
     jumlah musuh ditampilkan langsung di map sebagai ikon berkelompok di
     tiap marker.
   - Mendekati NPC memicu rangkaian **soal** untuk level itu. Evaluasi
     lolos/gagal dilakukan di **akhir level** (bukan per-soal), sesuai
     `KONSEP_GAME_SHIELD.pdf`:

     | Level | Jumlah Soal | Boleh Salah Maks. | Kalau Lolos | Kalau Gagal |
     |---|---|---|---|---|
     | 1 | 3 | 1 | Lanjut Level 2 | Dikirim ke **Ruang Bimbingan**, ulang Level 1 |
     | 2 | 6 | 2 | Lanjut Level 3 | Dikirim ke **Rumah Sakit**, ulang Level 2 |
     | 3 | 10 | 2 | **Menang** → Leaderboard | Dikirim ke **Rumah Sakit**, ulang Level 3 |

   - Tiap soal tetap pakai gaya Teori Inokulasi: skenario ajakan/misinformasi
     lemah → pemain pilih respon menyanggah terbaik → feedback singkat (refutation).
   - Setiap pemain menyelesaikan challenge secara **mandiri**, tidak perlu
     menunggu pemain lain. Pemain yang disconnect otomatis dianggap selesai.
6. **Hasil & Leaderboard**: ranking berdasarkan skor lalu waktu penyelesaian,
   ditampilkan setelah semua pemain selesai atau waktu 15 menit habis.
   Hasil disimpan ke Supabase (`game_results`, view `global_leaderboard`).

> Progres per pemain (level, soal ke-berapa, jumlah salah, skor) juga
> di-mirror ke tabel `room_snapshots` di Supabase setiap ada event penting
> (join, ready, jawab soal, disconnect, game over) — lihat bagian Database.

## Halaman Admin (Kelola Soal/Challenge Edukasi)

Buka **`/admin`** (misalnya `http://localhost:5173/admin` waktu dev, atau
`https://domain-kamu.vercel.app/admin` setelah deploy) untuk kelola konten
edukasi tanpa perlu ubah kode:

1. Set `ADMIN_TOKEN` di `backend/.env` (password sederhana, ganti dari default).
2. Buka `/admin`, login dengan token itu.
3. Kalau tabel `challenges` di Supabase masih kosong, klik **"Isi Soal Default"**
   untuk mengcopy soal bawaan (3/6/10 sesuai level) sebagai starting point.
4. Tambah / edit / hapus soal per level (1/2/3): NPC/sumber ajakan, prompt skenario,
   4 opsi jawaban (pilih 1 sebagai benar), feedback/refutation, dan urutan tampil.
5. Perubahan langsung dipakai oleh game (server reload cache otomatis) —
   tidak perlu restart backend.

**Catatan:**
- Kalau `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` belum di-set, halaman `/admin`
  tetap bisa dibuka tapi hanya **read-only** menampilkan soal bawaan.
- Autentikasi token tunggal (cocok untuk prototipe penelitian, bukan sistem
  login multi-user). Jangan bagikan `ADMIN_TOKEN` secara publik.
- Jawaban benar (`correct: true/false`) hanya pernah dibaca lewat *service role
  key* di backend — tidak pernah dikirim ke browser pemain saat main game.
- Batas "boleh salah maks." per level (1/2/2) ditentukan di
  `LEVEL_META` (`backend/game/challenges.js`), terpisah dari jumlah soal —
  kalau admin menambah/mengurangi jumlah soal suatu level, ambang toleransi
  itu tetap tidak berubah otomatis (ubah manual di kode kalau perlu).

## Menjalankan Secara Lokal

### Backend
```bash
cd backend
cp .env.example .env     # isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_TOKEN
npm install
npm run dev              # jalan di http://localhost:4000
```

### Frontend
```bash
cd frontend
cp .env.example .env      # arahkan VITE_SERVER_URL ke backend
npm install
npm run dev               # jalan di http://localhost:5173
```

Buka beberapa tab browser untuk simulasi multiplayer (maks. 10 pemain/room).

## Database (Supabase)

Jalankan `backend/supabase/schema.sql` di SQL editor Supabase project kamu.
Ini membuat:
- `game_results` (hasil akhir per-sesi) + view `global_leaderboard`.
- `challenges` — soal/skenario edukasi yang dikelola lewat halaman **`/admin`**.
  Biarkan kosong untuk tetap memakai soal bawaan di `backend/game/challenges.js`,
  atau isi lewat tombol "Isi Soal Default" di admin.
- `room_snapshots` — mirror state room yang sedang berjalan (bukan sumber
  kebenaran utama; state asli tetap di memori server, ini murni untuk
  backup/observability kalau server restart atau kamu mau inspect sesi
  yang sedang jalan).

Backend menulis semuanya via **service role key** (aman, server-side saja);
frontend hanya membaca `global_leaderboard` lewat anon key jika
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` diisi. Tabel `challenges` dan
`room_snapshots` tidak pernah diakses langsung dari browser.

## Deployment

**Vercel tidak bisa menjalankan backend ini** — Socket.IO butuh koneksi
persisten, sementara Vercel hanya menyediakan serverless functions (timeout
pendek, tidak ada proses yang hidup terus). Jadi:

- **Frontend → Vercel**: import folder `frontend/`, set env vars
  `VITE_SERVER_URL` (URL backend di bawah), `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`. File `vercel.json` sudah disertakan supaya route
  `/admin` ikut resolve ke SPA (bukan 404) di production.
- **Backend → [Render](https://render.com)** (gratis, tanpa kartu kredit,
  mendukung WebSocket): buat "Web Service" baru, import folder `backend/`,
  set env vars dari `.env.example`, pastikan `CLIENT_ORIGIN` diisi domain
  Vercel kamu (untuk CORS & Socket.IO). Catatan: tier gratis Render "tidur"
  setelah ~15 menit tanpa trafik dan butuh ~30-50 detik untuk bangun lagi
  saat ada koneksi pertama — cukup untuk demo penelitian, tapi kalau mau
  selalu standby, upgrade ke tier berbayar.

## Avatar

Sesuai revisi konsep, avatar **tidak berbasis gender**, tapi berbasis peran:
- **Nexus** — The Visionary Leader
- **Cypher** — The Tech Prodigy
- **Helix** — The Unstoppable Bastion

Ketiganya dipakai baik untuk diri sendiri maupun tampilan teman satu room
(lihat bagian asset di bawah untuk nama file yang perlu disiapkan).

## Mengganti Placeholder Asset dengan Asset Legal (Kenney)

`MainScene.js` sudah di-setup untuk langsung memuat file asli — kamu **tidak perlu
mengubah kode lagi**, cukup unduh & letakkan file dengan nama yang sudah ditentukan.

Rekomendasi pack (semua CC0, gratis, tanpa atribusi wajib):
- **[RPG Urban Kit](https://kenney.nl/assets/rpg-urban-kit)** — tileset urban/kota
  (cocok untuk setting sekolah).
- **[Toon Characters 1](https://kenney.nl/assets/toon-characters-1)** — untuk 3
  sprite avatar (Nexus/Cypher/Helix), pilih 3 karakter berbeda yang paling
  cocok dengan archetype masing-masing.

Langkah — rename & letakkan di `frontend/public/assets/` dengan nama **persis**:

**Wajib** (fallback placeholder otomatis kalau belum ada):

| File | Isi |
|---|---|
| `assets/tile-ground.png` | 1 tile ground/jalan dari RPG Urban Kit |
| `assets/character-nexus.png` | avatar Nexus |
| `assets/character-cypher.png` | avatar Cypher |
| `assets/character-helix.png` | avatar Helix |
| `assets/npc-marker.png` | ikon marker NPC/encounter generik |

**Opsional** (map lebih variatif):

| File | Isi |
|---|---|
| `assets/tile-ground-2.png`, `assets/tile-ground-3.png` | varian tile ground lain |
| `assets/tile-path.png` | tile jalan/path menuju NPC |
| `assets/decor-1.png`, `decor-2.png`, `decor-3.png` | dekorasi (pohon/peti/semak) |

**Opsional** (marker beda tiap level & ikon musuh):

| File | Isi |
|---|---|
| `assets/npc-marker-1.png` / `-2.png` / `-3.png` | marker khusus per level |
| `assets/enemy-icon.png` | ikon musuh kecil, ditampilkan berkelompok (1/3/5) di tiap marker |

**Opsional** (splash screen):

| File | Isi |
|---|---|
| `assets/logo-sma35.png` | logo SMA 35, tampil di Opening screen saja |
| `assets/logo-opsi.png` | logo OPSI, tampil di Opening screen saja |

Refresh browser setelah menaruh file — tidak perlu sentuh kode. Kalau file
belum ada/gagal dimuat, tampilan otomatis fallback ke bentuk placeholder,
jadi game tidak pernah crash walau asset belum lengkap.

Ingin pakai CraftPix / OpenGameArt / itch.io sebagai gantinya? Cukup pastikan
hasil akhirnya diletakkan dengan nama file yang sama di atas. Selalu cek
lisensi masing-masing pack sebelum dipakai di laporan/publikasi penelitian.

## Color Palette

Base UI tetap memakai palet gelap "field ops" (`void`/`panel`/`shield`/`alert`),
ditambah token warna dari `KONSEP_GAME_SHIELD.pdf` (skema logo Super Mario) yang
di-mix-and-match sebagai aksen (opening screen, zona level di map, HUD skor):

| Token Tailwind | Hex | Dipakai di |
|---|---|---|
| `marioBlack` | `#000000` | — |
| `marioBlue` | `#049CD8` | Zona Level 1, avatar Nexus (placeholder) |
| `marioYellow` | `#FBD000` | Tombol "Mulai" di Opening, skor di HUD |
| `marioRed` | `#E52521` | Zona Level 3, tag "Educative Game", avatar Helix (placeholder) |
| `marioGreen` | `#43B047` | Avatar Cypher (placeholder) |

## Catatan Konten Edukasi

Bank soal (`backend/game/challenges.js`) disusun mengikuti pendekatan
Teori Inokulasi: setiap soal menyajikan bentuk ajakan/klaim yang lemah
(mis. "katanya legal jadi aman", "figur publik juga pakai", tekanan
kelompok, misinformasi viral), lalu meminta pemain memilih respon
menyanggah yang paling tepat, diikuti feedback edukatif singkat. Materi
tidak memuat cara memperoleh atau menggunakan zat — fokusnya murni pada
pengenalan risiko dan latihan keterampilan menolak (refusal skills).
