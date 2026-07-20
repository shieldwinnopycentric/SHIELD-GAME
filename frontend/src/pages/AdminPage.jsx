import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { socket } from "../lib/socket.js";

const PhaserGame = lazy(() => import("../game/PhaserGame.jsx"));

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const TOKEN_STORAGE_KEY = "shield_admin_token";

const LEVELS = [1, 2, 3];
const LEVEL_TARGETS = { 1: 3, 2: 6, 3: 10 };
const LEVEL_ACCENTS = {
  1: { text: "text-primary", border: "border-primary", bg: "bg-primary" },
  2: { text: "text-success", border: "border-success", bg: "bg-success" },
  3: { text: "text-danger", border: "border-danger", bg: "bg-danger" },
};
const ROOM_ACCENTS = {
  bimbingan: { text: "text-primary", border: "border-primary", icon: "🧭" },
  "rumah-sakit": { text: "text-danger", border: "border-danger", icon: "🏥" },
  penjara: { text: "text-gold", border: "border-gold", icon: "⛓️" },
};

const emptyForm = {
  level: 1,
  npc: "",
  prompt: "",
  options: [
    { text: "", correct: true },
    { text: "", correct: false },
    { text: "", correct: false },
    { text: "", correct: false },
  ],
  feedback: "",
  order_index: 0,
};

async function api(path, token, options = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-admin-token": token } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request gagal (${res.status})`);
  return data;
}

function LoginForm({ onLogin }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal verifikasi.");
      if (!data.ok) throw new Error("Token admin salah.");
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      onLogin(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-panel border border-line rounded-xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-1">
          <span className="w-10 h-10 rounded-lg bg-shield/15 border border-shield flex items-center justify-center text-xl">
            🛡️
          </span>
          <h1 className="font-display text-3xl font-bold">SHIELD Admin</h1>
        </div>
        <p className="text-parchment/50 text-sm mb-6">
          Dashboard konten: bank soal &amp; materi ruang edukasi.
        </p>
        <input
          type="password"
          autoFocus
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Token admin"
          className="w-full bg-void border border-line rounded-md px-4 py-3 mb-3 focus:outline-none focus:border-shield"
        />
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-shield disabled:opacity-50 text-void font-display text-lg font-bold py-3 rounded-md"
        >
          {loading ? "Memeriksa..." : "Masuk"}
        </button>
        <p className="text-parchment/30 text-xs mt-4">
          masukan token yang sudah diset.
        </p>
      </form>
    </div>
  );
}

function SectionHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {subtitle && <p className="text-parchment/50 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

function StatCard({ label, value, sub, accent = "text-parchment" }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-parchment/45">{label}</p>
      <p className={`font-display text-3xl font-bold mt-1 ${accent}`}>{value}</p>
      {sub && <p className="text-parchment/45 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ children, tone = "line" }) {
  const tones = {
    line: "border-line text-parchment/60",
    success: "border-success/60 text-success bg-success/10",
    gold: "border-gold/60 text-gold bg-gold/10",
  };
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${tones[tone]}`}>
      {children}
    </span>
  );
}

function SeedOnlyBanner() {
  return (
    <div className="bg-alert/10 border border-alert rounded-xl p-4 mb-5 text-sm">
      Supabase belum di-set di backend (<code>SUPABASE_URL</code> /{" "}
      <code>SUPABASE_SERVICE_ROLE_KEY</code>), jadi dashboard hanya menampilkan konten bawaan
      (read-only). Set env itu dulu untuk bisa menambah/mengedit/menghapus dari sini.
    </div>
  );
}

function ChallengeForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateOption(idx, field, value) {
    const options = form.options.map((o, i) => {
      if (field === "correct") {
        return { ...o, correct: i === idx };
      }
      return i === idx ? { ...o, [field]: value } : o;
    });
    setForm({ ...form, options });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.npc.trim() || !form.prompt.trim() || !form.feedback.trim()) {
      setError("NPC, prompt, dan feedback wajib diisi.");
      return;
    }
    if (form.options.some((o) => !o.text.trim())) {
      setError("Semua 4 opsi jawaban wajib diisi.");
      return;
    }
    if (!form.options.some((o) => o.correct)) {
      setError("Pilih salah satu opsi sebagai jawaban benar.");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-shield rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs text-parchment/50 uppercase mb-1">Level</label>
          <select
            value={form.level}
            onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
            className="bg-void border border-line rounded-md px-3 py-2"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-parchment/50 uppercase mb-1">NPC / Sumber</label>
          <input
            value={form.npc}
            onChange={(e) => setForm({ ...form, npc: e.target.value })}
            className="w-full bg-void border border-line rounded-md px-3 py-2"
            placeholder="Nama NPC / 'Kelompok Teman' / 'Netizen'"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-parchment/50 uppercase mb-1">Urutan</label>
          <input
            type="number"
            value={form.order_index}
            onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })}
            className="w-full bg-void border border-line rounded-md px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-parchment/50 uppercase mb-1">
          Prompt (skenario ajakan/klaim)
        </label>
        <textarea
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          rows={3}
          className="w-full bg-void border border-line rounded-md px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-xs text-parchment/50 uppercase mb-2">
          Opsi Jawaban (pilih 1 sebagai jawaban benar)
        </label>
        <div className="space-y-2">
          {form.options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-option"
                checked={opt.correct}
                onChange={() => updateOption(idx, "correct", true)}
                className="accent-success"
              />
              <input
                value={opt.text}
                onChange={(e) => updateOption(idx, "text", e.target.value)}
                placeholder={`Opsi ${idx + 1}`}
                className={`flex-1 bg-void border rounded-md px-3 py-2 ${
                  opt.correct ? "border-success" : "border-line"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-parchment/50 uppercase mb-1">
          Feedback (penjelasan/refutation setelah dijawab)
        </label>
        <textarea
          value={form.feedback}
          onChange={(e) => setForm({ ...form, feedback: e.target.value })}
          rows={2}
          className="w-full bg-void border border-line rounded-md px-3 py-2"
        />
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line rounded-md py-2 text-parchment/70"
        >
          Batal
        </button>
        <button
          disabled={saving}
          className="flex-1 bg-shield disabled:opacity-50 text-void font-display font-bold rounded-md py-2"
        >
          {saving ? "Menyimpan..." : "Simpan Soal"}
        </button>
      </div>
    </form>
  );
}

function BankSoalSection({ token, rows, seedOnly, loading, error, onRefresh }) {
  const [activeLevel, setActiveLevel] = useState(1);
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);

  async function handleSave(form) {
    const payload = {
      level: form.level,
      npc: form.npc,
      prompt: form.prompt,
      options: form.options,
      feedback: form.feedback,
      order_index: form.order_index,
    };
    if (editing && editing.id) {
      await api(`/api/admin/challenges/${editing.id}`, token, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/admin/challenges", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    setEditing(null);
    onRefresh();
  }

  async function handleDelete(id) {
    if (!confirm("Hapus soal ini?")) return;
    try {
      await api(`/api/admin/challenges/${id}`, token, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      await api("/api/admin/challenges/seed", token, { method: "POST" });
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSeeding(false);
    }
  }

  const levelRows = rows.filter((r) => r.level === activeLevel);
  const accent = LEVEL_ACCENTS[activeLevel];

  return (
    <div>
      <SectionHeader
        title="Bank Soal"
        subtitle="Skenario ajakan/misinformasi + pilihan respon per level."
      >
        {!seedOnly && (
          <button
            onClick={() => setEditing("new")}
            className="bg-primary text-void font-display font-bold px-4 py-2 rounded-md"
          >
            + Tambah Soal
          </button>
        )}
      </SectionHeader>

      {seedOnly && <SeedOnlyBanner />}

      {!seedOnly && rows.length === 0 && !loading && (
        <div className="bg-panel border border-line rounded-xl p-4 mb-5 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>Tabel soal masih kosong. Mulai dari soal bawaan (bisa diedit setelahnya)?</span>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="bg-shield disabled:opacity-50 text-void font-display font-bold px-4 py-2 rounded-md whitespace-nowrap"
          >
            {seeding ? "Mengisi..." : "Isi Soal Default"}
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {LEVELS.map((l) => {
          const count = rows.filter((r) => r.level === l).length;
          return (
            <button
              key={l}
              onClick={() => setActiveLevel(l)}
              className={`px-4 py-2 rounded-md font-display flex items-center gap-2 ${
                activeLevel === l
                  ? `${LEVEL_ACCENTS[l].bg} text-void font-bold`
                  : "bg-panel border border-line text-parchment/70"
              }`}
            >
              Level {l}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeLevel === l ? "bg-void/20" : "bg-void border border-line"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}
      {loading && <p className="text-parchment/50 text-sm">Memuat...</p>}

      {editing && (
        <div className="mb-5">
          <ChallengeForm
            initial={editing === "new" ? { ...emptyForm, level: activeLevel } : editing}
            onCancel={() => setEditing(null)}
            onSave={handleSave}
          />
        </div>
      )}

      <div className="space-y-3">
        {levelRows.map((row, i) => (
          <div key={row.id} className="bg-panel border border-line rounded-xl p-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className={`${accent.text} text-xs font-display uppercase tracking-wider`}>
                  #{i + 1} · {row.npc}
                </p>
                <p className="text-sm mt-1">{row.prompt}</p>
              </div>
              {!seedOnly && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditing(row)}
                    className="text-shield text-sm hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(row.id)}
                    className="text-danger text-sm hover:underline"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              {row.options.map((o, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-2 rounded-md border ${
                    o.correct ? "border-success bg-success/10" : "border-line"
                  }`}
                >
                  {o.text}
                </div>
              ))}
            </div>
            <p className="text-parchment/50 text-xs mt-3">{row.feedback}</p>
          </div>
        ))}
        {!loading && levelRows.length === 0 && (
          <p className="text-parchment/40 text-sm">Belum ada soal di level ini.</p>
        )}
      </div>
    </div>
  );
}

function RoomMaterialForm({ room, seedOnly, onSave, onReset }) {
  const [form, setForm] = useState({
    speaker: room.speaker,
    greeting: room.greeting,
    title: room.title,
    sections: room.sections.map((s) => ({ ...s })),
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setForm({
      speaker: room.speaker,
      greeting: room.greeting,
      title: room.title,
      sections: room.sections.map((s) => ({ ...s })),
    });
    setError("");
    setSavedAt(null);
  }, [room]);

  const accent = ROOM_ACCENTS[room.key];

  function updateSection(idx, field, value) {
    const sections = form.sections.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
    setForm({ ...form, sections });
  }

  function addSection() {
    setForm({ ...form, sections: [...form.sections, { heading: "", body: "" }] });
  }

  function removeSection(idx) {
    if (form.sections.length <= 1) return;
    setForm({ ...form, sections: form.sections.filter((_, i) => i !== idx) });
  }

  function moveSection(idx, dir) {
    const to = idx + dir;
    if (to < 0 || to >= form.sections.length) return;
    const sections = [...form.sections];
    [sections[idx], sections[to]] = [sections[to], sections[idx]];
    setForm({ ...form, sections });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.speaker.trim() || !form.greeting.trim() || !form.title.trim()) {
      setError("Pembicara, sapaan, dan judul materi wajib diisi.");
      return;
    }
    if (form.sections.some((s) => !s.heading.trim() || !s.body.trim())) {
      setError("Setiap bagian materi wajib punya judul dan isi.");
      return;
    }
    setSaving(true);
    try {
      await onSave(room.key, form);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm(`Kembalikan materi "${room.name}" ke versi bawaan? Perubahan kustom akan dihapus.`))
      return;
    setResetting(true);
    setError("");
    try {
      await onReset(room.key);
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-panel border ${accent.border} rounded-xl p-5 space-y-4`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`font-display text-lg font-bold ${accent.text}`}>
          {accent.icon} {room.name}
        </p>
        <div className="flex items-center gap-2">
          {room.custom ? <Badge tone="gold">Kustom</Badge> : <Badge>Bawaan</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <label className="block text-xs text-parchment/50 uppercase mb-1">Pembicara</label>
          <input
            value={form.speaker}
            onChange={(e) => setForm({ ...form, speaker: e.target.value })}
            disabled={seedOnly}
            className="w-full bg-void border border-line rounded-md px-3 py-2 disabled:opacity-60"
            placeholder="Konselor / Dokter / Petugas"
          />
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs text-parchment/50 uppercase mb-1">Judul Materi</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            disabled={seedOnly}
            className="w-full bg-void border border-line rounded-md px-3 py-2 disabled:opacity-60"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-parchment/50 uppercase mb-1">
          Sapaan Pembuka (gelembung chat saat pemain masuk)
        </label>
        <textarea
          value={form.greeting}
          onChange={(e) => setForm({ ...form, greeting: e.target.value })}
          disabled={seedOnly}
          rows={2}
          className="w-full bg-void border border-line rounded-md px-3 py-2 disabled:opacity-60"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-parchment/50 uppercase">
            Bagian Materi ({form.sections.length})
          </label>
          {!seedOnly && (
            <button
              type="button"
              onClick={addSection}
              className="text-shield text-sm hover:underline"
            >
              + Tambah Bagian
            </button>
          )}
        </div>
        <div className="space-y-3">
          {form.sections.map((s, idx) => (
            <div key={idx} className="bg-void/50 border border-line rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-parchment/40 text-xs w-6 shrink-0">#{idx + 1}</span>
                <input
                  value={s.heading}
                  onChange={(e) => updateSection(idx, "heading", e.target.value)}
                  disabled={seedOnly}
                  placeholder="Judul bagian"
                  className="flex-1 bg-void border border-line rounded-md px-3 py-1.5 text-sm disabled:opacity-60"
                />
                {!seedOnly && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveSection(idx, -1)}
                      disabled={idx === 0}
                      className="w-7 h-7 rounded border border-line text-parchment/60 disabled:opacity-30 hover:border-parchment/40"
                      title="Naikkan"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(idx, 1)}
                      disabled={idx === form.sections.length - 1}
                      className="w-7 h-7 rounded border border-line text-parchment/60 disabled:opacity-30 hover:border-parchment/40"
                      title="Turunkan"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(idx)}
                      disabled={form.sections.length <= 1}
                      className="w-7 h-7 rounded border border-line text-danger disabled:opacity-30 hover:border-danger"
                      title="Hapus bagian"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              <textarea
                value={s.body}
                onChange={(e) => updateSection(idx, "body", e.target.value)}
                disabled={seedOnly}
                rows={3}
                placeholder="Isi materi bagian ini..."
                className="w-full bg-void border border-line rounded-md px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}
      {savedAt && !error && (
        <p className="text-success text-sm">Materi tersimpan — langsung dipakai game.</p>
      )}

      {!seedOnly && (
        <div className="flex gap-2">
          {room.custom && (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="border border-line rounded-md py-2 px-4 text-parchment/70 disabled:opacity-50"
            >
              {resetting ? "Mengembalikan..." : "Kembalikan ke Bawaan"}
            </button>
          )}
          <button
            disabled={saving}
            className="flex-1 bg-shield disabled:opacity-50 text-void font-display font-bold rounded-md py-2"
          >
            {saving ? "Menyimpan..." : "Simpan Materi"}
          </button>
        </div>
      )}
    </form>
  );
}

function MateriRuangSection({ token, rooms, seedOnly, loading, error, onRefresh }) {
  const [activeKey, setActiveKey] = useState("bimbingan");
  const activeRoom = rooms.find((r) => r.key === activeKey);

  async function handleSave(roomKey, form) {
    await api(`/api/admin/room-materials/${roomKey}`, token, {
      method: "PUT",
      body: JSON.stringify(form),
    });
    onRefresh();
  }

  async function handleReset(roomKey) {
    await api(`/api/admin/room-materials/${roomKey}`, token, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div>
      <SectionHeader
        title="Materi Ruang"
        subtitle="Materi literasi yang dibaca pemain saat gagal level dan masuk ruang bertema."
      />

      {seedOnly && <SeedOnlyBanner />}
      {error && <p className="text-danger text-sm mb-3">{error}</p>}
      {loading && <p className="text-parchment/50 text-sm">Memuat...</p>}

      <div className="flex gap-2 mb-4">
        {rooms.map((r) => {
          const a = ROOM_ACCENTS[r.key];
          return (
            <button
              key={r.key}
              onClick={() => setActiveKey(r.key)}
              className={`px-4 py-2 rounded-md font-display flex items-center gap-2 border ${
                activeKey === r.key
                  ? `${a.border} bg-panel ${a.text} font-bold`
                  : "border-line bg-panel text-parchment/60"
              }`}
            >
              <span>{a.icon}</span>
              {r.name}
              {r.custom && <span className="w-1.5 h-1.5 rounded-full bg-gold" title="Kustom" />}
            </button>
          );
        })}
      </div>

      {activeRoom && (
        <RoomMaterialForm
          key={activeRoom.key}
          room={activeRoom}
          seedOnly={seedOnly}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

function OverviewSection({ challengeRows, rooms, seedOnly, onNavigate }) {
  const totalSoal = challengeRows.length;

  return (
    <div>
      <SectionHeader
        title="Ringkasan"
        subtitle="Kondisi konten edukasi yang sedang dipakai game."
      />

      {seedOnly && <SeedOnlyBanner />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Soal"
          value={totalSoal}
          sub={seedOnly ? "soal bawaan (read-only)" : "soal di Supabase"}
          accent="text-gold"
        />
        {LEVELS.map((l) => {
          const count = challengeRows.filter((r) => r.level === l).length;
          const target = LEVEL_TARGETS[l];
          const short = count > 0 && count < target;
          return (
            <StatCard
              key={l}
              label={`Soal Level ${l}`}
              value={count}
              sub={
                count === 0
                  ? `target ${target} soal — masih kosong`
                  : short
                  ? `target ${target} — soal akan diputar ulang`
                  : `target ${target} soal ✓`
              }
              accent={LEVEL_ACCENTS[l].text}
            />
          );
        })}
      </div>

      <h3 className="font-display text-lg font-bold mb-3">Materi Ruang Kegagalan</h3>
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        {rooms.map((r) => {
          const a = ROOM_ACCENTS[r.key];
          return (
            <button
              key={r.key}
              onClick={() => onNavigate("rooms")}
              className={`text-left bg-panel border ${a.border} rounded-xl p-4 hover:brightness-110 transition`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`font-display font-bold ${a.text}`}>
                  {a.icon} {r.name}
                </p>
                {r.custom ? <Badge tone="gold">Kustom</Badge> : <Badge>Bawaan</Badge>}
              </div>
              <p className="text-sm text-parchment/70 line-clamp-2">{r.title}</p>
              <p className="text-xs text-parchment/40 mt-2">
                {r.sections?.length ?? 0} bagian materi · pembicara: {r.speaker}
              </p>
            </button>
          );
        })}
        {rooms.length === 0 && (
          <p className="text-parchment/40 text-sm md:col-span-3">Memuat materi ruang...</p>
        )}
      </div>

      <div className="bg-panel border border-line rounded-xl p-4 text-sm text-parchment/60">
        <p className="font-display font-bold text-parchment mb-1">Cara kerja konten</p>
        <p>
          Soal dan materi ruang bawaan sudah tertanam di server. Begitu kamu menyimpan versi
          sendiri lewat dashboard ini, versi itu langsung menggantikan yang bawaan di game —
          tanpa restart. "Kembalikan ke Bawaan" menghapus versi kustom sebuah ruang.
        </p>
      </div>
    </div>
  );
}

const CHAR_LABELS = { nexus: "Nexus", cypher: "Cypher", helix: "Helix" };
const STATUS_LABELS = {
  lobby: { text: "Lobby", tone: "gold" },
  running: { text: "Berjalan", tone: "success" },
  finished: { text: "Selesai", tone: "line" },
};

function formatTime(ms) {
  if (ms == null) return "--:--";
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function SpectateSection({ token }) {
  const [roomList, setRoomList] = useState([]);
  const [listError, setListError] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [watching, setWatching] = useState(null); // kode room yang sedang dipantau
  const [state, setState] = useState(null); // { status, players, timeLeftMs, leaderboard }
  const [error, setError] = useState("");
  // Hitung mundur lokal antar push server (server hanya push saat ada event).
  const baseRef = useRef({ at: 0, left: null });
  const [, forceTick] = useState(0);

  async function refreshList() {
    setListError("");
    try {
      const data = await api("/api/admin/rooms", token);
      setRoomList(data.rooms || []);
    } catch (err) {
      setListError(err.message);
    }
  }

  useEffect(() => {
    refreshList();
    const iv = setInterval(refreshList, 10000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onState(payload) {
      setState(payload);
      baseRef.current = { at: Date.now(), left: payload.timeLeftMs };
    }
    socket.on("spectate_state", onState);
    const tick = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => {
      socket.off("spectate_state", onState);
      clearInterval(tick);
      socket.emit("spectate_stop");
    };
  }, []);

  function watch(code) {
    setError("");
    if (!socket.connected) socket.connect();
    if (watching) socket.emit("spectate_stop");
    socket.emit("spectate_room", { code, adminToken: token }, (res) => {
      if (!res?.ok) {
        setWatching(null);
        setState(null);
        setError(
          res?.error === "ROOM_NOT_FOUND"
            ? "Room tidak ditemukan (mungkin sudah selesai dan dibersihkan)."
            : "Gagal memantau room — cek token admin."
        );
        return;
      }
      setWatching(res.code);
      setState(res);
      baseRef.current = { at: Date.now(), left: res.timeLeftMs };
    });
  }

  function stopWatching() {
    socket.emit("spectate_stop");
    setWatching(null);
    setState(null);
  }

  const liveTimeLeft =
    baseRef.current.left != null
      ? baseRef.current.left - (Date.now() - baseRef.current.at)
      : null;

  const players = state?.players || [];
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const statusMeta = STATUS_LABELS[state?.status] || STATUS_LABELS.lobby;

  return (
    <div>
      <SectionHeader
        title="Pantau Room"
        subtitle="Lihat jalannya sesi game secara live tanpa ikut jadi peserta."
      >
        <button
          onClick={refreshList}
          className="border border-line rounded-md px-4 py-2 text-sm text-parchment/70 hover:text-parchment"
        >
          ↻ Segarkan Daftar
        </button>
      </SectionHeader>

      {!watching && (
        <>
          <div className="bg-panel border border-line rounded-xl p-4 mb-5">
            <p className="text-xs text-parchment/50 uppercase mb-2">
              Atau masukkan kode room manual
            </p>
            <div className="flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Kode room"
                maxLength={5}
                className="flex-1 min-w-0 bg-void border border-line rounded-md px-4 py-2 uppercase tracking-widest text-center focus:outline-none focus:border-shield"
              />
              <button
                onClick={() => codeInput.trim() && watch(codeInput.trim())}
                className="bg-shield text-void font-display font-bold px-5 py-2 rounded-md"
              >
                Pantau
              </button>
            </div>
          </div>

          {listError && <p className="text-danger text-sm mb-3">{listError}</p>}
          {error && <p className="text-danger text-sm mb-3">{error}</p>}

          <div className="space-y-2">
            {roomList.map((r) => {
              const meta = STATUS_LABELS[r.status] || STATUS_LABELS.lobby;
              return (
                <button
                  key={r.code}
                  onClick={() => watch(r.code)}
                  className="w-full flex items-center justify-between bg-panel border border-line hover:border-shield rounded-xl px-4 py-3 transition text-left"
                >
                  <span className="flex items-center gap-3">
                    <span className="font-pixel tracking-[0.2em] text-gold">{r.code}</span>
                    <Badge tone={meta.tone}>{meta.text}</Badge>
                  </span>
                  <span className="text-sm text-parchment/60">
                    {r.playerCount} pemain
                    {r.timeLeftMs != null && ` · sisa ${formatTime(r.timeLeftMs)}`}
                  </span>
                </button>
              );
            })}
            {roomList.length === 0 && !listError && (
              <p className="text-parchment/40 text-sm">
                Tidak ada room aktif saat ini. Room muncul di sini begitu ada pemain yang
                membuatnya.
              </p>
            )}
          </div>
        </>
      )}

      {watching && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-panel border border-shield rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger" />
              </span>
              <span className="font-display font-bold">LIVE</span>
              <span className="font-pixel tracking-[0.2em] text-gold">{watching}</span>
              <Badge tone={statusMeta.tone}>{statusMeta.text}</Badge>
            </div>
            <div className="flex items-center gap-3">
              {state?.status === "running" && (
                <span className="font-display text-lg tabular-nums">
                  ⏱ {formatTime(liveTimeLeft)}
                </span>
              )}
              <button
                onClick={stopWatching}
                className="border border-line rounded-md px-3 py-1.5 text-sm text-parchment/70 hover:text-danger hover:border-danger/60"
              >
                Berhenti Memantau
              </button>
            </div>
          </div>

          <div className="relative w-full aspect-[8/5] rounded-lg overflow-hidden border border-line mb-4">
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-parchment/40 text-sm">Memuat peta...</div>}>
              <PhaserGame
                socket={socket}
                roomCode={watching}
                player={{}}
                initialRoster={players}
                currentLevel={1}
                spectator
              />
            </Suspense>
            <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10 text-center text-parchment/60 text-[11px] bg-void/60 backdrop-blur-sm rounded px-2 py-1 pointer-events-none">
              Drag / WASD untuk geser peta · hanya tampilan, tidak ada interaksi game
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Pemain" value={players.length} />
            <StatCard
              label="Selesai"
              value={players.filter((p) => p.finished).length}
              accent="text-success"
            />
            <StatCard
              label="Menang"
              value={players.filter((p) => p.won).length}
              accent="text-gold"
            />
            <StatCard
              label="Skor Tertinggi"
              value={sorted[0]?.score ?? 0}
              accent="text-shield"
            />
          </div>

          <div className="bg-panel border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-parchment/45 border-b border-line">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Pemain</th>
                  <th className="px-4 py-2.5">Level</th>
                  <th className="px-4 py-2.5">Soal</th>
                  <th className="px-4 py-2.5">Nyawa</th>
                  <th className="px-4 py-2.5">Benar</th>
                  <th className="px-4 py-2.5">Skor</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.id} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-2.5 text-parchment/40">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      {p.name}{" "}
                      <span className="text-parchment/40 text-xs">
                        ({CHAR_LABELS[p.character] || p.character})
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={LEVEL_ACCENTS[p.level]?.text}>Level {p.level}</span>
                    </td>
                    <td className="px-4 py-2.5 text-parchment/70">
                      {state?.status === "lobby" ? "—" : `#${(p.questionIndex ?? 0) + 1}`}
                    </td>
                    <td className="px-4 py-2.5">
                      {"❤".repeat(Math.max(0, p.lives ?? 0)) || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-success">{p.correctCount}</td>
                    <td className="px-4 py-2.5 font-display font-bold">{p.score}</td>
                    <td className="px-4 py-2.5">
                      {p.disconnected ? (
                        <span className="text-danger text-xs">Terputus</span>
                      ) : p.won ? (
                        <span className="text-gold text-xs">🏆 Menang</span>
                      ) : p.finished ? (
                        <span className="text-success text-xs">Selesai</span>
                      ) : state?.status === "lobby" ? (
                        <span className={p.ready ? "text-success text-xs" : "text-parchment/40 text-xs"}>
                          {p.ready ? "Siap" : "Menunggu"}
                        </span>
                      ) : (
                        <span className="text-parchment/50 text-xs">Bermain</span>
                      )}
                    </td>
                  </tr>
                ))}
                {players.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-parchment/40">
                      Belum ada pemain di room ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-parchment/40 text-xs mt-3">
            Kamu memantau sebagai admin — tidak terhitung sebagai pemain dan tidak terlihat
            oleh peserta. Data diperbarui otomatis setiap ada kejadian di game.
          </p>
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { id: "overview", label: "Ringkasan", icon: "📊" },
  { id: "spectate", label: "Pantau Room", icon: "📺" },
  { id: "challenges", label: "Bank Soal", icon: "📝" },
  { id: "rooms", label: "Materi Ruang", icon: "🚪" },
];

function AdminDashboard({ token, onLogout }) {
  const [section, setSection] = useState("overview");

  const [challengeRows, setChallengeRows] = useState([]);
  const [challengeSeedOnly, setChallengeSeedOnly] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [challengeError, setChallengeError] = useState("");

  const [rooms, setRooms] = useState([]);
  const [roomSeedOnly, setRoomSeedOnly] = useState(false);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomError, setRoomError] = useState("");

  async function refreshChallenges() {
    setChallengeLoading(true);
    setChallengeError("");
    try {
      const data = await api("/api/admin/challenges", token);
      setChallengeRows(data.rows || []);
      setChallengeSeedOnly(!!data.seedOnly);
    } catch (err) {
      setChallengeError(err.message);
    } finally {
      setChallengeLoading(false);
    }
  }

  async function refreshRooms() {
    setRoomLoading(true);
    setRoomError("");
    try {
      const data = await api("/api/admin/room-materials", token);
      setRooms(data.rooms || []);
      setRoomSeedOnly(!!data.seedOnly);
    } catch (err) {
      setRoomError(err.message);
    } finally {
      setRoomLoading(false);
    }
  }

  useEffect(() => {
    refreshChallenges();
    refreshRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seedOnly = challengeSeedOnly || roomSeedOnly;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-60 shrink-0 bg-panel/70 border-b md:border-b-0 md:border-r border-line md:min-h-screen flex md:flex-col">
        <div className="hidden md:flex items-center gap-2 px-5 py-5 border-b border-line">
          <span className="w-9 h-9 rounded-lg bg-shield/15 border border-shield flex items-center justify-center">
            🛡️
          </span>
          <div>
            <p className="font-display text-xl font-bold leading-tight">SHIELD</p>
            <p className="text-parchment/40 text-[11px] uppercase tracking-wider">Admin Panel</p>
          </div>
        </div>

        <nav className="flex md:flex-col flex-1 md:px-3 md:py-4 gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex items-center gap-3 px-4 md:px-3 py-3 md:py-2.5 rounded-md text-sm whitespace-nowrap ${
                section === item.id
                  ? "bg-shield/15 text-shield border border-shield/40 font-bold"
                  : "text-parchment/60 hover:text-parchment hover:bg-void/40 border border-transparent"
              }`}
            >
              <span>{item.icon}</span>
              <span className="font-display text-base">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="md:px-3 md:pb-4 px-2 py-2 md:py-0 flex md:block items-center">
          <div className="hidden md:flex items-center gap-2 px-3 pb-3">
            <span
              className={`w-2 h-2 rounded-full ${seedOnly ? "bg-alert" : "bg-success"}`}
            />
            <span className="text-[11px] text-parchment/45">
              {seedOnly ? "Mode read-only (seed)" : "Terhubung ke Supabase"}
            </span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem(TOKEN_STORAGE_KEY);
              onLogout();
            }}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-parchment/50 hover:text-danger hover:bg-void/40"
          >
            ⏻ Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-5xl">
        {section === "overview" && (
          <OverviewSection
            challengeRows={challengeRows}
            rooms={rooms}
            seedOnly={seedOnly}
            onNavigate={setSection}
          />
        )}
        {section === "spectate" && <SpectateSection token={token} />}
        {section === "challenges" && (
          <BankSoalSection
            token={token}
            rows={challengeRows}
            seedOnly={challengeSeedOnly}
            loading={challengeLoading}
            error={challengeError}
            onRefresh={refreshChallenges}
          />
        )}
        {section === "rooms" && (
          <MateriRuangSection
            token={token}
            rooms={rooms}
            seedOnly={roomSeedOnly}
            loading={roomLoading}
            error={roomError}
            onRefresh={refreshRooms}
          />
        )}
      </main>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || null);

  if (!token) return <LoginForm onLogin={setToken} />;
  return <AdminDashboard token={token} onLogout={() => setToken(null)} />;
}
