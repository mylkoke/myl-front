import { useEffect } from 'react';
import { GameBoard } from '@/components/board/GameBoard';
import { useGameStore } from '@/store/gameStore';

export function GamePage() {
  const initGame = useGameStore((s) => s.initGame);

  useEffect(() => {
    initGame();
  }, [initGame]);

  return <GameBoard />;
}
