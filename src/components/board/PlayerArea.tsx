import type { PlayerState, PlayerId } from '@/types/game.types';
import { GameZone } from './GameZone';
import { PlayerHand } from '@/components/cards/PlayerHand';
import { DeckPile } from './DeckPile';
import { BattleField } from './BattleField';
import { Heart, Coins } from 'lucide-react';

interface PlayerAreaProps {
  player: PlayerState;
  playerId: PlayerId;
  isOpponent?: boolean;
}

export function PlayerArea({ player, playerId, isOpponent = false }: PlayerAreaProps) {
  const lifeColor =
    player.life > 10
      ? 'text-green-400'
      : player.life > 5
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <div className="flex flex-col gap-2 w-full">

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/50">
        <span className="font-bold text-white text-sm">{player.name}</span>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1 font-bold ${lifeColor}`}>
            <Heart size={13} />
            <span>{player.life}</span>
          </div>
          <div className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
            <Coins size={13} />
            <span>{player.goldCount}</span>
          </div>
        </div>
      </div>

      {/* ── Main game row: Mazo | Campo | Zonas de soporte ─────────────── */}
      <div className="flex gap-2 items-start">

        {/* Mazo Castillo + Cementerio */}
        <div className="flex flex-col gap-2 items-center flex-shrink-0">
          <DeckPile deck={player.deck} playerId={playerId} isOpponent={isOpponent} />

          {/* Cementerio */}
          <GameZone
            zoneId="graveyard"
            playerId={playerId}
            label="Cementerio"
            cards={player.graveyard}
            className="w-14 min-h-[72px]"
            compact
            allowDrop={false}
          />
        </div>

        {/* Campo de batalla (aliados + tierras) */}
        <div className="flex-1">
          <BattleField playerId={playerId} isOpponent={isOpponent} />
        </div>

        {/* Talisman + Oro */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {/* Talismán */}
          <GameZone
            zoneId="talisman"
            playerId={playerId}
            label="Talismán"
            cards={player.talisman ? [player.talisman] : []}
            maxCards={1}
            className="w-14 min-h-[72px]"
            compact
          />

          {/* Zona de oro */}
          <GameZone
            zoneId="gold"
            playerId={playerId}
            label="Oro"
            cards={player.gold}
            className="w-14 min-h-[40px]"
            compact
          />
        </div>
      </div>

      {/* ── Mano ──────────────────────────────────────────────────────── */}
      <div className="px-2 py-2 bg-slate-900/60 rounded-lg border border-slate-700/40">
        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">
          Mano ({player.hand.length})
        </div>
        <PlayerHand
          cards={player.hand}
          playerId={playerId}
          isOpponent={isOpponent}
        />
      </div>
    </div>
  );
}
