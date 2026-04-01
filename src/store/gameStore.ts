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
    equippedWeapons: {},
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
    isBoardRotating: false,
    gameLog: [createLogEntry('¡Partida iniciada! Es el turno del Jugador.', 'system')],
  };
}

// ─── Store interface ──────────────────────────────────────────────────────────

type GameLogEntry = import('@/types/game.types').GameLogEntry;

interface GameActions {
  playCard: (card: CardInPlay, playerId: PlayerId) => void;
  moveCard: (card: CardInPlay, fromZone: string, toZone: string, playerId: PlayerId) => void;
  equipWeapon: (weapon: CardInPlay, allyInstanceId: string, playerId: PlayerId) => void;
  unequipWeapon: (allyInstanceId: string, playerId: PlayerId) => void;
  selectCard: (card: CardInPlay | null) => void;
  tapCard: (instanceId: string, playerId: PlayerId) => void;
  drawCard: (playerId: PlayerId) => void;
  advancePhase: () => void;
  /** Finalizar turno: lanza animación de rotación, luego cambia el turno */
  endTurn: () => void;
  setBoardRotating: (value: boolean) => void;
  initGame: () => void;
  resetGame: () => void;
  addLog: (message: string, type?: GameLogEntry['type']) => void;
}

type GameStore = GameState & GameActions;

// ─── Zustand store ────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      ...buildInitialState(),

      selectCard: (card) => set({ selectedCard: card }),

      setBoardRotating: (value) => set({ isBoardRotating: value }),

      // ── Draw a card from deck to hand ──────────────────────────────────────
      drawCard: (playerId) => {
        const { players } = get();
        const player = players[playerId];

        if (player.deck.length === 0) {
          get().addLog(`${player.name} no tiene más cartas en el mazo!`, 'system');
          return;
        }

        const { drawn, remaining } = drawCards(player.deck, 1);
        const newCard = createCardInPlay(drawn[0]);

        set((state) => ({
          players: {
            ...state.players,
            [playerId]: {
              ...state.players[playerId],
              deck: remaining,
              hand: [...state.players[playerId].hand, newCard],
              drawnThisTurn: true,
            },
          },
        }));

        get().addLog(`${player.name} robó una carta del Mazo Castillo.`);
      },

      // ── Play a card from hand ──────────────────────────────────────────────
      playCard: (card, playerId) => {
        const { players, turn } = get();
        const player = players[playerId];

        const { allowed, reason } = canPlayCard(card, player, turn);
        if (!allowed) {
          get().addLog(reason ?? 'No puedes jugar esa carta', 'error');
          return;
        }

        const newHand = player.hand.filter((c) => c.instanceId !== card.instanceId);
        let updated = { ...player, hand: newHand };

        switch (card.tipo) {
          case 'oro':
            updated = {
              ...updated,
              gold: [...player.gold, card],
              goldCount: player.goldCount + 1,
            };
            get().addLog(`${player.name} jugó ${card.nombre} (Oro).`);
            break;

          case 'aliado':
          case 'tierra':
            updated = {
              ...updated,
              field: [...player.field, card],
              goldCount: player.goldCount - card.coste,
            };
            get().addLog(
              `${player.name} invocó a ${card.nombre}${card.tipo === 'aliado' ? ` (${card.fuerza} de fuerza)` : ''}.`
            );
            break;

          case 'talisman':
            updated = {
              ...updated,
              talisman: card,
              goldCount: player.goldCount - card.coste,
            };
            get().addLog(`${player.name} equipó el talismán ${card.nombre}.`);
            break;

          case 'arma':
            // Armas van directamente a la mano para ser asignadas vía drag-drop sobre un aliado
            // Si no hay aliados en el campo, se rechaza
            if (player.field.filter(c => c.tipo === 'aliado').length === 0) {
              get().addLog('Necesitas un aliado en el campo para equipar un arma.', 'error');
              return;
            }
            // Colocar el arma de vuelta en mano (el jugador la arrastra sobre un aliado)
            updated = {
              ...updated,
              hand: newHand,
              goldCount: player.goldCount - card.coste,
            };
            // Equip to first ally without weapon as default
            const firstFreeAlly = player.field.find(
              c => c.tipo === 'aliado' && !player.equippedWeapons[c.instanceId]
            );
            if (firstFreeAlly) {
              updated = {
                ...updated,
                equippedWeapons: {
                  ...player.equippedWeapons,
                  [firstFreeAlly.instanceId]: card,
                },
              };
              get().addLog(
                `${player.name} equipó ${card.nombre} a ${firstFreeAlly.nombre} (+${card.bonusFuerza ?? 0} de fuerza).`,
                'action'
              );
            }
            break;
        }

        set((state) => ({
          players: { ...state.players, [playerId]: updated },
          turn: { ...state.turn, cardsPlayedThisTurn: state.turn.cardsPlayedThisTurn + 1 },
        }));

        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId });
      },

      // ── Equip weapon to a specific ally (via drag-drop) ───────────────────
      equipWeapon: (weapon, allyInstanceId, playerId) => {
        const { players } = get();
        const player = players[playerId];

        // Remove weapon from hand
        const newHand = player.hand.filter((c) => c.instanceId !== weapon.instanceId);

        // Unequip previous weapon on this ally (send to graveyard)
        const prevWeapon = player.equippedWeapons[allyInstanceId];
        const newGraveyard = prevWeapon
          ? [...player.graveyard, prevWeapon]
          : player.graveyard;

        const ally = player.field.find(c => c.instanceId === allyInstanceId);

        set((state) => ({
          players: {
            ...state.players,
            [playerId]: {
              ...state.players[playerId],
              hand: newHand,
              graveyard: newGraveyard,
              goldCount: state.players[playerId].goldCount - weapon.coste,
              equippedWeapons: {
                ...state.players[playerId].equippedWeapons,
                [allyInstanceId]: weapon,
              },
            },
          },
          turn: {
            ...state.turn,
            cardsPlayedThisTurn: state.turn.cardsPlayedThisTurn + 1,
          },
        }));

        get().addLog(
          `${player.name} equipó ${weapon.nombre} a ${ally?.nombre ?? 'aliado'} (+${weapon.bonusFuerza ?? 0} de fuerza).`,
          'action'
        );
      },

      // ── Unequip weapon from ally ──────────────────────────────────────────
      unequipWeapon: (allyInstanceId, playerId) => {
        const { players } = get();
        const weapon = players[playerId].equippedWeapons[allyInstanceId];
        if (!weapon) return;

        const newWeapons = { ...players[playerId].equippedWeapons };
        delete newWeapons[allyInstanceId];

        set((state) => ({
          players: {
            ...state.players,
            [playerId]: {
              ...state.players[playerId],
              equippedWeapons: newWeapons,
              graveyard: [...state.players[playerId].graveyard, weapon],
            },
          },
        }));

        get().addLog(`${weapon.nombre} fue desequipada al cementerio.`);
      },

      // ── Move card between zones ───────────────────────────────────────────
      moveCard: (card, fromZone, toZone, playerId) => {
        if (fromZone === 'hand' && toZone === 'field') {
          get().playCard(card, playerId);
          return;
        }

        const { players } = get();
        const player = players[playerId];

        const removeFrom = (arr: CardInPlay[]) =>
          arr.filter((c) => c.instanceId !== card.instanceId);

        let updated = { ...player };
        if (fromZone === 'hand') updated = { ...updated, hand: removeFrom(player.hand) };
        else if (fromZone === 'field') updated = { ...updated, field: removeFrom(player.field) };

        if (toZone === 'graveyard') {
          updated = { ...updated, graveyard: [...player.graveyard, card] };
          get().addLog(`${card.nombre} fue al cementerio.`);
        }

        set((state) => ({
          players: { ...state.players, [playerId]: updated },
        }));
      },

      // ── Tap/untap a card ──────────────────────────────────────────────────
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

      // ── Advance turn phase ────────────────────────────────────────────────
      advancePhase: () => {
        const phaseOrder: TurnPhase[] = ['draw', 'main', 'combat', 'end'];
        const { turn } = get();
        const idx = phaseOrder.indexOf(turn.phase);
        const next = phaseOrder[idx + 1];

        if (!next) {
          get().endTurn();
          return;
        }

        set((state) => ({ turn: { ...state.turn, phase: next } }));
        get().addLog(`Fase: ${next.toUpperCase()}`, 'system');
      },

      // ── End turn (the animation is triggered from the component) ──────────
      endTurn: () => {
        const { turn, players } = get();
        const nextPlayer: PlayerId =
          turn.currentPlayer === 'player' ? 'opponent' : 'player';
        const nextTurnNumber =
          nextPlayer === 'player' ? turn.turnNumber + 1 : turn.turnNumber;

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
          isBoardRotating: false,
        }));

        // Auto-draw one card from Mazo Castillo for next player
        get().drawCard(nextPlayer);
        get().addLog(
          `Turno ${nextTurnNumber}: turno de ${players[nextPlayer].name}.`,
          'system'
        );
      },

      initGame: () => set(buildInitialState()),
      resetGame: () => set(buildInitialState()),

      addLog: (message, type = 'action') => {
        set((state) => ({
          gameLog: [createLogEntry(message, type), ...state.gameLog].slice(0, 50),
        }));
      },
    }),
    { name: 'myl-game-store' }
  )
);
