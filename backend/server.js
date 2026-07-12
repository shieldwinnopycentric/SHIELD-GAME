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
  findRoomBySocket,
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
import { supabase } from "./lib/supabaseClient.js";

const PORT = process.env.PORT || 4000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

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
  }));
}

// ---------------------------------------------------------------------
// Supabase mirroring: the in-memory `rooms` map (in roomManager.js) is the
// only authoritative game state — this just mirrors a snapshot into
// Supabase after every meaningful state change, for backup/observability.
// Fire-and-forget: never blocks or fails the actual game flow.
async function snapshotRoom(room) {
  if (!supabase || !room) return;
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
    if (error) {
      console.error("[SHIELD] Insert game_results gagal:", error.message);
    }
  } catch (err) {
    console.error("[SHIELD] Insert game_results error:", err.message);
  }
}

async function endGame(room) {
  room.status = "finished";
  const leaderboard = buildLeaderboard(room);
  // Persist FIRST, then tell clients — otherwise the client renders the
  // global leaderboard and fetches from Supabase before this session's rows
  // are written, so a fresh/first session shows up empty.
  await persistResults(room);
  io.to(room.code).emit("game_over", { leaderboard });
  snapshotRoom(room);
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

io.on("connection", (socket) => {
  socket.on("create_room", ({ name, character }, cb) => {
    const room = createRoom(socket.id, { name, character });
    socket.join(room.code);
    cb?.({ ok: true, code: room.code, players: publicPlayers(room) });
    io.to(room.code).emit("lobby_update", { players: publicPlayers(room) });
    snapshotRoom(room);
  });

  socket.on("join_room", ({ code, name, character }, cb) => {
    const result = addPlayer(code, socket.id, { name, character });
    if (result.error) return cb?.({ ok: false, error: result.error });
    socket.join(code);
    cb?.({ ok: true, code, players: publicPlayers(result.room) });
    io.to(code).emit("lobby_update", { players: publicPlayers(result.room) });
    snapshotRoom(result.room);
  });

  socket.on("set_ready", ({ code, ready }) => {
    const room = setReady(code, socket.id, ready);
    if (!room) return;
    io.to(code).emit("lobby_update", { players: publicPlayers(room) });

    if (allReady(room) && room.players.size >= 1 && room.status === "lobby") {
      startGame(room);
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
    const room = updatePosition(code, socket.id, x, y);
    if (!room) return;
    socket.to(code).emit("player_moved", { id: socket.id, x, y });
    // Deliberately NOT snapshotted here — position updates fire many
    // times per second and would flood Supabase for no real benefit.
  });

  socket.on("request_challenge", ({ code }, cb) => {
    const room = getRoom(code);
    const player = room?.players.get(socket.id);
    if (!room || !player) return cb?.({ ok: false });
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
    } = applyAnswer(room, socket.id, correct);

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
      markDisconnectedAsFinished(room, socket.id);
      io.to(room.code).emit("player_progress", { id: socket.id, finished: true, disconnected: true });
      snapshotRoom(room);
      if (allFinished(room)) endGame(room);
    }
  });
});

loadChallengesFromDB().finally(() => {
  server.listen(PORT, () => {
    console.log(`SHIELD backend listening on :${PORT}`);
  });
});