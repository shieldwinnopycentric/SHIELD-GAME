import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { socket } from "./lib/socket.js";
import Login from "./pages/Login.jsx";
import CharacterSelect from "./pages/CharacterSelect.jsx";
import Lobby from "./pages/Lobby.jsx";
import ResultsScreen from "./pages/ResultsScreen.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import Opening from "./pages/Opening.jsx";

const GameScreen = lazy(() => import("./pages/GameScreen.jsx"));

const SCREENS = {
  OPENING: "opening",
  LOGIN: "login",
  CHARACTER: "character",
  LOBBY: "lobby",
  GAME: "game",
  RESULTS: "results",
};

const STORAGE_KEY = "shield_app_state_v1";

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
  const [resuming, setResuming] = useState(
    () => restoreScreen(persisted) === SCREENS.GAME
  );

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

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ screen, player, roomCode, playerKey, leaderboard })
      );
    } catch {
      /* storage full / disabled */
    }
  }, [screen, player, roomCode, playerKey, leaderboard]);

  const goTo = useCallback((next) => setScreen(next), []);

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
