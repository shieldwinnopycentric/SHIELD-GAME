import { nanoid } from "nanoid";
import { levelQuestionCount, levelMaxWrong, LEVEL_META } from "./challenges.js";

const MAX_PLAYERS = 10; // sesuai KONSEP_GAME_SHIELD.pdf: akses 10 pemain real-time
const GAME_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const CHARACTERS = ["nexus", "cypher", "helix"];

/** In-memory room store. Authoritative source of truth for gameplay —
 * Supabase only receives periodic snapshots (see server.js) for
 * backup/observability, it is never read back into this store. */
const rooms = new Map();

function makeRoomCode() {
  return nanoid(5).toUpperCase();
}

// Spread up to 10 players around the spawn point in a loose ring so they
// don't stack on the exact same pixel when the game starts.
function spawnOffsetFor(index) {
  if (index === 0) return { x: 0, y: 0 };
  const angle = ((index - 1) / (MAX_PLAYERS - 1)) * Math.PI * 2;
  const radius = 70;
  return { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
}

export function createRoom(hostSocketId, hostPlayer) {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();

  const room = {
    code,
    hostId: hostSocketId,
    status: "lobby", // lobby | running | finished
    startedAt: null,
    players: new Map(), // socketId -> playerState
  };
  rooms.set(code, room);
  addPlayer(code, hostSocketId, hostPlayer);
  return room;
}

function normalizeCharacter(character) {
  return CHARACTERS.includes(character) ? character : "nexus";
}

export function addPlayer(code, socketId, player) {
  const room = rooms.get(code);
  if (!room) return { error: "ROOM_NOT_FOUND" };
  if (room.status !== "lobby") return { error: "GAME_ALREADY_STARTED" };
  if (room.players.size >= MAX_PLAYERS) return { error: "ROOM_FULL" };

  const offset = spawnOffsetFor(room.players.size);

  room.players.set(socketId, {
    id: socketId,
    name: player.name?.slice(0, 20) || "Pemain",
    character: normalizeCharacter(player.character),
    ready: false,
    x: 400 + offset.x,
    y: 300 + offset.y,
    level: 1,
    questionIndex: 0, // posisi soal dalam level saat ini (0..questions-1)
    wrongInLevel: 0, // jumlah salah pada level saat ini (menentukan lolos/gagal di akhir level)
    correctCount: 0, // total benar sepanjang game (untuk leaderboard)
    attempts: 0, // total jawaban salah sepanjang game (statistik leaderboard)
    levelsCleared: 0, // berapa kali berhasil lolos sebuah level (statistik/ranking)
    finished: false,
    finishTimeMs: null,
    won: false,
    score: 0,
  });
  return { room };
}

export function removePlayer(code, socketId) {
  const room = rooms.get(code);
  if (!room) return null;
  room.players.delete(socketId);
  if (room.players.size === 0) rooms.delete(code);
  return room;
}

export function getRoom(code) {
  return rooms.get(code) || null;
}

export function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
}

export function setReady(code, socketId, ready) {
  const room = rooms.get(code);
  if (!room) return null;
  const p = room.players.get(socketId);
  if (!p) return null;
  p.ready = ready;
  return room;
}

export function allReady(room) {
  if (room.players.size === 0) return false;
  return [...room.players.values()].every((p) => p.ready);
}

export function startGame(room) {
  room.status = "running";
  room.startedAt = Date.now();
  return room;
}

export function timeLeftMs(room) {
  if (!room.startedAt) return GAME_DURATION_MS;
  const elapsed = Date.now() - room.startedAt;
  return Math.max(0, GAME_DURATION_MS - elapsed);
}

export function updatePosition(code, socketId, x, y) {
  const room = rooms.get(code);
  if (!room) return null;
  const p = room.players.get(socketId);
  if (!p) return null;
  p.x = x;
  p.y = y;
  return room;
}

/**
 * Applies one answer to a player's state (mekanik ambang salah per-level):
 *   - Tiap level menyediakan sejumlah soal (LEVEL_META.questions = 3/6/10).
 *     Pemain menjawab SEMUA soal level itu; lolos/gagal dievaluasi di AKHIR
 *     level berdasarkan total salah (wrongInLevel) vs LEVEL_META.maxWrong.
 *   - LOLOS (wrongInLevel <= maxWrong): naik ke level berikutnya (atau MENANG
 *     kalau ini Level 3). Pemain lalu mendekati marker NPC level berikutnya.
 *   - GAGAL (wrongInLevel > maxWrong): masuk ruang bertema (failRoom) lalu
 *     MENGULANG level sesuai LEVEL_META.failGoTo (L1->L1, L2->L2, L3->L2).
 *     Tidak ada lagi "nyawa habis / game over" — satu-satunya cara selesai
 *     adalah MENANG di Level 3 atau waktu sesi habis.
 *
 * Returns { player, result, ... } where result is one of:
 *   "continue"    (masih ada soal tersisa di level yang sama)
 *   "levelPassed" (level selesai & lolos; won=true kalau menang di Level 3)
 *   "levelFailed" (level selesai tapi gagal; sertakan failRoom/failedLevel/repeatLevel)
 */
export function applyAnswer(room, socketId, correct) {
  const p = room.players.get(socketId);
  if (!p || p.finished) return null;

  if (correct) {
    p.correctCount += 1;
    p.score += 100;
  } else {
    p.wrongInLevel += 1;
    p.attempts += 1; // total jawaban salah sepanjang game (statistik)
    p.score = Math.max(0, p.score - 25);
  }

  p.questionIndex += 1;

  const levelDone = p.questionIndex >= levelQuestionCount(p.level);
  if (!levelDone) {
    return { player: p, result: "continue" };
  }

  // Level selesai — evaluasi lolos/gagal berdasar total salah di level ini.
  const failedLevel = p.level;
  const passed = p.wrongInLevel <= levelMaxWrong(failedLevel);

  if (passed) {
    p.levelsCleared += 1;
    if (failedLevel >= 3) {
      p.won = true;
      finishPlayer(room, p);
      return { player: p, result: "levelPassed", won: true, clearedLevel: failedLevel };
    }
    p.level += 1;
    p.questionIndex = 0;
    p.wrongInLevel = 0;
    return { player: p, result: "levelPassed", won: false, clearedLevel: failedLevel };
  }

  // Gagal: masuk failRoom lalu ulang level (failGoTo).
  const meta = LEVEL_META[failedLevel] || {};
  const wrongCount = p.wrongInLevel;
  const repeatLevel = meta.failGoTo ?? failedLevel;
  p.level = repeatLevel;
  p.questionIndex = 0;
  p.wrongInLevel = 0;
  return {
    player: p,
    result: "levelFailed",
    failRoom: meta.failRoom || null,
    failedLevel,
    repeatLevel,
    wrongCount,
    maxWrong: meta.maxWrong ?? 0,
  };
}

export function finishPlayer(room, player) {
  player.finished = true;
  player.finishTimeMs = Date.now() - room.startedAt;
}

export function markDisconnectedAsFinished(room, socketId) {
  const p = room.players.get(socketId);
  if (!p || p.finished) return;
  p.finished = true;
  p.finishTimeMs = room.startedAt ? Date.now() - room.startedAt : null;
  p.disconnected = true;
}

export function allFinished(room) {
  if (room.players.size === 0) return false;
  return [...room.players.values()].every((p) => p.finished);
}

export function buildLeaderboard(room) {
  const list = [...room.players.values()].map((p) => ({
    name: p.name,
    character: p.character,
    finishTimeMs: p.finishTimeMs,
    correctCount: p.correctCount,
    attempts: p.attempts,
    level: p.level,
    levelsCleared: p.levelsCleared,
    won: !!p.won,
    score: p.score,
    disconnected: !!p.disconnected,
  }));

  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = a.finishTimeMs ?? Infinity;
    const bt = b.finishTimeMs ?? Infinity;
    return at - bt;
  });

  return list.map((row, i) => ({ rank: i + 1, ...row }));
}

/** Plain-JSON snapshot of a room's full state, used by server.js to mirror
 * live game state into Supabase for backup/observability. Not read back
 * into memory anywhere — the in-memory `rooms` map stays authoritative. */
export function serializeRoom(room) {
  return {
    code: room.code,
    status: room.status,
    startedAt: room.startedAt,
    players: [...room.players.values()],
  };
}

export const config = { MAX_PLAYERS, GAME_DURATION_MS, CHARACTERS };