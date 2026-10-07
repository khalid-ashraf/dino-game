import { useEffect, useRef } from 'react';
import { DinoGame } from '../game/DinoGame';

export function Game({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<DinoGame>(null);
  // Read once on mount so the game starts in the right theme without a fade.
  const initialDark = useRef(dark);

  useEffect(() => {
    const root = document.documentElement;
    const game = new DinoGame(canvasRef.current!, {
      dark: initialDark.current,
      onTheme: ({ bg, fg }) => {
        root.style.setProperty('--bg', bg);
        root.style.setProperty('--fg', fg);
      },
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
      root.style.removeProperty('--bg');
      root.style.removeProperty('--fg');
    };
  }, []);

  useEffect(() => {
    gameRef.current?.setDark(dark);
  }, [dark]);

  return (
    <div className="game">
      <canvas ref={canvasRef} width={600} height={150} aria-label="Dino game" />
    </div>
  );
}
