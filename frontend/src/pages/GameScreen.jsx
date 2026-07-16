import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket.js";
import PhaserGame from "../game/PhaserGame.jsx";
import HUD from "../components/HUD.jsx";
import ChallengeModal from "../components/ChallengeModal.jsx";
import LevelTransition from "../components/LevelTransition.jsx";
import GuidanceRoom from "./GuidanceRoom.jsx";
import { confirmDialog } from "../lib/dialog.js";

const GAME_DURATION_MS = 15 * 60 * 1000;

export default function GameScreen({ player, roomCode, playerKey, initialGameState, onGameOver, onExit }) {
  // Saat masuk dari hasil RESUME (refresh di tengah game), initialGameState
  // membawa snapshot progres dari server — pakai itu sebagai state awal
  // supaya HUD/level tidak balik ke Level 1.
  const resume = initialGameState?.resume;
  const [level, setLevel] = useState(resume?.level ?? 1);
  const [questionNumber, setQuestionNumber] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(null);
  const [wrongInLevel, setWrongInLevel] = useState(resume?.wrongInLevel ?? 0);
  const [maxWrong, setMaxWrong] = useState(1);
  const [lives, setLives] = useState(resume?.lives ?? 2);
  const [maxLives, setMaxLives] = useState(2);
  const [livesLost, setLivesLost] = useState(resume?.livesLost ?? 0);
  const [score, setScore] = useState(resume?.score ?? 0);
  const [correctCount, setCorrectCount] = useState(resume?.correctCount ?? 0);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_DURATION_MS);
  const [finished, setFinished] = useState(!!resume?.finished);
  const [won, setWon] = useState(!!resume?.won); // satu-satunya cara "finished": menang di Level 3

  const [challenge, setChallenge] = useState(null);
  const [resultState, setResultState] = useState(null);
  const [transition, setTransition] = useState(null); // { type, ... } (passed/won)
  const [roomView, setRoomView] = useState(null); // halaman ruang kegagalan (failed)

  const startRef = useRef(Date.now());
  const durationRef = useRef(GAME_DURATION_MS);
  const timeUpSentRef = useRef(false);
  const intentionalExitRef = useRef(false); // true saat pemain sendiri menekan Keluar
  const pendingLevelRef = useRef(null); // stashes level info while a per-question result is shown

  useEffect(() => {
    startRef.current = Date.now();
    if (initialGameState?.durationMs) {
      durationRef.current = initialGameState.durationMs;
      setTimeLeftMs(initialGameState.durationMs);
    }

    function onGameOverEvt({ leaderboard }) {
      onGameOver(leaderboard);
    }
    socket.on("game_over", onGameOverEvt);

    // Mid-game connection drop (common on phones: wifi blip / screen lock).
    // The server frees our slot on disconnect and a reconnect gets a NEW
    // socket id the room doesn't know — so the session is unrecoverable.
    // Tell the player instead of leaving them silently stuck on the map.
    function onDisconnect() {
      if (intentionalExitRef.current) return; // player chose "Keluar" — no alert
      alert("Koneksi terputus — kamu keluar dari room. Silakan gabung room baru.");
      onExit?.();
    }
    socket.on("disconnect", onDisconnect);

    const timer = setInterval(() => {
      // Count down from the duration the SERVER said is left at game_start —
      // a player who joined late (or whose game_start was delayed) previously
      // ran a full local 15:00 out of sync with everyone else's clock.
      const left = Math.max(0, durationRef.current - (Date.now() - startRef.current));
      setTimeLeftMs(left);
      if (left <= 0 && !timeUpSentRef.current) {
        timeUpSentRef.current = true; // ping the server once, not every second
        socket.emit("leave_or_time_up_check", { code: roomCode });
      }
    }, 1000);

    return () => {
      socket.off("game_over", onGameOverEvt);
      socket.off("disconnect", onDisconnect);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestChallenge() {
    socket.emit("request_challenge", { code: roomCode }, (res) => {
      if (!res.ok) return;
      setChallenge(res.challenge);
      setQuestionNumber(res.challenge.questionNumber);
      setTotalQuestions(res.challenge.totalQuestions);
      setWrongInLevel(res.challenge.wrongInLevel);
      setMaxWrong(res.challenge.maxWrong);
      setLives(res.challenge.lives);
      setMaxLives(res.challenge.maxLives);
      setResultState(null);
    });
  }

  // Only called when MainScene detects the player is next to the NPC
  // marker matching their ACTUAL current level (see MainScene.js) — so a
  // fresh question only ever appears from physically approaching the
  // right NPC, never automatically.
  function handleNearNpc() {
    if (finished || challenge || transition || roomView) return;
    requestChallenge();
  }

  function handleAnswer(optionIdx) {
    socket.emit(
      "submit_answer",
      { code: roomCode, challengeId: challenge.id, optionIdx },
      (res) => {
        if (!res.ok) return;
        setLevel(res.level);
        setScore(res.score);
        setTotalQuestions(res.totalQuestions);
        setQuestionNumber(res.questionIndex + 1); // upcoming question, 1-based
        setWrongInLevel(res.wrongInLevel);
        setMaxWrong(res.maxWrong);
        setLives(res.lives);
        setMaxLives(res.maxLives);
        if (!res.correct) setLivesLost((n) => n + 1);
        if (res.correct) setCorrectCount((c) => c + 1);

        setResultState({ correct: res.correct, feedback: res.feedback });
        pendingLevelRef.current = res;
        if (res.finished) {
          setFinished(true);
          setWon(!!res.won);
        }
      }
    );
  }

  // Per-question "Lanjutkan" (inside ChallengeModal):
  //  - "continue"    -> masih ada soal di level yang sama, langsung lanjut.
  //  - "levelPassed" -> tampilkan interstitial LOLOS (won=true kalau menang L3).
  //  - "levelFailed" -> tampilkan interstitial GAGAL (Ruang Bimbingan/Rumah
  //    Sakit), lalu pemain mengulang level (repeatLevel).
  function handleContinue() {
    const res = pendingLevelRef.current;
    setChallenge(null);
    setResultState(null);

    if (!res || res.result === "continue") {
      requestChallenge();
      return;
    }

    if (res.result === "levelPassed") {
      setTransition({
        type: "passed",
        level: res.clearedLevel ?? res.level, // level yang baru saja dilewati
        won: res.won,
      });
      return;
    }

    if (res.result === "levelFailed") {
      // Bukan popup: pemain auto-masuk ke HALAMAN ruang (GuidanceRoom) untuk
      // membaca materi literasi dulu sebelum boleh mengulang level.
      setRoomView({
        failRoom: res.failRoom,
        failedLevel: res.failedLevel,
        repeatLevel: res.repeatLevel,
        maxLives: res.maxLives,
        character: player.character,
      });
    }
  }

  // Tombol "Kembali ke Game" di halaman ruang (aktif setelah materi dibaca).
  // Server sudah mereset pemain ke repeatLevel dengan nyawa penuh, jadi cukup
  // menutup halaman — pemain lalu mendekati NPC level itu untuk lanjut.
  function handleRoomExit() {
    setRoomView(null);
  }

  // Builds a leaderboard row from THIS player's own final stats and jumps
  // straight to the results/leaderboard screen — so a player who wins sees
  // their score immediately instead of waiting for the whole room to end.
  function goToResults() {
    onGameOver([
      {
        rank: 1,
        name: player.name,
        character: player.character,
        finishTimeMs: Date.now() - startRef.current,
        correctCount,
        level,
        lives,
        livesLost,
        won,
        score,
        disconnected: false,
      },
    ]);
  }

  // Transition screen's button:
  //  - MENANG (won) -> langsung ke layar Hasil & Leaderboard.
  //  - lolos level biasa / gagal (ulang level) -> tutup interstitial saja;
  //    pemain jalan ke marker NPC level yang aktif agar soal muncul (tidak
  //    auto-fetch).
  function handleTransitionContinue() {
    if (transition?.won) {
      goToResults();
      return;
    }
    setTransition(null);
  }

  // Quit the match mid-game. Disconnecting frees the player's slot server-side
  // (marked finished so the room isn't blocked waiting on them), then we hand
  // control back to App to return home.
  async function handleExit() {
    const ok = await confirmDialog({
      title: "Keluar Game?",
      text: "Progres ronde ini akan hilang dan kamu keluar dari room.",
      confirmText: "Ya, Keluar",
      cancelText: "Batal",
      danger: true,
    });
    if (ok) {
      intentionalExitRef.current = true;
      socket.disconnect();
      onExit?.();
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Game frame — large on mobile (fills most of the screen height); the
          HUD, status banner and controls hint float INSIDE it as overlays so
          nothing eats vertical space or overflows off-screen on a phone. */}
      <div className="relative w-full h-[74svh] md:h-auto md:aspect-[8/5] rounded-lg overflow-hidden border border-line">
        <PhaserGame
          socket={socket}
          roomCode={roomCode}
          player={player}
          initialRoster={initialGameState?.roster || []}
          currentLevel={level}
          onNearNpc={handleNearNpc}
          paused={!!roomView}
        />

        <div className="absolute top-1.5 left-1.5 right-12 z-20 pointer-events-none">
          <HUD
            level={level}
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
            wrongInLevel={wrongInLevel}
            maxWrong={maxWrong}
            lives={lives}
            maxLives={maxLives}
            score={score}
            timeLeftMs={timeLeftMs}
          />
        </div>

        <button
          type="button"
          onClick={handleExit}
          aria-label="Keluar dari permainan"
          className="absolute top-1.5 right-1.5 z-30 flex items-center justify-center w-9 h-9 bg-void/70 backdrop-blur-sm border border-line rounded-full text-parchment/80 hover:text-danger hover:border-danger/60 active:scale-95 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {finished && (
          <div className="absolute top-14 left-1.5 right-1.5 z-20 border rounded-md px-3 py-2 text-center text-xs backdrop-blur-sm bg-success/20 border-success">
            Semua level selesai — kamu menang! Menunggu pemain lain...
          </div>
        )}

        <p className="absolute bottom-1.5 left-1.5 right-1.5 z-10 text-center text-parchment/60 text-[11px] bg-void/50 backdrop-blur-sm rounded px-2 py-1 pointer-events-none">
          <span className="md:hidden">Seret jari untuk gerak · dekati marker level.</span>
          <span className="hidden md:inline">
            WASD / arrow keys untuk gerak · dekati marker level untuk mulai challenge.
          </span>
        </p>
      </div>

      <ChallengeModal
        challenge={challenge}
        onAnswer={handleAnswer}
        resultState={resultState}
        onContinue={handleContinue}
      />

      <LevelTransition info={transition} onContinue={handleTransitionContinue} />

      {roomView && <GuidanceRoom info={roomView} onBackToGame={handleRoomExit} />}
    </div>
  );
}