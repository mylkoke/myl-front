import type { PlayerState } from '@/types/game.types';
import type { PlayerId } from '@/types/game.types';
import { GameZone } from './GameZone';
import { PlayerHand } from '@/components/cards/PlayerHand';
import { Heart, Coins, Layers } from 'lucide-react';

interface PlayerAreaProps {
  player: PlayerState;
  playerId: PlayerId;
  isOpponent?: boolean;
}

export function PlayerArea({ player, playerId, isOpponent = false }: PlayerAreaProps) {
  const lifeColor =
    player.life > 10 ? 'text-green-400' : player.life > 5 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div
      className={[
        'flex flex-col gap-2 px-2',
        isOpponent ? 'rotate-180' : '',
      ].join(' ')}
    >
      {/* Player stats bar */}
      <div
        className={[
          'flex items-center justify-between px-4 py-2 rounded-lg',
          'bg-slate-900/80 border border-slate-700/50',
          isOpponent ? 'rotate-180' : '',
        ].join(' ')}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 font-bold text-lg ${lifeColor}`}>
            <Heart size={16} />
            <span>{player.life}</span>
          </div>
          <div className="flex items-center gap-1 text-yellow-400 font-bold">
            <Coins size={14} />
            <span>{player.goldCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Layers size={14} />
          <span>{player.deck.length} cartas</span>
        </div>

        <div className="font-semibold text-white text-sm">{player.name}</div>
      </div>

      {/* Equipment row (talisman + weapon) */}
      <div className={`flex gap-2 ${isOpponent ? 'rotate-180' : ''}`}>
        <GameZone
          zoneId="talisman"
          playerId={playerId}
          label="Talismán"
          cards={player.talisman ? [player.talisman] : []}
          maxCards={1}
          className="flex-1 min-h-[70px]"
          compact
        />
        <GameZone
          zoneId="weapon"
          playerId={playerId}
          label="Arma"
          cards={player.weapon ? [player.weapon] : []}
          maxCards={1}
          className="flex-1 min-h-[70px]"
          compact
        />
        <GameZone
          zoneId="gold"
          playerId={playerId}
          label="Oro"
          cards={player.gold}
          className="flex-2 min-h-[70px]"
          compact
        />
        <GameZone
          zoneId="graveyard"
          playerId={playerId}
          label="Cementerio"
          cards={player.graveyard}
          className="flex-1 min-h-[70px]"
          compact
          allowDrop
        />
      </div>

      {/* Field */}
      <GameZone
        zoneId="field"
        playerId={playerId}
        label="Campo de batalla"
        cards={player.field}
        maxCards={5}
        allowDrop={!isOpponent}
        className="min-h-[100px]"
      />

      {/* Hand */}
      <div className={`px-2 py-2 bg-slate-900/60 rounded-lg border border-slate-700/40 ${isOpponent ? 'rotate-180' : ''}`}>
        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">
          Mano ({player.hand.length})
        </div>
        <PlayerHand cards={player.hand} playerId={playerId} isOpponent={isOpponent} />
      </div>
    </div>
  );
}
