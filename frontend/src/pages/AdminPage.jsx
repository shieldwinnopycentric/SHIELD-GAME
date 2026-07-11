import { useEffect, useState } from "react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const TOKEN_STORAGE_KEY = "shield_admin_token";

const LEVELS = [1, 2, 3];
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
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-panel border border-line rounded-lg p-6">
        <h1 className="font-display text-3xl font-bold mb-1">SHIELD Admin</h1>
        <p className="text-parchment/50 text-sm mb-6">Kelola soal/challenge edukasi per level.</p>
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
          Token diset lewat <code>ADMIN_TOKEN</code> di <code>backend/.env</code>.
        </p>
      </form>
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
        // single-correct-answer semantics: selecting one clears the rest
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
    <form onSubmit={handleSubmit} className="bg-panel border border-shield rounded-lg p-5 space-y-4">
      <div className="flex gap-4">
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
        <div className="flex-1">
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

function AdminDashboard({ token, onLogout }) {
  const [rows, setRows] = useState([]);
  const [seedOnly, setSeedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeLevel, setActiveLevel] = useState(1);
  const [editing, setEditing] = useState(null); // null | "new" | row
  const [seeding, setSeeding] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/admin/challenges", token);
      setRows(data.rows || []);
      setSeedOnly(!!data.seedOnly);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    refresh();
  }

  async function handleDelete(id) {
    if (!confirm("Hapus soal ini?")) return;
    try {
      await api(`/api/admin/challenges/${id}`, token, { method: "DELETE" });
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      await api("/api/admin/challenges/seed", token, { method: "POST" });
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSeeding(false);
    }
  }

  const levelRows = rows.filter((r) => r.level === activeLevel);

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">SHIELD Admin — Bank Soal</h1>
          <p className="text-parchment/50 text-sm">Kelola skenario/challenge edukasi per level.</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            onLogout();
          }}
          className="text-parchment/50 text-sm hover:text-parchment"
        >
          Keluar
        </button>
      </div>

      {seedOnly && (
        <div className="bg-alert/10 border border-alert rounded-lg p-4 mb-5 text-sm">
          Supabase belum di-set di backend (<code>SUPABASE_URL</code> /{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>), jadi ini hanya menampilkan soal bawaan (read-only).
          Set dulu env itu untuk bisa menambah/mengedit/menghapus soal dari sini.
        </div>
      )}

      {!seedOnly && rows.length === 0 && !loading && (
        <div className="bg-panel border border-line rounded-lg p-4 mb-5 text-sm flex items-center justify-between">
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
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setActiveLevel(l)}
            className={`px-4 py-2 rounded-md font-display ${
              activeLevel === l ? "bg-shield text-void" : "bg-panel border border-line text-parchment/70"
            }`}
          >
            Level {l}
          </button>
        ))}
        {!seedOnly && (
          <button
            onClick={() => setEditing("new")}
            className="ml-auto bg-primary text-void font-display font-bold px-4 py-2 rounded-md"
          >
            + Tambah Soal
          </button>
        )}
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}
      {loading && <p className="text-parchment/50 text-sm">Memuat...</p>}

      {editing && (
        <div className="mb-5">
          <ChallengeForm
            initial={
              editing === "new" ? { ...emptyForm, level: activeLevel } : editing
            }
            onCancel={() => setEditing(null)}
            onSave={handleSave}
          />
        </div>
      )}

      <div className="space-y-3">
        {levelRows.map((row) => (
          <div key={row.id} className="bg-panel border border-line rounded-lg p-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="text-primary text-xs font-display uppercase tracking-wider">{row.npc}</p>
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
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {row.options.map((o, i) => (
                <div
                  key={i}
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

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || null);

  if (!token) return <LoginForm onLogin={setToken} />;
  return <AdminDashboard token={token} onLogout={() => setToken(null)} />;
}
