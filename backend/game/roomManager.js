import { nanoid } from "nanoid";
import { levelQuestionCount, levelLives, LIFE_BONUS, LEVEL_META } from "./challenges.js";

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
    wrongInLevel: 0, // jumlah salah pada level saat ini (statistik/tampilan)
    lives: levelLives(1), // sisa jatah salah di level ini; salah melebihi ini = gagal
    livesLost: 0, // total nyawa hilang sepanjang game (tie-breaker ranking)
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
 * Applies one answer to a player's state (mekanik NYAWA per-level):
 *   - Tiap level memberi "nyawa" = jatah salah yang ditoleransi
 *     (LEVEL_META.lives = 1/2/2). Jawaban salah memakai jatah itu; jawaban
 *     benar tidak.
 *   - SALAH MELEBIHI NYAWA (lives < 0): LANGSUNG gagal saat itu juga (tanpa
 *     menunggu sisa soal) -> masuk ruang bertema (failRoom) lalu MENGULANG
 *     level (failGoTo: L1->L1, L2->L2, L3->L3), nyawa diisi ulang penuh.
 *   - LOLOS: menjawab SEMUA soal level tanpa melebihi jatah salah -> naik
 *     level (nyawa direset ke jatah level baru) atau MENANG kalau ini Level 3.
 *   - Saat MENANG, sisa nyawa memberi bonus skor (LIFE_BONUS/nyawa). Satu-
 *     satunya cara selesai adalah MENANG di Level 3 atau waktu sesi habis.
 *
 * Returns { player, result, ... } where result is one of:
 *   "continue"    (masih ada soal tersisa di level & nyawa masih ada)
 *   "levelPassed" (level selesai & lolos; won=true kalau menang di Level 3)
 *   "levelFailed" (nyawa habis; sertakan failRoom/failedLevel/repeatLevel)
 */
export function applyAnswer(room, socketId, correct) {
  const p = room.players.get(socketId);
  if (!p || p.finished) return null;

  const answeredLevel = p.level; // level sebelum applyAnswer memutasinya

  if (correct) {
    p.correctCount += 1;
    p.score += 100;
  } else {
    p.wrongInLevel += 1;
    p.attempts += 1; // total jawaban salah sepanjang game (statistik)
    p.livesLost += 1; // total nyawa hilang (tie-breaker ranking)
    p.lives -= 1;
    p.score = Math.max(0, p.score - 25);
  }

  p.questionIndex += 1;

  // 1) SALAH MELEBIHI NYAWA -> gagal LANGSUNG (sisa soal di-skip). Nyawa =
  //    jatah salah (L1=1, L2/L3=2); tiap salah memakai 1 jatah, dan begitu
  //    jatah terlampaui (lives < 0) pemain masuk failRoom lalu ulang level
  //    (failGoTo), nyawa diisi ulang penuh sebagai checkpoint.
  if (p.lives < 0) {
    const meta = LEVEL_META[answeredLevel] || {};
    const wrongCount = p.wrongInLevel;
    const repeatLevel = meta.failGoTo ?? answeredLevel;
    p.level = repeatLevel;
    p.questionIndex = 0;
    p.wrongInLevel = 0;
    p.lives = levelLives(repeatLevel);
    return {
      player: p,
      result: "levelFailed",
      failRoom: meta.failRoom || null,
      failedLevel: answeredLevel,
      repeatLevel,
      wrongCount,
      maxWrong: meta.maxWrong ?? 0,
    };
  }

  // 2) Semua soal level terjawab tanpa kehabisan nyawa -> LOLOS.
  const levelDone = p.questionIndex >= levelQuestionCount(answeredLevel);
  if (levelDone) {
    p.levelsCleared += 1;
    if (answeredLevel >= 3) {
      p.won = true;
      p.score += p.lives * LIFE_BONUS; // bonus sisa nyawa saat menang
      finishPlayer(room, p);
      return { player: p, result: "levelPassed", won: true, clearedLevel: answeredLevel, livesRemaining: p.lives };
    }
    p.level += 1;
    p.questionIndex = 0;
    p.wrongInLevel = 0;
    p.lives = levelLives(p.level);
    return { player: p, result: "levelPassed", won: false, clearedLevel: answeredLevel };
  }

  // 3) Masih ada soal & nyawa tersisa.
  return { player: p, result: "continue" };
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
    lives: p.lives,
    livesLost: p.livesLost,
    won: !!p.won,
    score: p.score,
    disconnected: !!p.disconnected,
  }));

  // Ranking: skor tertinggi dulu; saat seri, pemain yang paling sedikit
  // kehilangan nyawa (livesLost) menang; lalu waktu tercepat.
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.livesLost !== b.livesLost) return a.livesLost - b.livesLost;
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