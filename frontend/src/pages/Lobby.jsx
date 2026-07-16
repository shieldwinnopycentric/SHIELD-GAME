import { useEffect, useState } from "react";
import { socket } from "../lib/socket.js";
import BackButton from "../components/BackButton.jsx";
import PageBackground from "../components/PageBackground.jsx";

const CHAR_LABELS = { nexus: "Nexus", cypher: "Cypher", helix: "Helix" };

export default function Lobby({ player, roomCode, setRoomCode, setPlayerKey, onGameStart, onBack }) {
  const [joinCode, setJoinCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(roomCode ? "in-room" : "choose"); // choose | in-room

  useEffect(() => {
    if (!socket.connected) socket.connect();

    function onLobbyUpdate({ players: p }) {
      setPlayers(p);
    }
    function onGameStartEvt({ players: roster, durationMs }) {
      // Forward the server's starting roster (positions + character per
      // player) so GameScreen/Phaser can place everyone correctly instead
      // of spawning everyone at the same default coordinate.
      onGameStart({ roster, durationMs });
    }

    socket.on("lobby_update", onLobbyUpdate);
    socket.on("game_start", onGameStartEvt);

    return () => {
      socket.off("lobby_update", onLobbyUpdate);
      socket.off("game_start", onGameStartEvt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createRoom() {
    socket.emit("create_room", player, (res) => {
      if (!res.ok) return setError("Gagal membuat room.");
      setRoomCode(res.code);
      setPlayerKey?.(res.playerKey); // kunci resume-setelah-refresh
      setPlayers(res.players);
      setMode("in-room");
    });
  }

  function joinRoom() {
    if (!joinCode.trim()) return setError("Masukkan kode room.");
    socket.emit("join_room", { code: joinCode.trim().toUpperCase(), ...player }, (res) => {
      if (!res.ok) return setError(errorMessage(res.error));
      setRoomCode(res.code);
      setPlayerKey?.(res.playerKey); // kunci resume-setelah-refresh
      setPlayers(res.players);
      setMode("in-room");
      setError("");
    });
  }

  function toggleReady() {
    const next = !ready;
    setReady(next);
    socket.emit("set_ready", { code: roomCode, ready: next });
  }

  // Leave the current room and return to the create/join chooser (still
  // connected, so the player can immediately make or join another room).
  function leaveRoom() {
    if (roomCode) socket.emit("leave_room", { code: roomCode });
    setRoomCode(null);
    setPlayers([]);
    setReady(false);
    setError("");
    setMode("choose");
  }

  // Top-left back: from inside a room -> leave it; from the chooser -> go back
  // to avatar selection.
  function handleBack() {
    if (mode === "in-room") leaveRoom();
    else onBack?.();
  }

  if (mode === "choose") {
    return (
      <div className="w-full max-w-md">
        <PageBackground src="/assets/bg-lobby.jpg" />
        <BackButton onClick={handleBack} label="Kembali" />

        <p className="font-pixel text-primary text-[10px] tracking-[0.2em] uppercase mb-3 text-center">
          Langkah 3 / 4
        </p>
        <h2 className="font-display text-4xl font-bold mb-6 text-center">Lobby</h2>

        <div className="bg-panel border-2 border-line rounded-lg p-6 mb-4 pixel-card">
          <p className="text-parchment/70 text-sm mb-3">Buat room baru dan undang teman (maks. 10 pemain):</p>
          <button
            type="button"
            onClick={createRoom}
            className="w-full bg-primary text-void font-display text-lg font-bold py-3 rounded-md pixel-btn"
          >
            Buat Room
          </button>
        </div>

        <div className="bg-panel border-2 border-line rounded-lg p-6 pixel-card">
          <p className="text-parchment/70 text-sm mb-3">Atau gabung dengan kode room:</p>
          <div className="flex gap-2 items-stretch">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Kode room"
              maxLength={5}
              className="flex-1 min-w-0 bg-void border-2 border-line rounded-md px-4 py-3 uppercase tracking-widest text-center focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={joinRoom}
              className="shrink-0 whitespace-nowrap bg-gold text-void font-display font-bold px-5 py-3 rounded-md pixel-btn"
            >
              Gabung
            </button>
          </div>
        </div>

        {error && <p className="text-danger text-sm mt-3 text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <PageBackground src="/assets/bg-waiting.jpg" />
      <BackButton onClick={handleBack} label="Keluar Room" />

      <p className="font-pixel text-primary text-[10px] tracking-[0.2em] uppercase mb-3 text-center">
        Langkah 4 / 4 · Ruang Tunggu
      </p>
      <h2 className="font-display text-4xl font-bold mb-1 text-center">Kode Room</h2>
      <p className="text-center font-pixel text-2xl sm:text-3xl tracking-[0.25em] text-gold mb-6 drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">
        {roomCode}
      </p>

      <div className="bg-panel border-2 border-line rounded-lg p-5 mb-6 pixel-card">
        <p className="text-parchment/50 text-xs uppercase tracking-wider mb-3">
          Pemain ({players.length}/10)
        </p>
        <div className="space-y-2">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-void/50 rounded-md px-4 py-2"
            >
              <span>
                {p.name}{" "}
                <span className="text-parchment/40 text-xs">
                  ({CHAR_LABELS[p.character] || p.character})
                </span>
              </span>
              <span
                className={`text-xs font-display uppercase tracking-wider ${
                  p.ready ? "text-success" : "text-parchment/40"
                }`}
              >
                {p.ready ? "Siap" : "Menunggu"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={toggleReady}
        className={`w-full font-display text-lg font-bold py-3 rounded-md pixel-btn ${
          ready ? "bg-line text-parchment/70" : "bg-success text-void"
        }`}
      >
        {ready ? "Batal Siap" : "Saya Siap"}
      </button>
      <p className="text-center text-parchment/40 text-xs mt-4">
        Game dimulai otomatis ketika semua pemain menekan "Siap".
      </p>
    </div>
  );
}

function errorMessage(code) {
  switch (code) {
    case "ROOM_NOT_FOUND":
      return "Room tidak ditemukan.";
    case "ROOM_FULL":
      return "Room sudah penuh (maks. 10 pemain).";
    case "GAME_ALREADY_STARTED":
      return "Game di room ini sudah dimulai.";
    default:
      return "Terjadi kesalahan, coba lagi.";
  }
}