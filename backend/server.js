import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

import {
  createRoom,
  addPlayer,
  removePlayer,
  getRoom,
  deleteRoom,
  listRooms,
  findRoomBySocket,
  rebindPlayer,
  resumeStateFor,
  setReady,
  allReady,
  startGame,
  timeLeftMs,
  updatePosition,
  applyAnswer,
  allFinished,
  buildLeaderboard,
  markDisconnectedAsFinished,
  serializeRoom,
} from "./game/roomManager.js";
import {
  getChallenge,
  levelQuestionCount,
  levelMaxWrong,
  levelLives,
  LEVEL_META,
  loadChallengesFromDB,
  adminListChallenges,
  adminCreateChallenge,
  adminUpdateChallenge,
  adminDeleteChallenge,
  adminSeedDefaults,
} from "./game/challenges.js";
import {
  loadRoomMaterialsFromDB,
  getPublicRoomMaterials,
  adminListRoomMaterials,
  adminUpdateRoomMaterial,
  adminResetRoomMaterial,
} from "./game/roomMaterials.js";
import { supabase } from "./lib/supabaseClient.js";

const PORT = process.env.PORT || 4000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

// Berapa lama slot pemain yang disconnect di tengah game ditahan sebelum
// dianggap keluar beneran — cukup buat refresh browser / wifi kedip.
const RESUME_GRACE_MS = 30 * 1000;
// playerKey -> timer DNF yang tertunda (dibatalkan kalau pemain resume).
const disconnectGrace = new Map();

// CLIENT_ORIGIN controls CORS/Socket.IO allowed origins:
//   - "*" or unset  -> reflect ANY origin (handy for LAN phone testing where
//                      the origin is http://<laptop-ip>:5173 and the IP can
//                      change with DHCP). Do NOT use "*" in production.
//   - comma list    -> explicit allowlist, e.g.
//                      "http://localhost:5173,https://your-app.vercel.app"
function resolveCorsOrigin(raw) {
  const v = (raw ?? "").trim();
  if (v === "" || v === "*") return true; // reflect request origin
  return v.split(",").map((s) => s.trim());
}
const CORS_ORIGIN = resolveCorsOrigin(process.env.CLIENT_ORIGIN);

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

function publicPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    character: p.character,
    ready: p.ready,
    x: p.x,
    y: p.y,
    level: p.level,
    questionIndex: p.questionIndex,
    wrongInLevel: p.wrongInLevel,
    lives: p.lives,
    livesLost: p.livesLost,
    correctCount: p.correctCount,
    score: p.score,
    finished: p.finished,
    won: !!p.won,
    disconnected: !!p.disconnected,
  }));
}

// ---------------------------------------------------------------------
// SPECTATOR MODE (admin): admin bisa memantau sebuah room secara live dari
// dashboard /admin TANPA menjadi pemain. Spectator TIDAK pernah masuk
// room.players — game logic (ready check, kuota 10 pemain, leaderboard)
// tidak terpengaruh sama sekali. Dia hanya join channel Socket.IO
// `spec:<kode>` yang menerima push spectate_state pada setiap perubahan
// state yang berarti (menumpang call site snapshotRoom di bawah).
function emitSpectate(room) {
  io.to(`spec:${room.code}`).emit("spectate_state", {
    status: room.status,
    players: publicPlayers(room),
    timeLeftMs: room.status === "running" ? timeLeftMs(room) : null,
    leaderboard: room.status === "finished" ? buildLeaderboard(room) : null,
  });
}

// ---------------------------------------------------------------------
// Supabase mirroring: the in-memory `rooms` map (in roomManager.js) is the
// only authoritative game state — this just mirrors a snapshot into
// Supabase after every meaningful state change, for backup/observability.
// Fire-and-forget: never blocks or fails the actual game flow.
async function snapshotRoom(room) {
  if (!room) return;
  // Tumpangan murah: setiap perubahan state yang layak di-snapshot juga
  // layak dilihat spectator admin — push versi publiknya ke channel spec.
  emitSpectate(room);
  if (!supabase) return;
  try {
    await supabase.from("room_snapshots").upsert(
      {
        room_code: room.code,
        status: room.status,
        snapshot: serializeRoom(room),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_code" }
    );
  } catch (err) {
    console.error("[SHIELD] Snapshot ke Supabase gagal:", err.message);
  }
}

async function persistResults(room) {
  if (!supabase) return;
  const rows = buildLeaderboard(room).map((r) => ({
    room_code: room.code,
    rank: r.rank,
    player_name: r.name,
    character: r.character,
    finish_time_ms: r.finishTimeMs,
    correct_count: r.correctCount,
    attempts_used: r.attempts,
    lives_remaining: r.lives,
    lives_lost: r.livesLost,
    total_score: r.score,
  }));
  try {
    // supabase-js does NOT throw on a failed insert — it returns { error }.
    // We must inspect it explicitly, otherwise failures vanish silently and
    // the global leaderboard stays empty with no clue why.
    const { error } = await supabase.from("game_results").insert(rows);
    if (!error) return;

    // Tabel di DB dibuat oleh schema versi lama (belum punya kolom nyawa).
    // Jangan buang seluruh hasil sesi hanya karena kolom statistik hilang —
    // coba ulang tanpa kolom itu supaya skor tetap masuk leaderboard, dan
    // beri instruksi perbaikan permanennya.
    if (/lives_(lost|remaining)/.test(error.message)) {
      console.error(
        "[SHIELD] Kolom nyawa belum ada di Supabase — jalankan ulang " +
          "backend/supabase/schema.sql di SQL Editor. Menyimpan hasil TANPA " +
          "kolom nyawa dulu supaya skor tidak hilang."
      );
      const slim = rows.map(({ lives_remaining, lives_lost, ...rest }) => rest);
      const { error: retryErr } = await supabase.from("game_results").insert(slim);
      if (retryErr) {
        console.error("[SHIELD] Insert game_results (fallback) gagal:", retryErr.message);
      }
      return;
    }

    console.error("[SHIELD] Insert game_results gagal:", error.message);
  } catch (err) {
    console.error("[SHIELD] Insert game_results error:", err.message);
  }
}

async function endGame(room) {
  // Guard against double-ending (e.g. the server timeout firing at the same
  // moment the last player finishes, or several clients reporting time-up).
  if (room.status === "finished") return;
  room.status = "finished";
  if (room.endTimer) {
    clearTimeout(room.endTimer);
    room.endTimer = null;
  }
  // Spectator admin diberi tahu SEKARANG — persistResults di bawah bisa
  // makan beberapa detik (network ke Supabase) dan tidak boleh menunda
  // tampilan live berubah ke "Selesai".
  emitSpectate(room);
  const leaderboard = buildLeaderboard(room);
  // Persist FIRST, then tell clients — otherwise the client renders the
  // global leaderboard and fetches from Supabase before this session's rows
  // are written, so a fresh/first session shows up empty.
  await persistResults(room);
  io.to(room.code).emit("game_over", { leaderboard });
  snapshotRoom(room);
  // Free the room after a grace period. Finished rooms otherwise pile up in
  // memory forever on a long-running server (each session with a class of
  // students leaks another room object).
  setTimeout(() => deleteRoom(room.code), 60 * 1000);
}

// ---------------------------------------------------------------------
// Admin endpoints — used by the /admin page in the frontend to manage
// educational content (soal per level) without touching code. Protected
// by a single shared token (ADMIN_TOKEN in .env); this is intentionally
// simple for a school-research prototype, not a full auth system.
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(501).json({
      error: "ADMIN_TOKEN belum diset di backend/.env — admin endpoints dimatikan.",
    });
  }
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Token admin salah." });
  }
  next();
}

app.post("/api/admin/verify", (req, res) => {
  if (!ADMIN_TOKEN) {
    return res.status(501).json({ ok: false, error: "ADMIN_TOKEN belum diset di backend/.env." });
  }
  res.json({ ok: req.body?.token === ADMIN_TOKEN });
});

app.get("/api/admin/challenges", requireAdmin, async (_req, res) => {
  try {
    const result = await adminListChallenges();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/challenges", requireAdmin, async (req, res) => {
  try {
    const row = await adminCreateChallenge(req.body);
    res.json({ ok: true, row });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/admin/challenges/:id", requireAdmin, async (req, res) => {
  try {
    const row = await adminUpdateChallenge(req.params.id, req.body);
    res.json({ ok: true, row });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/admin/challenges/:id", requireAdmin, async (req, res) => {
  try {
    await adminDeleteChallenge(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/admin/challenges/seed", requireAdmin, async (_req, res) => {
  try {
    await adminSeedDefaults();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Materi ruang kegagalan (Ruang Bimbingan / Rumah Sakit / Penjara).
// Endpoint publik dibaca GuidanceRoom di frontend saat pemain gagal level;
// endpoint admin dipakai tab "Materi Ruang" di /admin.
app.get("/api/room-materials", (_req, res) => {
  res.json({ rooms: getPublicRoomMaterials() });
});

app.get("/api/admin/room-materials", requireAdmin, async (_req, res) => {
  try {
    const result = await adminListRoomMaterials();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/room-materials/:roomKey", requireAdmin, async (req, res) => {
  try {
    const room = await adminUpdateRoomMaterial(req.params.roomKey, req.body);
    res.json({ ok: true, room });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/admin/room-materials/:roomKey", requireAdmin, async (req, res) => {
  try {
    const room = await adminResetRoomMaterial(req.params.roomKey);
    res.json({ ok: true, room });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Daftar room yang sedang hidup di memori — dipakai tab "Pantau Room" di
// /admin supaya admin tinggal klik room-nya, tidak harus mengetik kode.
app.get("/api/admin/rooms", requireAdmin, (_req, res) => {
  res.json({
    rooms: listRooms().map((room) => ({
      code: room.code,
      status: room.status,
      playerCount: room.players.size,
      timeLeftMs: room.status === "running" ? timeLeftMs(room) : null,
    })),
  });
});

io.on("connection", (socket) => {
  // ---- SPECTATOR (admin) ----------------------------------------------
  // Admin memantau room dari dashboard tanpa menjadi pemain. Diproteksi
  // ADMIN_TOKEN yang sama dengan REST endpoint admin. Spectator join dua
  // channel: `spec:<kode>` (push spectate_state lengkap tiap perubahan
  // state) dan `<kode>` (ikut menerima broadcast publik seperti
  // player_moved supaya pergerakan avatar terlihat live di peta). Dia
  // TIDAK pernah dimasukkan ke room.players, jadi tidak menghitung kuota
  // pemain, tidak ikut ready-check, dan tidak muncul di leaderboard.
  socket.on("spectate_room", ({ code, adminToken }, cb) => {
    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
      return cb?.({ ok: false, error: "UNAUTHORIZED" });
    }
    const room = getRoom(String(code || "").trim().toUpperCase());
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });

    socket.join(room.code);
    socket.join(`spec:${room.code}`);
    socket.data.spectating = room.code;
    cb?.({
      ok: true,
      code: room.code,
      status: room.status,
      players: publicPlayers(room),
      timeLeftMs: room.status === "running" ? timeLeftMs(room) : null,
    });
  });

  socket.on("spectate_stop", () => {
    const code = socket.data.spectating;
    if (!code) return;
    socket.leave(code);
    socket.leave(`spec:${code}`);
    socket.data.spectating = null;
  });

  socket.on("create_room", ({ name, character }, cb) => {
    const room = createRoom(socket.id, { name, character });
    socket.join(room.code);
    // playerKey = rahasia per-pemain untuk resume setelah refresh (disimpan
    // klien di sessionStorage, tidak pernah disiarkan ke pemain lain).
    cb?.({
      ok: true,
      code: room.code,
      players: publicPlayers(room),
      playerKey: room.players.get(socket.id)?.key,
    });
    io.to(room.code).emit("lobby_update", { players: publicPlayers(room) });
    snapshotRoom(room);
  });

  socket.on("join_room", ({ code, name, character }, cb) => {
    const result = addPlayer(code, socket.id, { name, character });
    if (result.error) return cb?.({ ok: false, error: result.error });
    socket.join(code);
    cb?.({
      ok: true,
      code,
      players: publicPlayers(result.room),
      playerKey: result.room.players.get(socket.id)?.key,
    });
    io.to(code).emit("lobby_update", { players: publicPlayers(result.room) });
    snapshotRoom(result.room);
  });

  // RESUME setelah refresh: klien menyimpan { code, playerKey } di
  // sessionStorage; socket baru hasil refresh dipetakan kembali ke state
  // pemain lama yang masih hidup di memori server (grace period di handler
  // disconnect di bawah menahan slotnya agar tidak langsung di-DNF-kan).
  socket.on("resume_game", ({ code, playerKey }, cb) => {
    const room = getRoom(code);
    if (!room || room.status !== "running") {
      return cb?.({ ok: false, error: "ROOM_GONE" });
    }
    const rebound = rebindPlayer(room, playerKey, socket.id);
    if (!rebound) return cb?.({ ok: false, error: "PLAYER_NOT_FOUND" });

    // Batalkan timer grace period yang menunggu pemain ini kembali.
    const timer = disconnectGrace.get(playerKey);
    if (timer) {
      clearTimeout(timer);
      disconnectGrace.delete(playerKey);
    }

    socket.join(code);
    cb?.({
      ok: true,
      code,
      me: resumeStateFor(room, rebound.player),
      players: publicPlayers(room),
    });
    // Beritahu klien lain: sprite lama (id socket lama) diganti id baru.
    socket.to(code).emit("player_rebound", {
      oldId: rebound.oldId,
      id: socket.id,
      name: rebound.player.name,
      character: rebound.player.character,
      x: rebound.player.x,
      y: rebound.player.y,
    });
    snapshotRoom(room);
  });

  socket.on("set_ready", ({ code, ready }) => {
    const room = setReady(code, socket.id, ready);
    if (!room) return;
    io.to(code).emit("lobby_update", { players: publicPlayers(room) });

    if (allReady(room) && room.players.size >= 1 && room.status === "lobby") {
      startGame(room);
      // Authoritative game-over timer. Previously the game only ended when a
      // CLIENT noticed time was up and told us — but phones aggressively
      // throttle JS timers in backgrounded tabs, so a room full of phones
      // could hang past the time limit forever.
      room.endTimer = setTimeout(() => endGame(room), timeLeftMs(room) + 1000);
      io.to(code).emit("game_start", {
        players: publicPlayers(room),
        durationMs: timeLeftMs(room),
      });
    }
    snapshotRoom(room);
  });

  socket.on("leave_room", ({ code }) => {
    const room = getRoom(code);
    if (!room) return;
    // Only meaningful while still in the lobby — a player backing out before
    // the game starts. Frees their slot and updates everyone else's roster.
    if (room.status === "lobby") {
      const updated = removePlayer(code, socket.id);
      socket.leave(code);
      if (updated) {
        io.to(code).emit("lobby_update", { players: publicPlayers(updated) });
        snapshotRoom(updated);
      }
    }
  });

  socket.on("player_move", ({ code, x, y }) => {
    // Sanitize: non-finite or off-map coordinates (buggy client, or someone
    // poking devtools) would otherwise be broadcast verbatim and break every
    // OTHER player's rendering too.
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const cx = Math.min(1600, Math.max(0, x));
    const cy = Math.min(1200, Math.max(0, y));
    const room = updatePosition(code, socket.id, cx, cy);
    if (!room || room.status !== "running") return;
    socket.to(code).emit("player_moved", { id: socket.id, x: cx, y: cy });
    // Deliberately NOT snapshotted here — position updates fire many
    // times per second and would flood Supabase for no real benefit.
  });

  socket.on("request_challenge", ({ code }, cb) => {
    const room = getRoom(code);
    const player = room?.players.get(socket.id);
    if (!room || !player || player.finished || room.status !== "running") {
      return cb?.({ ok: false });
    }
    const challenge = getChallenge(player.level, player.questionIndex);
    if (!challenge) return cb?.({ ok: false });

    const meta = LEVEL_META[player.level];
    // Never send the `correct` flag to the client.
    const safeChallenge = {
      id: challenge.id,
      npc: challenge.npc,
      prompt: challenge.prompt,
      level: player.level,
      levelName: meta?.name,
      opponents: meta?.opponents,
      questionNumber: player.questionIndex + 1,
      totalQuestions: levelQuestionCount(player.level),
      wrongInLevel: player.wrongInLevel,
      maxWrong: levelMaxWrong(player.level),
      lives: player.lives,
      maxLives: levelLives(player.level),
      options: challenge.options.map((o, idx) => ({ idx, text: o.text })),
    };
    cb?.({ ok: true, challenge: safeChallenge });
  });

  socket.on("submit_answer", ({ code, challengeId, optionIdx }, cb) => {
    const room = getRoom(code);
    const player = room?.players.get(socket.id);
    if (!room || !player) return cb?.({ ok: false });

    const answeredLevel = player.level; // level BEFORE applyAnswer mutates it
    const challenge = getChallenge(answeredLevel, player.questionIndex);
    if (!challenge || challenge.id !== challengeId) {
      return cb?.({ ok: false, error: "STALE_CHALLENGE" });
    }

    const correct = !!challenge.options[optionIdx]?.correct;
    // applyAnswer returns null for a finished player (e.g. a duplicate
    // submit racing the first) — destructuring null would throw and kill
    // the socket handler, so bail out cleanly instead.
    const applied = applyAnswer(room, socket.id, correct);
    if (!applied) return cb?.({ ok: false });
    const {
      player: updated,
      result,
      won,
      clearedLevel,
      failRoom,
      failedLevel,
      repeatLevel,
      wrongCount,
      livesRemaining,
    } = applied;

    cb?.({
      ok: true,
      correct,
      feedback: challenge.feedback,
      result, // "continue" | "levelPassed" | "levelFailed"
      won: !!won,
      clearedLevel: clearedLevel ?? null, // level yang BARU SAJA dilewati (untuk popup)
      failRoom: failRoom || null,
      failedLevel: failedLevel ?? null,
      repeatLevel: repeatLevel ?? null,
      wrongCount: wrongCount ?? updated.wrongInLevel,
      level: updated.level,
      questionIndex: updated.questionIndex,
      totalQuestions: levelQuestionCount(updated.level),
      wrongInLevel: updated.wrongInLevel,
      maxWrong: levelMaxWrong(updated.level),
      lives: updated.lives,
      maxLives: levelLives(updated.level),
      livesRemaining: livesRemaining ?? updated.lives,
      character: updated.character,
      score: updated.score,
      finished: updated.finished,
    });

    io.to(code).emit("player_progress", {
      id: socket.id,
      level: updated.level,
      score: updated.score,
      finished: updated.finished,
    });

    snapshotRoom(room);
    if (updated.finished && allFinished(room)) endGame(room);
  });

  socket.on("leave_or_time_up_check", ({ code }) => {
    const room = getRoom(code);
    if (!room || room.status !== "running") return;
    if (timeLeftMs(room) <= 0) endGame(room);
  });

  socket.on("disconnect", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    if (room.status === "lobby") {
      const updated = removePlayer(room.code, socket.id);
      if (updated) {
        io.to(room.code).emit("lobby_update", { players: publicPlayers(updated) });
        snapshotRoom(updated);
      }
    } else if (room.status === "running") {
      // GRACE PERIOD: refresh browser = disconnect + connect baru beberapa
      // detik kemudian. Jangan langsung DNF-kan pemainnya — tunggu dulu;
      // kalau resume_game datang membawa playerKey yang cocok, timer ini
      // dibatalkan dan pemain lanjut main. Baru kalau tidak kembali dalam
      // RESUME_GRACE_MS dia dianggap benar-benar keluar.
      const p = room.players.get(socket.id);
      if (!p || p.finished) return;
      const key = p.key;
      const code = room.code;
      const staleId = socket.id;
      const timer = setTimeout(() => {
        disconnectGrace.delete(key);
        const r = getRoom(code);
        // Hanya DNF-kan kalau slotnya masih terikat ke socket lama (belum
        // di-rebind oleh resume) dan game masih berjalan.
        if (!r || r.status !== "running" || !r.players.has(staleId)) return;
        markDisconnectedAsFinished(r, staleId);
        io.to(code).emit("player_progress", { id: staleId, finished: true, disconnected: true });
        snapshotRoom(r);
        if (allFinished(r)) endGame(r);
      }, RESUME_GRACE_MS);
      disconnectGrace.set(key, timer);
    }
  });
});

Promise.allSettled([loadChallengesFromDB(), loadRoomMaterialsFromDB()]).finally(() => {
  server.listen(PORT, () => {
    console.log(`SHIELD backend listening on :${PORT}`);
  });
});