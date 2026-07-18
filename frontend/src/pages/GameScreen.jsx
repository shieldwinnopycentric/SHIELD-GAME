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
  const [won, setWon] = useState(!!resume?.won);

  const [challenge, setChallenge] = useState(null);
  const [resultState, setResultState] = useState(null);
  const [transition, setTransition] = useState(null);
  const [roomView, setRoomView] = useState(null);

  const startRef = useRef(Date.now());
  const durationRef = useRef(GAME_DURATION_MS);
  const timeUpSentRef = useRef(false);
  const intentionalExitRef = useRef(false);
  const pendingLevelRef = useRef(null);

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

    function onDisconnect() {
      if (intentionalExitRef.current) return;
      alert("Koneksi terputus — kamu keluar dari room. Silakan gabung room baru.");
      onExit?.();
    }
    socket.on("disconnect", onDisconnect);

    const timer = setInterval(() => {
      const left = Math.max(0, durationRef.current - (Date.now() - startRef.current));
      setTimeLeftMs(left);
      if (left <= 0 && !timeUpSentRef.current) {
        timeUpSentRef.current = true;
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
        setQuestionNumber(res.questionIndex + 1);
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
        level: res.clearedLevel ?? res.level,
        won: res.won,
      });
      return;
    }

    if (res.result === "levelFailed") {
      setRoomView({
        failRoom: res.failRoom,
        failedLevel: res.failedLevel,
        repeatLevel: res.repeatLevel,
        maxLives: res.maxLives,
        character: player.character,
      });
    }
  }

  function handleRoomExit() {
    setRoomView(null);
  }

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

  function handleTransitionContinue() {
    if (transition?.won) {
      goToResults();
      return;
    }
    setTransition(null);
  }

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
