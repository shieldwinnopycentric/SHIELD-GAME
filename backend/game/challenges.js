import { supabase } from "../lib/supabaseClient.js";

/**
 * SHIELD - Bank soal / skenario edukasi.
 *
 * SEED_CHALLENGES below is the built-in fallback content (used whenever
 * Supabase isn't configured, or the `challenges` table is empty). Once an
 * admin adds content via the /admin page (backed by Supabase), that
 * content takes over automatically — see loadChallengesFromDB().
 *
 * Each level follows the Teori Inokulasi approach:
 *  1. "Ajakan/Klaim Lemah" (weakened persuasive attempt / misinformation)
 *  2. Pemain memilih respon terbaik (menyanggah)
 *  3. Penjelasan singkat (refutation) ditampilkan sebagai feedback
 *
 * Mekanik (ambang salah per-level — tidak ada lagi nyawa global):
 *  - Level 1 = 3 soal, boleh salah maks 1 -> lolos ke Level 2. Salah > 1 ->
 *    masuk "Ruang Bimbingan" lalu MENGULANG Level 1.
 *  - Level 2 = 6 soal, boleh salah maks 2 -> lolos ke Level 3. Salah > 2 ->
 *    masuk "Rumah Sakit" lalu MENGULANG Level 2.
 *  - Level 3 = 10 soal, boleh salah maks 2 -> MENANG (langsung ke
 *    leaderboard). Salah > 2 -> kembali MENGULANG Level 2.
 *  - Lolos/gagal dievaluasi di AKHIR level (semua soal dijawab dulu), lihat
 *    LEVEL_META (jumlah soal + maks salah + failRoom + failGoTo) dan
 *    backend/game/roomManager.js (applyAnswer) untuk detailnya.
 *  - Jumlah soal target ada di LEVEL_META.questions. Kalau bank soal untuk
 *    sebuah level lebih sedikit dari target, getChallenge() otomatis
 *    memutar ulang (cycle) soal yang ada agar mekanik tetap jalan.
 */

const SEED_CHALLENGES = {
  1: [
    {
      id: "l1-q1",
      npc: "Rian",
      prompt:
        "Rian menawarkan tabung Whip Pink dan bilang, \"Ini aman kok, cuma buat bikin busa krim, legal juga.\"",
      options: [
        { text: "Ikut coba karena katanya legal", correct: false },
        {
          text: "Menolak — produk itu legal untuk kuliner, bukan untuk dihirup langsung",
          correct: true,
        },
        { text: "Diam saja tapi tetap penasaran", correct: false },
        { text: "Minta Rian membuktikan dulu ke orang lain", correct: false },
      ],
      feedback:
        "Legal untuk satu fungsi (pengemulsi makanan) tidak berarti aman untuk fungsi lain (dihirup). Menyalahgunakan N2O di luar fungsinya tetap berisiko tinggi bagi kesehatan.",
    },
    {
      id: "l1-q2",
      npc: "Dinda",
      prompt:
        "\"Aku lihat di media sosial, figur publik juga pakai ini buat having fun, gak masalah kan?\"",
      options: [
        {
          text: "Popularitas seseorang tidak membuat suatu tindakan otomatis aman atau benar",
          correct: true,
        },
        { text: "Kalau figur publik saja berani, berarti aman", correct: false },
        { text: "Ikut supaya tidak dianggap kudet", correct: false },
        { text: "Pura-pura setuju agar tidak didebat", correct: false },
      ],
      feedback:
        "Rekomendasi figur publik bisa sangat memengaruhi keputusan remaja, tapi itu bukan bukti keamanan suatu zat. Selalu pisahkan popularitas dari fakta kesehatan.",
    },
    {
      id: "l1-q3",
      npc: "Bagas",
      prompt: "Manakah dampak yang paling tepat menggambarkan bahaya inhalan bagi tubuh?",
      options: [
        { text: "Hanya membuat pusing sebentar, tidak ada efek lain", correct: false },
        {
          text: "Dapat menyerang otak, jantung, paru-paru, serta kondisi mental & emosional",
          correct: true,
        },
        { text: "Hanya berbahaya jika digunakan setiap hari", correct: false },
        { text: "Tidak berbahaya selama dosisnya kecil", correct: false },
      ],
      feedback:
        "Inhalan dapat memengaruhi organ vital (otak, jantung, paru-paru) sekaligus kondisi mental dan emosional penggunanya, bahkan dalam pemakaian jangka pendek.",
    },
  ],
  2: [
    {
      id: "l2-q1",
      npc: "Kelompok Teman",
      prompt:
        "Tiga temanmu mendesak: \"Semua di sini udah coba, kamu doang yang belum. Gak usah lebay.\"",
      options: [
        { text: "Ikut coba supaya tidak dikucilkan", correct: false },
        {
          text: "\"Aku tetap gak mau, ini soal kesehatanku, bukan soal ikut-ikutan.\"",
          correct: true,
        },
        { text: "Berdalih akan mencoba lain waktu", correct: false },
        { text: "Menghindar tanpa memberi alasan sama sekali", correct: false },
      ],
      feedback:
        "Menyatakan alasan dengan tegas dan percaya diri adalah bentuk resistensi yang lebih kuat dibanding menghindar tanpa alasan, karena melatih keteguhan sikap.",
    },
    {
      id: "l2-q2",
      npc: "Kelompok Teman",
      prompt: "\"Cuma sekali ini aja, buat ngilangin stres UAS. Gak bakal ketagihan kok.\"",
      options: [
        {
          text: "Menjelaskan bahwa euforia instan dari inhalan bersifat sementara dan berisiko adiktif",
          correct: true,
        },
        { text: "Setuju karena sedang stres berat", correct: false },
        { text: "Menanyakan dulu berapa banyak yang dibutuhkan", correct: false },
        { text: "Ikut karena merasa 'cuma sekali'", correct: false },
      ],
      feedback:
        "Frasa 'cuma sekali' adalah pola ajakan klasik. Inhalan tetap tergolong zat adiktif meski legal secara bentuk produknya, dan risikonya tidak berkurang karena dianggap 'sekali saja'.",
    },
    {
      id: "l2-q3",
      npc: "Kelompok Teman",
      prompt: "Apa strategi paling efektif saat menghadapi tekanan kelompok (peer pressure)?",
      options: [
        { text: "Mengalah demi menjaga pertemanan", correct: false },
        {
          text: "Menyiapkan alasan menolak sejak awal & mencari dukungan teman lain yang sepaham",
          correct: true,
        },
        { text: "Menunggu sampai tekanan berhenti sendiri", correct: false },
        { text: "Menjauh dari topik tanpa menyampaikan pendapat", correct: false },
      ],
      feedback:
        "Teori inokulasi menekankan pentingnya latihan menyanggah sebelum tekanan datang, sehingga saat momen nyata terjadi, penolakan menjadi lebih mantap dan terlatih.",
    },
    {
      id: "l2-q4",
      npc: "Kelompok Teman",
      prompt: "\"Ayo ikut, nanti kita traktir. Anggap aja hadiah karena kamu asik.\"",
      options: [
        { text: "Ikut karena ada imbalannya", correct: false },
        {
          text: "Menolak — keputusan soal kesehatan tidak bisa ditukar dengan traktiran/hadiah",
          correct: true,
        },
        { text: "Tawar-menawar minta hadiah lebih dulu", correct: false },
        { text: "Ikut sekali saja demi menghargai ajakan", correct: false },
      ],
      feedback:
        "Iming-iming hadiah (bribery) adalah taktik persuasi. Menukar keselamatan diri dengan imbalan kecil adalah keputusan yang merugikan diri sendiri dalam jangka panjang.",
    },
    {
      id: "l2-q5",
      npc: "Kelompok Teman",
      prompt: "\"Santai, orang tuamu gak bakal tahu. Di sini aman, gak ada yang lihat.\"",
      options: [
        { text: "Ikut karena tidak akan ketahuan", correct: false },
        {
          text: "Menolak — risiko kesehatan tetap nyata meski tidak ada yang mengawasi",
          correct: true,
        },
        { text: "Ikut asal dijamin rahasia", correct: false },
        { text: "Ragu tapi akhirnya ikut", correct: false },
      ],
      feedback:
        "Alasan 'tidak akan ketahuan' mengalihkan fokus dari bahaya sebenarnya. Keputusan sehat diambil untuk melindungi diri sendiri, bukan sekadar menghindari pengawasan orang lain.",
    },
    {
      id: "l2-q6",
      npc: "Kelompok Teman",
      prompt: "\"Masa nolak ajakan teman sendiri? Gak setia kawan banget kamu.\"",
      options: [
        { text: "Ikut supaya dianggap setia kawan", correct: false },
        {
          text: "\"Justru karena teman, aku gak mau kita sama-sama celaka.\"",
          correct: true,
        },
        { text: "Minta maaf lalu tetap ikut", correct: false },
        { text: "Diam agar tidak dianggap sombong", correct: false },
      ],
      feedback:
        "Tuduhan 'tidak setia kawan' (guilt-tripping) memutarbalikkan makna pertemanan. Kesetiakawanan sejati adalah saling menjaga dari bahaya, bukan saling menjerumuskan.",
    },
  ],
  3: [
    {
      id: "l3-q1",
      npc: "Netizen / Figur Publik",
      prompt:
        "Sebuah unggahan viral menyebut, \"Ini cuma gas tertawa buat kesenangan, dipakai juga di rumah sakit, jadi pasti aman.\"",
      options: [
        {
          text: "Menggunakan N2O di rumah sakit dilakukan dokter dengan dosis & pengawasan ketat — sangat berbeda dengan penggunaan bebas untuk hiburan",
          correct: true,
        },
        { text: "Karena dipakai rumah sakit, berarti aman dipakai siapa saja", correct: false },
        { text: "Ikut tren karena sedang viral", correct: false },
        { text: "Membagikan ulang unggahan tanpa memeriksa faktanya", correct: false },
      ],
      feedback:
        "Konteks penggunaan medis (dosis terukur, pengawasan tenaga profesional) sangat berbeda dari penggunaan rekreasional tanpa pengawasan. Menyamakan keduanya adalah bentuk misinformasi umum.",
    },
    {
      id: "l3-q2",
      npc: "Netizen / Figur Publik",
      prompt: "\"Ribuan orang udah nonton video aku pakai ini dan baik-baik aja, kalian cuma parno doang.\"",
      options: [
        { text: "Ikut percaya karena banyak yang menonton dan mendukung", correct: false },
        {
          text: "Jumlah penonton/like bukan bukti ilmiah keamanan suatu zat",
          correct: true,
        },
        { text: "Menganggap yang mengingatkan bahaya adalah lebay", correct: false },
        { text: "Menunggu ada korban dulu sebelum percaya risikonya", correct: false },
      ],
      feedback:
        "Popularitas sebuah konten (views, likes) bukan validasi ilmiah. Risiko kesehatan tetap nyata meski belum terlihat dampaknya secara langsung di depan kamera.",
    },
    {
      id: "l3-q3",
      npc: "Netizen / Figur Publik",
      prompt: "Sikap paling tepat ketika melihat konten yang menormalisasi penyalahgunaan inhalan di media sosial adalah...",
      options: [
        {
          text: "Bersikap kritis, mencari sumber terpercaya, dan tidak ikut menyebarluaskan",
          correct: true,
        },
        { text: "Menganggap itu hal biasa karena banyak orang melakukannya", correct: false },
        { text: "Mencoba sendiri untuk membuktikan benar atau salah", correct: false },
        { text: "Membagikan ulang agar teman lain juga tahu triknya", correct: false },
      ],
      feedback:
        "Normalisasi di media sosial meningkatkan risiko penyalahgunaan zat pada remaja. Sikap kritis dan verifikasi ke sumber resmi (misalnya BPOM/BNN) adalah bentuk pertahanan psikologis yang diajarkan Teori Inokulasi.",
    },
    {
      id: "l3-q4",
      npc: "Netizen / Figur Publik",
      prompt: "\"Produk ini kan 'natural' dan 'organik', jadi pasti aman buat dipakai.\"",
      options: [
        { text: "Percaya karena berlabel natural/organik", correct: false },
        {
          text: "Label 'natural/organik' bukan jaminan aman untuk dihirup — banyak zat alami tetap beracun",
          correct: true,
        },
        { text: "Ikut karena terdengar sehat", correct: false },
        { text: "Membagikan info tanpa mengecek", correct: false },
      ],
      feedback:
        "Klaim 'natural/organik' adalah daya tarik pemasaran, bukan bukti keamanan. Banyak zat alami tetap berbahaya bila disalahgunakan; keamanan ditentukan oleh cara & konteks pakai, bukan label.",
    },
    {
      id: "l3-q5",
      npc: "Netizen / Figur Publik",
      prompt: "\"Ada penelitian yang membuktikan ini aman kok, linknya ada di bio aku.\"",
      options: [
        { text: "Langsung percaya karena disebut 'penelitian'", correct: false },
        {
          text: "Memeriksa kredibilitas sumbernya — jurnal/institusi resmi, bukan sekadar link di bio",
          correct: true,
        },
        { text: "Percaya karena ada kata 'penelitian'", correct: false },
        { text: "Menyebarkan link itu ke teman-teman", correct: false },
      ],
      feedback:
        "Menyebut 'ada penelitian' tanpa sumber yang bisa diverifikasi (jurnal, lembaga resmi) adalah taktik misinformasi. Selalu telusuri kredibilitas sumber sebelum mempercayainya.",
    },
    {
      id: "l3-q6",
      npc: "Netizen / Figur Publik",
      prompt: "\"Challenge ini lagi viral banget, kalau gak ikut kamu ketinggalan zaman.\"",
      options: [
        { text: "Ikut supaya tidak dianggap ketinggalan", correct: false },
        {
          text: "Tren viral bukan alasan untuk mempertaruhkan kesehatan diri",
          correct: true,
        },
        { text: "Ikut asal direkam biar dapat views", correct: false },
        { text: "Ikut sekali demi konten", correct: false },
      ],
      feedback:
        "Rasa takut ketinggalan (FOMO) sengaja dipakai agar orang ikut tanpa berpikir. Nilai diri tidak ditentukan oleh keikutsertaan dalam tren berbahaya.",
    },
    {
      id: "l3-q7",
      npc: "Netizen / Figur Publik",
      prompt: "\"Lihat, ribuan komentar bilang 'aman kok'. Berarti emang aman.\"",
      options: [
        { text: "Percaya karena mayoritas komentar bilang aman", correct: false },
        {
          text: "Banyaknya komentar setuju bukan bukti ilmiah — itu efek ikut-ikutan (bandwagon)",
          correct: true,
        },
        { text: "Ikut komentar mayoritas", correct: false },
        { text: "Menganggap yang ragu cuma minoritas yang salah", correct: false },
      ],
      feedback:
        "Konsensus kolom komentar bukan validasi ilmiah. Kebenaran fakta kesehatan tidak ditentukan oleh berapa banyak orang yang menyetujuinya di media sosial.",
    },
    {
      id: "l3-q8",
      npc: "Netizen / Figur Publik",
      prompt: "\"Video edukasi soal bahaya inhalan itu cuma nakut-nakutin, hoax doang.\"",
      options: [
        { text: "Setuju bahwa itu cuma menakut-nakuti", correct: false },
        {
          text: "Informasi dari otoritas kesehatan (Kemenkes/BNN/BPOM) kredibel; menuduh 'hoax' tanpa dasar justru taktik misinformasi",
          correct: true,
        },
        { text: "Mengabaikan semua peringatan bahaya", correct: false },
        { text: "Ikut menuduh sumber resmi berbohong", correct: false },
      ],
      feedback:
        "Melabeli informasi resmi sebagai 'hoax' tanpa bukti (discrediting) dipakai untuk melemahkan sumber kredibel. Percayai lembaga kesehatan resmi dan periksa buktinya, bukan tuduhannya.",
    },
    {
      id: "l3-q9",
      npc: "Netizen / Figur Publik",
      prompt: "\"Kalau memang berbahaya, kenapa masih dijual bebas di mana-mana?\"",
      options: [
        { text: "Berarti aman karena dijual bebas", correct: false },
        {
          text: "Produk itu legal untuk fungsi tertentu (mis. kuliner/industri) — bukan berarti aman kalau disalahgunakan untuk dihirup",
          correct: true,
        },
        { text: "Membeli karena mudah didapat", correct: false },
        { text: "Menganggap semua yang legal pasti sehat", correct: false },
      ],
      feedback:
        "Ketersediaan/legalitas sebuah produk untuk fungsi aslinya tidak menjamin keamanannya bila disalahgunakan. Penyalahgunaan di luar fungsi tetap berisiko tinggi.",
    },
    {
      id: "l3-q10",
      npc: "Netizen / Figur Publik",
      prompt: "Sikap paling tepat saat menerima informasi kesehatan viral yang meragukan adalah...",
      options: [
        { text: "Langsung mempercayai dan ikut menyebarkan", correct: false },
        {
          text: "Verifikasi dulu ke sumber resmi (Kemenkes/BNN/BPOM) sebelum percaya atau membagikannya",
          correct: true,
        },
        { text: "Membagikan dulu, urusan benar/salah belakangan", correct: false },
        { text: "Mengabaikan tanpa memeriksa apa pun", correct: false },
      ],
      feedback:
        "Langkah pertahanan terbaik adalah verifikasi ke sumber resmi sebelum mempercayai atau menyebarkan. Menahan diri untuk tidak ikut menyebar misinformasi juga bagian dari tanggung jawab digital.",
    },
  ],
};

// Aturan tiap level:
//   questions = jumlah soal disediakan di level itu
//   maxWrong  = batas salah MASIH lolos (salah > maxWrong = gagal)
//   failRoom  = nama ruang bertema yang ditampilkan saat gagal
//   failGoTo  = level yang diulang saat gagal (L3 gagal -> balik ke L2)
//   opponents = flavor "1 vs N" musuh di peta (tidak memengaruhi mekanik)
export const LEVEL_META = {
  1: { name: "Level 1", opponents: 1, questions: 3, maxWrong: 1, failRoom: "Ruang Bimbingan", failGoTo: 1 },
  2: { name: "Level 2", opponents: 3, questions: 6, maxWrong: 2, failRoom: "Rumah Sakit", failGoTo: 2 },
  3: { name: "Level 3", opponents: 5, questions: 10, maxWrong: 2, failRoom: "Rumah Sakit", failGoTo: 2 },
};

// Live in-memory cache the game engine actually reads from. Starts as the
// seed content and gets replaced by loadChallengesFromDB() at server
// startup (and again after any admin write).
let activeChallenges = SEED_CHALLENGES;

/** Called once at server startup, and again after any admin CRUD write. */
export async function loadChallengesFromDB() {
  if (!supabase) {
    activeChallenges = SEED_CHALLENGES;
    return;
  }

  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .order("level", { ascending: true })
    .order("order_index", { ascending: true });

  if (error) {
    // Ini masalah beneran: tabel belum dibuat, RLS memblokir, atau koneksi
    // gagal. Pakai seed supaya game tetap jalan, tapi jelaskan sebabnya.
    console.warn(
      `[SHIELD] Gagal ambil tabel \`challenges\` dari Supabase (${error.message}) — memakai soal bawaan (seed). Pastikan schema.sql sudah dijalankan.`
    );
    activeChallenges = SEED_CHALLENGES;
    return;
  }
  if (!data || data.length === 0) {
    // Kondisi NORMAL: belum ada soal custom di /admin, jadi pakai bawaan.
    console.log(
      "[SHIELD] Tabel `challenges` masih kosong — memakai soal bawaan (seed). Isi lewat /admin kalau mau soal custom."
    );
    activeChallenges = SEED_CHALLENGES;
    return;
  }

  const grouped = { 1: [], 2: [], 3: [] };
  data.forEach((row) => {
    if (!grouped[row.level]) grouped[row.level] = [];
    grouped[row.level].push({
      id: String(row.id),
      npc: row.npc,
      prompt: row.prompt,
      options: row.options, // jsonb: [{ text, correct }, ...]
      feedback: row.feedback,
    });
  });
  activeChallenges = grouped;
  console.log(`[SHIELD] Memuat ${data.length} soal dari Supabase.`);
}

export function getChallenge(level, index) {
  const list = activeChallenges[level] || [];
  if (list.length === 0) return null;
  // Cycle (modulo) kalau target soal per level > jumlah soal di bank, supaya
  // Level 2 (6) / Level 3 (10) tetap bisa jalan meski banknya baru 3 soal.
  return list[index % list.length];
}

/** Jumlah soal di bank untuk sebuah level (konten aktif: seed atau Supabase). */
export function levelLength(level) {
  return (activeChallenges[level] || []).length;
}

/** Jumlah soal TARGET yang harus dijawab di sebuah level menurut desain
 * mekanik (LEVEL_META.questions), terlepas dari berapa soal ada di bank. */
export function levelQuestionCount(level) {
  return LEVEL_META[level]?.questions ?? levelLength(level);
}

/** Batas salah yang masih dianggap lolos untuk sebuah level. */
export function levelMaxWrong(level) {
  return LEVEL_META[level]?.maxWrong ?? 0;
}

// ---- Admin CRUD (all operate directly on Supabase, then refresh the
// in-memory cache above so the running game picks up changes immediately).

export async function adminListChallenges() {
  if (!supabase) return { seedOnly: true, rows: flattenSeed() };

  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .order("level", { ascending: true })
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return { seedOnly: false, rows: data };
}

export async function adminCreateChallenge(payload) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data, error } = await supabase.from("challenges").insert(payload).select().single();
  if (error) throw new Error(error.message);
  await loadChallengesFromDB();
  return data;
}

export async function adminUpdateChallenge(id, payload) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data, error } = await supabase
    .from("challenges")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await loadChallengesFromDB();
  return data;
}

export async function adminDeleteChallenge(id) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { error } = await supabase.from("challenges").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await loadChallengesFromDB();
}

/** One-click "starter content" — inserts the built-in seed questions into
 * Supabase so an admin has something to edit instead of starting blank. */
export async function adminSeedDefaults() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const rows = flattenSeed();
  const { error } = await supabase.from("challenges").insert(rows);
  if (error) throw new Error(error.message);
  await loadChallengesFromDB();
}

function flattenSeed() {
  const rows = [];
  Object.entries(SEED_CHALLENGES).forEach(([level, list]) => {
    list.forEach((c, idx) => {
      rows.push({
        level: Number(level),
        npc: c.npc,
        prompt: c.prompt,
        options: c.options,
        feedback: c.feedback,
        order_index: idx,
      });
    });
  });
  return rows;
}