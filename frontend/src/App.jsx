import { useState, useCallback, useEffect } from "react";
import Login from "./pages/Login.jsx";
import CharacterSelect from "./pages/CharacterSelect.jsx";
import Lobby from "./pages/Lobby.jsx";
import GameScreen from "./pages/GameScreen.jsx";
import ResultsScreen from "./pages/ResultsScreen.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import Opening from "./pages/Opening.jsx";

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

// A live LOBBY/GAME session is held in server memory keyed by the socket id;
// a refresh gets a brand-new socket id, so those screens can't be resumed.
// We downgrade them to CHARACTER (keeping the player's name + avatar) rather
// than showing a broken live screen — everything else restores as-is.
function restoreScreen(saved) {
  if (!saved?.screen) return SCREENS.OPENING;
  if (saved.screen === SCREENS.LOBBY || saved.screen === SCREENS.GAME) {
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
  const [leaderboard, setLeaderboard] = useState(persisted?.leaderboard ?? []);
  const [initialGameState, setInitialGameState] = useState(null);

  // Mirror the restorable slice of state into sessionStorage on every change.
  // initialGameState is intentionally omitted: it only matters during a live
  // GAME session, which we don't resume across a refresh.
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ screen, player, roomCode, leaderboard })
      );
    } catch {
      /* storage full / disabled — persistence is best-effort */
    }
  }, [screen, player, roomCode, leaderboard]);

  const goTo = useCallback((next) => setScreen(next), []);

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
          onGameStart={(startPayload) => {
            setInitialGameState(startPayload);
            goTo(SCREENS.GAME);
          }}
          onBack={() => goTo(SCREENS.CHARACTER)}
        />
      )}

      {screen === SCREENS.GAME && (
        <GameScreen
          player={player}
          roomCode={roomCode}
          initialGameState={initialGameState}
          onGameOver={(board) => {
            setLeaderboard(board);
            goTo(SCREENS.RESULTS);
          }}
          onExit={() => {
            setRoomCode(null);
            setInitialGameState(null);
            goTo(SCREENS.OPENING);
          }}
        />
      )}

      {screen === SCREENS.RESULTS && (
        <ResultsScreen
          leaderboard={leaderboard}
          onPlayAgain={() => {
            setRoomCode(null);
            goTo(SCREENS.OPENING);
          }}
        />
      )}
    </div>
  );
}
