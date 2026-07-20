import { useEffect, useRef } from "react";
import Phaser from "phaser";
import MainScene from "./scenes/MainScene.js";

export default function PhaserGame({ socket, roomCode, player, initialRoster, currentLevel, onNearNpc, paused, spectator }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

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
      render: {
        antialias: false,
        pixelArt: false,
        roundPixels: true,
        powerPreference: "high-performance",
      },
      resolution: 1,
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
      spectator: !!spectator,
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene("MainScene");
    if (scene?.setCurrentLevel) scene.setCurrentLevel(currentLevel);
  }, [currentLevel]);

  useEffect(() => {
    const manager = gameRef.current?.scene;
    if (!manager || !manager.getScene("MainScene")) return;
    if (paused) manager.pause("MainScene");
    else manager.resume("MainScene");
  }, [paused]);

  return (
    <div ref={containerRef} className="w-full h-full touch-none select-none" />
  );
}
