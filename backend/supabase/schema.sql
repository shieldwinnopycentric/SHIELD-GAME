-- SHIELD: Supabase schema
-- Run this in the Supabase SQL editor.

create table if not exists game_results (
  id bigint generated always as identity primary key,
  room_code text not null,
  rank int not null,
  player_name text not null,
  character text not null check (character in ('nexus', 'cypher', 'helix')),
  finish_time_ms bigint,
  correct_count int not null default 0,
  attempts_used int not null default 0, -- berapa kali level diulang (gagal) sepanjang game
  lives_remaining int not null default 0, -- sisa nyawa saat game selesai (indikator ranking)
  lives_lost int not null default 0, -- total nyawa hilang sepanjang game (tie-breaker ranking)
  total_score int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_game_results_room on game_results (room_code);
create index if not exists idx_game_results_score on game_results (total_score desc);

-- Kolom nyawa ditambahkan setelah rilis awal. `create table if not exists`
-- tidak menyentuh tabel yang sudah ada, jadi tambahkan lewat ALTER idempoten
-- supaya schema.sql memperbaiki dirinya sendiri saat dijalankan ulang di DB
-- yang tabelnya dibuat oleh versi lama (tanpa kolom nyawa).
alter table game_results add column if not exists lives_remaining int not null default 0;
alter table game_results add column if not exists lives_lost int not null default 0;

-- `create table if not exists` tidak menyentuh tabel yang sudah ada, jadi
-- kalau tabel dibuat oleh schema versi lama (mis. nilai character berbeda
-- sebelum revisi ke Nexus/Cypher/Helix), constraint lamanya tetap menempel
-- dan menolak insert. Drop + re-add di sini supaya schema.sql memperbaiki
-- dirinya sendiri saat dijalankan ulang.
alter table game_results drop constraint if exists game_results_character_check;
alter table game_results add constraint game_results_character_check
  check (character in ('nexus', 'cypher', 'helix'));

-- Global leaderboard (top scores across all rooms/sessions)
create or replace view global_leaderboard as
select
  player_name,
  character,
  max(total_score) as best_score,
  min(finish_time_ms) as best_time_ms,
  max(lives_remaining) as best_lives,
  min(lives_lost) as fewest_lives_lost,
  count(*) as sessions_played
from game_results
group by player_name, character
order by best_score desc, best_time_ms asc;

alter table game_results enable row level security;

-- Allow anyone to read leaderboard results (adjust for production auth needs).
-- Postgres tidak punya "create policy if not exists", jadi drop dulu supaya
-- schema.sql aman dijalankan ulang tanpa error "policy already exists".
drop policy if exists "public read leaderboard" on game_results;
create policy "public read leaderboard" on game_results
  for select using (true);

-- Only the backend (service role key) can insert results.

-- ---------------------------------------------------------------------
-- Admin-managed educational content (soal/challenge per level).
-- Read/written exclusively by the backend via the service role key
-- (bypasses RLS), through the /api/admin/challenges endpoints + the
-- /admin page. Leave this table empty to keep using the built-in seed
-- questions in backend/game/challenges.js, or click "Isi Soal Default"
-- in /admin to copy the seed set in here as a starting point.
create table if not exists challenges (
  id bigint generated always as identity primary key,
  level int not null check (level in (1, 2, 3)),
  npc text not null,
  prompt text not null,
  options jsonb not null, -- [{ "text": "...", "correct": true|false }, ...]
  feedback text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_challenges_level_order on challenges (level, order_index);

alter table challenges enable row level security;
-- No public policies: only the service role key (used by the backend) can
-- read/write this table, so correct answers are never exposed to the browser.

-- ---------------------------------------------------------------------
-- Live room-state mirror. The backend keeps rooms authoritative in memory
-- (see backend/game/roomManager.js) — this table is a periodic snapshot
-- written after every meaningful event (join, ready, answer, disconnect,
-- game over) purely for backup/observability if the server restarts or
-- you want to inspect an in-progress session. It is NOT read back into the
-- running game.
create table if not exists room_snapshots (
  room_code text primary key,
  status text not null,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table room_snapshots enable row level security;
-- No public policies: service role key (backend) only.
