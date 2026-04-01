import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { GameState, PlayerState, TurnPhase, PlayerId } from '@/types/game.types';
import type { CardInPlay, Card } from '@/types/card.types';
import { createCardInPlay, createCardsInPlay } from '@/utils/cardFactory';
import { shuffleDeck, drawCards } from '@/utils/deckUtils';
import {
  INITIAL_LIFE,
  INITIAL_HAND_SIZE,
  canPlayCard,
  checkGameOver,
} from '@/utils/gameRules';
import { createLogEntry } from '@/utils/gameLog';
import { STARTING_DECK_PLAYER, STARTING_DECK_OPPONENT } from '@/data/mockCards';

// ─── Initial player factory ──────────────────────────────────────────────────

function buildInitialPlayer(
  id: PlayerId,
  name: string,
  rawDeck: Card[]
): PlayerState {
  const shuffled = shuffleDeck(rawDeck);
  const { drawn, remaining } = drawCards(shuffled, INITIAL_HAND_SIZE);
  return {
    id,
    name,
    deck: remaining,
    hand: createCardsInPlay(drawn),
    field: [],
    graveyard: [],
    gold: [],
    talisman: null,
    weapon: null,
    life: INITIAL_LIFE,
    goldCount: 0,
    drawnThisTurn: false,
  };
}

function buildInitialState(): GameState {
  return {
    players: {
      player: buildInitialPlayer('player', 'Jugador', STARTING_DECK_PLAYER),
      opponent: buildInitialPlayer('opponent', 'Oponente', STARTING_DECK_OPPONENT),
    },
    turn: {
      currentPlayer: 'player',
      phase: 'main',
      turnNumber: 1,
      cardsPlayedThisTurn: 0,
    },
    selectedCard: null,
    isGameOver: false,
    winner: null,
    gameLog: [createLogEntry('¡Partida iniciada! Es el turno del Jugador.', 'system')],
  };
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface GameActions {
  // Card actions
  playCard: (card: CardInPlay, playerId: PlayerId) => void;
  moveCard: (card: CardInPlay, fromZone: string, toZone: string, playerId: PlayerId) => void;
  selectCard: (card: CardInPlay | null) => void;
  tapCard: (instanceId: string, playerId: PlayerId) => void;

  // Turn actions
  drawCard: (playerId: PlayerId) => void;
  advancePhase: () => void;
  endTurn: () => void;

  // Game lifecycle
  initGame: () => void;
  resetGame: () => void;
  addLog: (message: string, type?: GameLogEntry['type']) => void;
}

type GameLogEntry = import('@/types/game.types').GameLogEntry;
type GameStore = GameState & GameActions;

// ─── Zustand store ────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      ...buildInitialState(),

      // ── Select a card (for detail view / targeting) ──
      selectCard: (card) => set({ selectedCard: card }),

      // ── Draw a card from deck to hand ──
      drawCard: (playerId) => {
        const { players, turn } = get();
        const player = players[playerId];

        if (player.deck.length === 0) {
          get().addLog(`${player.name} no tiene más cartas en el mazo!`, 'system');
          return;
        }

        if (player.drawnThisTurn && turn.phase !== 'draw') {
          get().addLog('Ya robaste una carta este turno', 'error');
          return;
        }

        const { drawn, remaining } = drawCards(player.deck, 1);
        const newCard = createCardInPlay(drawn[0]);

        set((state) => ({
          players: {
            ...state.players,
            [playerId]: {
              ...player,
              deck: remaining,
              hand: [...player.hand, newCard],
              drawnThisTurn: true,
            },
          },
        }));

        get().addLog(`${player.name} robó una carta.`);
      },

      // ── Play a card from hand ──
      playCard: (card, playerId) => {
        const { players, turn } = get();
        const player = players[playerId];

        const { allowed, reason } = canPlayCard(card, player, turn);
        if (!allowed) {
          get().addLog(reason ?? 'No puedes jugar esa carta', 'error');
          return;
        }

        const newHand = player.hand.filter((c) => c.instanceId !== card.instanceId);
        let updatedPlayer = { ...player, hand: newHand };

        if (card.tipo === 'oro') {
          updatedPlayer = {
            ...updatedPlayer,
            gold: [...player.gold, { ...card }],
            goldCount: player.goldCount + 1,
          };
          get().addLog(`${player.name} jugó ${card.nombre} (Oro).`, 'action');
        } else if (card.tipo === 'criatura') {
          updatedPlayer = {
            ...updatedPlayer,
            field: [...player.field, { ...card }],
            goldCount: player.goldCount - card.coste,
          };
          get().addLog(`${player.name} invocó a ${card.nombre} (${card.fuerza} de fuerza).`, 'action');
        } else if (card.tipo === 'talisman') {
          updatedPlayer = {
            ...updatedPlayer,
            talisman: { ...card },
            goldCount: player.goldCount - card.coste,
          };
          get().addLog(`${player.name} equipó el talismán ${card.nombre}.`, 'action');
        } else if (card.tipo === 'arma') {
          updatedPlayer = {
            ...updatedPlayer,
            weapon: { ...card },
            goldCount: player.goldCount - card.coste,
          };
          get().addLog(`${player.name} equipó el arma ${card.nombre}.`, 'action');
        } else if (card.tipo === 'tierra') {
          updatedPlayer = {
            ...updatedPlayer,
            field: [...player.field, { ...card }],
            goldCount: player.goldCount - card.coste,
          };
          get().addLog(`${player.name} jugó la tierra ${card.nombre}.`, 'action');
        }

        set((state) => ({
          players: {
            ...state.players,
            [playerId]: updatedPlayer,
          },
          turn: {
            ...state.turn,
            cardsPlayedThisTurn: state.turn.cardsPlayedThisTurn + 1,
          },
        }));

        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) {
          set({ isGameOver: true, winner: winnerId as PlayerId });
        }
      },

      // ── Move a card between zones (drag and drop handler) ──
      moveCard: (card, fromZone, toZone, playerId) => {
        const { players } = get();
        const player = players[playerId];

        // Remove from source zone
        const removeFrom = (zone: CardInPlay[]) =>
          zone.filter((c) => c.instanceId !== card.instanceId);

        let updated = { ...player };

        if (fromZone === 'hand') updated = { ...updated, hand: removeFrom(player.hand) };
        else if (fromZone === 'field') updated = { ...updated, field: removeFrom(player.field) };

        // Add to target zone
        if (toZone === 'field' && fromZone === 'hand') {
          get().playCard(card, playerId);
          return;
        } else if (toZone === 'graveyard') {
          updated = { ...updated, graveyard: [...player.graveyard, { ...card }] };
          get().addLog(`${card.nombre} fue al cementerio.`, 'action');
        } else if (toZone === 'hand' && fromZone === 'field') {
          updated = { ...updated, hand: [...player.hand, { ...card }] };
        }

        set((state) => ({
          players: { ...state.players, [playerId]: updated },
        }));
      },

      // ── Tap/untap a card ──
      tapCard: (instanceId, playerId) => {
        set((state) => ({
          players: {
            ...state.players,
            [playerId]: {
              ...state.players[playerId],
              field: state.players[playerId].field.map((c) =>
                c.instanceId === instanceId ? { ...c, tapped: !c.tapped } : c
              ),
            },
          },
        }));
      },

      // ── Advance turn phase ──
      advancePhase: () => {
        const phaseOrder: TurnPhase[] = ['draw', 'main', 'combat', 'end'];
        const { turn } = get();
        const currentIndex = phaseOrder.indexOf(turn.phase);
        const nextPhase = phaseOrder[currentIndex + 1];

        if (!nextPhase) {
          get().endTurn();
          return;
        }

        if (nextPhase === 'draw') {
          get().drawCard(turn.currentPlayer);
        }

        set((state) => ({
          turn: { ...state.turn, phase: nextPhase },
        }));

        get().addLog(`Fase: ${nextPhase.toUpperCase()}`, 'system');
      },

      // ── End turn ──
      endTurn: () => {
        const { turn, players } = get();
        const nextPlayer: PlayerId =
          turn.currentPlayer === 'player' ? 'opponent' : 'player';
        const nextTurnNumber = nextPlayer === 'player'
          ? turn.turnNumber + 1
          : turn.turnNumber;

        // Untap all cards for next player
        const nextPlayerState = players[nextPlayer];
        const untappedField = nextPlayerState.field.map((c) => ({
          ...c,
          tapped: false,
          attackedThisTurn: false,
        }));

        set((state) => ({
          turn: {
            currentPlayer: nextPlayer,
            phase: 'main',
            turnNumber: nextTurnNumber,
            cardsPlayedThisTurn: 0,
          },
          players: {
            ...state.players,
            [nextPlayer]: {
              ...nextPlayerState,
              field: untappedField,
              drawnThisTurn: false,
            },
          },
        }));

        // Auto-draw for the next player
        get().drawCard(nextPlayer);
        get().addLog(
          `Turno ${nextTurnNumber}: es el turno de ${players[nextPlayer].name}.`,
          'system'
        );
      },

      // ── Init / Reset game ──
      initGame: () => set(buildInitialState()),
      resetGame: () => set(buildInitialState()),

      // ── Add to game log ──
      addLog: (message, type = 'action') => {
        set((state) => ({
          gameLog: [createLogEntry(message, type), ...state.gameLog].slice(0, 50),
        }));
      },
    }),
    { name: 'myl-game-store' }
  )
);
