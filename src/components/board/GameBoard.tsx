import { useGameStore } from '@/store/gameStore';
import { PlayerArea } from './PlayerArea';
import { TurnPanel } from './TurnPanel';
import { Separator } from './Separator';

export function GameBoard() {
  const players = useGameStore((s) => s.players);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const winner = useGameStore((s) => s.winner);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a1520] flex">
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(251,191,36,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(59,130,246,0.2) 0%, transparent 50%)',
        }}
      />

      {/* Main game area */}
      <div className="flex-1 flex flex-col gap-1 p-2 overflow-auto">
        {/* Opponent area */}
        <div className="flex-1">
          <PlayerArea
            player={players.opponent}
            playerId="opponent"
            isOpponent
          />
        </div>

        {/* Center divider */}
        <Separator />

        {/* Player area */}
        <div className="flex-1">
          <PlayerArea player={players.player} playerId="player" />
        </div>
      </div>

      {/* Side panel */}
      <div className="w-52 flex-shrink-0 p-2 flex items-center">
        <TurnPanel />
      </div>

      {/* Game over overlay */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 pointer-events-none">
          <div className="text-center">
            <div className="text-5xl font-black text-yellow-400 drop-shadow-2xl">
              {winner === 'player' ? '¡VICTORIA!' : 'DERROTA'}
            </div>
            <div className="text-slate-400 mt-2">
              {winner === 'player'
                ? 'Has vencido al oponente'
                : 'El oponente ha ganado esta partida'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
