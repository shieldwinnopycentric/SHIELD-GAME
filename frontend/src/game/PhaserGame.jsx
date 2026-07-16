import { useEffect, useRef } from "react";
import Phaser from "phaser";
import MainScene from "./scenes/MainScene.js";

export default function PhaserGame({ socket, roomCode, player, initialRoster, currentLevel, onNearNpc, paused }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  // The scene is created ONCE, but onNearNpc is a fresh closure every React
  // render (it captures challenge/transition/roomView state). If we handed
  // the first render's closure straight to the scene, its guards would see
  // stale `null` state forever — letting a new challenge request fire while
  // the benar/salah result was still on screen (wiping it). Route the call
  // through a ref so the scene always invokes the LATEST handler.
  const onNearNpcRef = useRef(onNearNpc);
  useEffect(() => {
    onNearNpcRef.current = onNearNpc;
  }, [onNearNpc]);

  useEffect(() => {
    if (gameRef.current) return;

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: "#0e1512",
      physics: { default: "arcade", arcade: { debug: false } },
      // Mobile perf: render at CSS-pixel resolution (not the phone's 2-3x
      // devicePixelRatio), skip antialiasing on the pixel-art sprites, and
      // ask for the high-performance GPU context. Together these are the
      // difference between a phone pushing ~1M pixels/frame vs ~9M.
      render: {
        antialias: false,
        pixelArt: false,
        roundPixels: true,
        powerPreference: "high-performance",
      },
      resolution: 1,
      // RESIZE: the canvas fills its parent at 1:1 (no letterboxing), and the
      // camera viewport becomes the parent's size — so on a tall phone frame
      // the game uses the WHOLE frame instead of a small letterboxed strip.
      // The parent's size is controlled by GameScreen (big on mobile). World
      // coordinates are unchanged; the camera just shows more/less of the map.
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: "100%",
        height: "100%",
      },
      scene: [MainScene],
    };

    gameRef.current = new Phaser.Game(config);
    gameRef.current.scene.start("MainScene", {
      socket,
      roomCode,
      player,
      initialRoster,
      currentLevel,
      onNearNpc: (level) => onNearNpcRef.current?.(level),
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The scene is created once above; whenever the player's actual level
  // (tracked in React state, confirmed by the server) changes, push it into
  // the already-running scene so only the NPC matching that level responds
  // when approached — instead of any marker triggering whatever question
  // the server currently has for the player.
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene("MainScene");
    if (scene?.setCurrentLevel) scene.setCurrentLevel(currentLevel);
  }, [currentLevel]);

  // Pause the scene's update loop (movement/physics) while a full-page overlay
  // like the GuidanceRoom is open, so the character doesn't keep drifting from
  // stray keyboard input behind the page. Resumes when the overlay closes.
  useEffect(() => {
    const manager = gameRef.current?.scene;
    if (!manager || !manager.getScene("MainScene")) return;
    if (paused) manager.pause("MainScene");
    else manager.resume("MainScene");
  }, [paused]);

  return (
    // Fills the sized frame provided by GameScreen. touch-none stops the
    // browser from scrolling/zooming when the joystick is dragged.
    <div ref={containerRef} className="w-full h-full touch-none select-none" />
  );
}