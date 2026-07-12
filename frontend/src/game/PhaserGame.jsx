import { useEffect, useRef } from "react";
import Phaser from "phaser";
import MainScene from "./scenes/MainScene.js";

export default function PhaserGame({ socket, roomCode, player, initialRoster, currentLevel, onNearNpc, paused }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: "#0e1512",
      physics: { default: "arcade", arcade: { debug: false } },
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
      onNearNpc,
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