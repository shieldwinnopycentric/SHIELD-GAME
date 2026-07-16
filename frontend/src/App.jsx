import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { socket } from "./lib/socket.js";
import Login from "./pages/Login.jsx";
import CharacterSelect from "./pages/CharacterSelect.jsx";
import Lobby from "./pages/Lobby.jsx";
import ResultsScreen from "./pages/ResultsScreen.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import Opening from "./pages/Opening.jsx";

// Lazy: GameScreen pulls in Phaser (~1.5 MB minified). Loading it only when
// the match actually starts makes the opening/login/lobby screens load fast
// on phones — the engine chunk downloads in the background while players sit
// in the lobby.
const GameScreen = lazy(() => import("./pages/GameScreen.jsx"));

// Screen flow: Opening (splash) -> Login -> Pilih karakter -> Lobby ->
// Game (map + challenge) -> Hasil & leaderboard
const SCREENS = {
  OPENING: "opening",
  LOGIN: "login",
  CHARACTER: "character",
  LOBBY: "lobby",
  GAME: "game",
  RESULTS: "results",
};

// Per-tab persistence so a browser refresh keeps the player on the SAME
// screen (e.g. the results/leaderboard, which then re-fetches fresh data)
// instead of dumping them back to the Opening splash. sessionStorage is
// per-tab and survives refresh but not tab-close — which is exactly what we
// want for multi-tab multiplayer testing.
const STORAGE_KEY = "shield_app_state_v1";

// A live LOBBY session can't survive a refresh (lobby state is keyed to the
// socket id and there's no resume for it), so it downgrades to CHARACTER.
// A live GAME session CAN resume: the server holds the player's slot for a
// grace period and rebinds it via the saved playerKey — so GAME stays GAME
// and App attempts a resume_game handshake on mount (falling back to
// CHARACTER only if the server no longer knows us).
function restoreScreen(saved) {
  if (!saved?.screen) return SCREENS.OPENING;
  if (saved.screen === SCREENS.LOBBY) return SCREENS.CHARACTER;
  if (saved.screen === SCREENS.GAME && !(saved.roomCode && saved.playerKey)) {
    return SCREENS.CHARACTER;
  }
  return saved.screen;
}

function loadPersisted() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  // Simple path-based split: visiting /admin shows the content-management
  // dashboard instead of the game itself. No router library needed since
  // this is the only extra "route" in the app.
  const isAdminRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  const persisted = loadPersisted();
  const [screen, setScreen] = useState(() => restoreScreen(persisted));
  const [player, setPlayer] = useState(
    persisted?.player ?? { name: "", character: "nexus" }
  );
  const [roomCode, setRoomCode] = useState(persisted?.roomCode ?? null);
  const [playerKey, setPlayerKey] = useState(persisted?.playerKey ?? null);
  const [leaderboard, setLeaderboard] = useState(persisted?.leaderboard ?? []);
  const [initialGameState, setInitialGameState] = useState(null);
  // "resuming" saat App baru dimount di layar GAME hasil refresh — tahan
  // render GameScreen sampai handshake resume_game selesai.
  const [resuming, setResuming] = useState(
    () => restoreScreen(persisted) === SCREENS.GAME
  );

  // Refresh di tengah game: minta server merebind slot pemain lama ke socket
  // baru ini. Sukses -> masuk lagi ke GameScreen dengan state dari server;
  // gagal (grace habis / room bubar) -> turun ke pilih karakter.
  useEffect(() => {
    if (!resuming) return;
    if (!socket.connected) socket.connect();
    socket.emit("resume_game", { code: roomCode, playerKey }, (res) => {
      if (res?.ok) {
        setInitialGameState({
          roster: res.players,
          durationMs: res.me.durationMs,
          resume: res.me,
        });
      } else {
        setRoomCode(null);
        setPlayerKey(null);
        setScreen(SCREENS.CHARACTER);
      }
      setResuming(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the restorable slice of state into sessionStorage on every change.
  // initialGameState is intentionally omitted: it only matters during a live
  // GAME session, which we don't resume across a refresh.
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ screen, player, roomCode, playerKey, leaderboard })
      );
    } catch {
      /* storage full / disabled — persistence is best-effort */
    }
  }, [screen, player, roomCode, playerKey, leaderboard]);

  const goTo = useCallback((next) => setScreen(next), []);

  // Warm the lazy GameScreen/Phaser chunk while the player is still in the
  // lobby, so "semua siap → game start" doesn't stall on a 1.5 MB download.
  useEffect(() => {
    if (screen === SCREENS.LOBBY) import("./pages/GameScreen.jsx");
  }, [screen]);

  if (isAdminRoute) return <AdminPage />;

  return (
    <div className="min-h-[100svh] flex items-center justify-center p-3 sm:p-4">
      {screen === SCREENS.OPENING && <Opening onNext={() => goTo(SCREENS.LOGIN)} />}

      {screen === SCREENS.LOGIN && (
        <Login
          player={player}
          setPlayer={setPlayer}
          onNext={() => goTo(SCREENS.CHARACTER)}
          onBack={() => goTo(SCREENS.OPENING)}
        />
      )}

      {screen === SCREENS.CHARACTER && (
        <CharacterSelect
          player={player}
          setPlayer={setPlayer}
          onBack={() => goTo(SCREENS.LOGIN)}
          onNext={() => goTo(SCREENS.LOBBY)}
        />
      )}

      {screen === SCREENS.LOBBY && (
        <Lobby
          player={player}
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          setPlayerKey={setPlayerKey}
          onGameStart={(startPayload) => {
            setInitialGameState(startPayload);
            goTo(SCREENS.GAME);
          }}
          onBack={() => goTo(SCREENS.CHARACTER)}
        />
      )}

      {screen === SCREENS.GAME && resuming && (
        <p className="text-parchment/60 font-display animate-pulse">
          Menyambung ulang ke game…
        </p>
      )}

      {screen === SCREENS.GAME && !resuming && (
        <Suspense
          fallback={
            <p className="text-parchment/60 font-display animate-pulse">Memuat game…</p>
          }
        >
          <GameScreen
            player={player}
            roomCode={roomCode}
            playerKey={playerKey}
            initialGameState={initialGameState}
            onGameOver={(board) => {
              setLeaderboard(board);
              goTo(SCREENS.RESULTS);
            }}
            onExit={() => {
              setRoomCode(null);
              setPlayerKey(null);
              setInitialGameState(null);
              goTo(SCREENS.OPENING);
            }}
          />
        </Suspense>
      )}

      {screen === SCREENS.RESULTS && (
        <ResultsScreen
          leaderboard={leaderboard}
          onPlayAgain={() => {
            setRoomCode(null);
            setPlayerKey(null);
            goTo(SCREENS.OPENING);
          }}
        />
      )}
    </div>
  );
}
