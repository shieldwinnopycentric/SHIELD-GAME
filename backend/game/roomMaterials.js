import { supabase } from "../lib/supabaseClient.js";

/**
 * SHIELD - Materi literasi untuk ruang kegagalan (GuidanceRoom di frontend).
 *
 * Tiga ruang bertema: "Ruang Bimbingan" (gagal L1), "Rumah Sakit" (gagal L2),
 * "Penjara" (gagal L3). Kontennya (sapaan pembicara, judul, dan bagian-bagian
 * materi) bisa dikelola admin lewat /admin — tema visual (warna/gambar) tetap
 * di frontend karena bukan konten edukasi.
 *
 * Pola sama dengan challenges.js: SEED di bawah adalah konten bawaan; begitu
 * ada baris di tabel `room_materials` (Supabase), baris itu menimpa seed per
 * ruang. Tanpa Supabase, admin melihat seed dalam mode read-only.
 */

// Kunci ruang dipakai sebagai id di URL admin & primary key di DB.
export const ROOM_KEYS = ["bimbingan", "rumah-sakit", "penjara"];

// Nama ruang persis seperti yang dikirim engine game (failRoom di
// LEVEL_META) — dipakai frontend untuk lookup, jadi JANGAN diubah.
export const ROOM_NAMES = {
  bimbingan: "Ruang Bimbingan",
  "rumah-sakit": "Rumah Sakit",
  penjara: "Penjara",
};

const SEED_ROOM_MATERIALS = {
  bimbingan: {
    speaker: "Konselor",
    greeting:
      "Selamat datang di Ruang Bimbingan. Mohon untuk melakukan literasi sebanyak-banyaknya terkait aksi penyalahgunaan inhalan.",
    title: "Literasi Dasar: Kenali Inhalan",
    sections: [
      {
        heading: "Apa itu inhalan?",
        body:
          "Inhalan adalah zat yang uapnya sengaja dihirup untuk memberi efek 'melayang' sesaat — misalnya gas N2O (dinitrogen oksida) pada tabung krim, lem, cat semprot, atau pengharum. Banyak produknya legal dijual untuk fungsi tertentu (kuliner, industri), TAPI legal untuk satu fungsi tidak berarti aman untuk dihirup.",
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
  "rumah-sakit": {
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
  penjara: {
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

// Cache in-memory yang dibaca endpoint publik. Mulai dari seed, ditimpa
// per-ruang oleh isi Supabase saat startup dan setelah admin menyimpan.
let activeMaterials = structuredClone(SEED_ROOM_MATERIALS);

/** Dipanggil sekali saat server start, dan lagi setiap admin menyimpan. */
export async function loadRoomMaterialsFromDB() {
  if (!supabase) {
    activeMaterials = structuredClone(SEED_ROOM_MATERIALS);
    return;
  }

  const { data, error } = await supabase.from("room_materials").select("*");
  if (error) {
    console.warn(
      `[SHIELD] Gagal ambil tabel \`room_materials\` dari Supabase (${error.message}) — memakai materi bawaan (seed). Pastikan schema.sql versi terbaru sudah dijalankan.`
    );
    activeMaterials = structuredClone(SEED_ROOM_MATERIALS);
    return;
  }

  const merged = structuredClone(SEED_ROOM_MATERIALS);
  (data || []).forEach((row) => {
    if (!ROOM_KEYS.includes(row.room_key)) return;
    merged[row.room_key] = {
      speaker: row.speaker,
      greeting: row.greeting,
      title: row.title,
      sections: row.sections,
    };
  });
  activeMaterials = merged;
  if (data?.length) {
    console.log(`[SHIELD] Memuat materi ${data.length} ruang dari Supabase.`);
  }
}

/** Konten aktif untuk frontend, di-key pakai NAMA ruang (failRoom). */
export function getPublicRoomMaterials() {
  const out = {};
  ROOM_KEYS.forEach((key) => {
    out[ROOM_NAMES[key]] = activeMaterials[key];
  });
  return out;
}

function validateMaterial(payload) {
  const speaker = String(payload?.speaker ?? "").trim();
  const greeting = String(payload?.greeting ?? "").trim();
  const title = String(payload?.title ?? "").trim();
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];

  if (!speaker || !greeting || !title) {
    throw new Error("Pembicara, sapaan, dan judul materi wajib diisi.");
  }
  if (sections.length === 0) {
    throw new Error("Materi harus punya minimal 1 bagian.");
  }
  const clean = sections.map((s) => ({
    heading: String(s?.heading ?? "").trim(),
    body: String(s?.body ?? "").trim(),
  }));
  if (clean.some((s) => !s.heading || !s.body)) {
    throw new Error("Setiap bagian materi wajib punya judul dan isi.");
  }
  return { speaker, greeting, title, sections: clean };
}

// ---- Admin ----------------------------------------------------------

/** Semua ruang untuk dashboard admin: konten aktif + status kustom/bawaan. */
export async function adminListRoomMaterials() {
  if (!supabase) {
    return {
      seedOnly: true,
      rooms: ROOM_KEYS.map((key) => ({
        key,
        name: ROOM_NAMES[key],
        custom: false,
        ...activeMaterials[key],
      })),
    };
  }

  const { data, error } = await supabase.from("room_materials").select("room_key");
  if (error) throw new Error(error.message);
  const customKeys = new Set((data || []).map((r) => r.room_key));
  return {
    seedOnly: false,
    rooms: ROOM_KEYS.map((key) => ({
      key,
      name: ROOM_NAMES[key],
      custom: customKeys.has(key),
      ...activeMaterials[key],
    })),
  };
}

/** Upsert materi sebuah ruang, lalu refresh cache. */
export async function adminUpdateRoomMaterial(roomKey, payload) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!ROOM_KEYS.includes(roomKey)) throw new Error("Ruang tidak dikenal.");
  const clean = validateMaterial(payload);
  const { error } = await supabase.from("room_materials").upsert(
    {
      room_key: roomKey,
      ...clean,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_key" }
  );
  if (error) throw new Error(error.message);
  await loadRoomMaterialsFromDB();
  return { key: roomKey, name: ROOM_NAMES[roomKey], ...activeMaterials[roomKey] };
}

/** Hapus kustomisasi sebuah ruang — kembali ke materi bawaan (seed). */
export async function adminResetRoomMaterial(roomKey) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!ROOM_KEYS.includes(roomKey)) throw new Error("Ruang tidak dikenal.");
  const { error } = await supabase.from("room_materials").delete().eq("room_key", roomKey);
  if (error) throw new Error(error.message);
  await loadRoomMaterialsFromDB();
  return { key: roomKey, name: ROOM_NAMES[roomKey], ...activeMaterials[roomKey] };
}
