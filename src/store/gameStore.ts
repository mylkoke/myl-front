import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { GameState, PlayerState, TurnPhase, PlayerId } from '@/types/game.types';
import type { CardInPlay, Card } from '@/types/card.types';
import { createCardInPlay, createCardsInPlay } from '@/utils/cardFactory';
import { shuffleDeck, drawCards } from '@/utils/deckUtils';
import { INITIAL_LIFE, INITIAL_HAND_SIZE, canPlayCard, checkGameOver } from '@/utils/gameRules';
import { createLogEntry } from '@/utils/gameLog';
import { STARTING_DECK_PLAYER, STARTING_DECK_OPPONENT } from '@/data/mockCards';

// ─── Builder ──────────────────────────────────────────────────────────────────

function buildInitialPlayer(id: PlayerId, name: string, rawDeck: Card[]): PlayerState {
  const shuffled = shuffleDeck(rawDeck);
  const { drawn, remaining } = drawCards(shuffled, INITIAL_HAND_SIZE);
  return {
    id,
    name,
    deck: remaining,
    hand: createCardsInPlay(drawn),
    defenseField: [],
    attackField: [],
    supportField: [],
    gold: [],
    goldPaid: [],
    graveyard: [],
    removed: [],
    exile: [],
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
      phase: 'vigilia',
      turnNumber: 1,
      cardsPlayedThisTurn: 0,
      goldPlayedThisTurn: 0,
    },
    selectedCard: null,
    isGameOver: false,
    winner: null,
    isBoardRotating: false,
    gameLog: [createLogEntry('¡Partida iniciada! Turno del Jugador — Vigilia.', 'system')],
  };
}

// ─── Actions interface ────────────────────────────────────────────────────────

type GameLogEntry = import('@/types/game.types').GameLogEntry;

interface GameActions {
  playCard: (card: CardInPlay, playerId: PlayerId) => void;
  equipWeapon: (weapon: CardInPlay, allyInstanceId: string, playerId: PlayerId) => void;
  attackWithAlly: (allyInstanceId: string, playerId: PlayerId) => void;
  selectCard: (card: CardInPlay | null) => void;
  tapCard: (instanceId: string, playerId: PlayerId) => void;
  drawCard: (playerId: PlayerId) => void;
  advancePhase: () => void;
  endTurn: () => void;
  setBoardRotating: (v: boolean) => void;
  initGame: () => void;
  resetGame: () => void;
  addLog: (msg: string, type?: GameLogEntry['type']) => void;
}

type GameStore = GameState & GameActions;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      ...buildInitialState(),

      selectCard: (card) => set({ selectedCard: card }),
      setBoardRotating: (v) => set({ isBoardRotating: v }),

      // ── Draw from Mazo Castillo ───────────────────────────────────────────
      drawCard: (playerId) => {
        const { players } = get();
        const player = players[playerId];

        if (player.deck.length === 0) {
          get().addLog(`${player.name}: ¡Mazo Castillo vacío!`, 'system');
          return;
        }

        const { drawn, remaining } = drawCards(player.deck, 1);
        const newCard = createCardInPlay(drawn[0]);

        set((s) => ({
          players: {
            ...s.players,
            [playerId]: {
              ...s.players[playerId],
              deck: remaining,
              hand: [...s.players[playerId].hand, newCard],
              drawnThisTurn: true,
            },
          },
        }));

        get().addLog(`${player.name} robó una carta del Mazo Castillo.`);
      },

      // ── Play a card from hand ─────────────────────────────────────────────
      playCard: (card, playerId) => {
        const { players, turn } = get();
        const player = players[playerId];

        const { allowed, reason } = canPlayCard(card, player, turn);
        if (!allowed) {
          get().addLog(reason ?? 'No puedes jugar esa carta', 'error');
          return;
        }

        const withoutCard = player.hand.filter((c) => c.instanceId !== card.instanceId);
        let updated = { ...player, hand: withoutCard };

        switch (card.tipo) {
          // Cartas de oro → zona O (oros)
          case 'oro':
            updated = {
              ...updated,
              gold: [...player.gold, card],
              goldCount: player.goldCount + 1,
            };
            get().addLog(`${player.name} jugó ${card.nombre} (Oro +1).`);
            break;

          // Aliados → línea de defensa
          case 'aliado':
            updated = {
              ...updated,
              defenseField: [...player.defenseField, card],
              goldCount: player.goldCount - card.coste,
            };
            get().addLog(`${player.name} invocó a ${card.nombre} (${card.fuerza} ⚔).`);
            break;

          // Tótems → línea de apoyo (permanente)
          case 'totem':
            updated = {
              ...updated,
              supportField: [...player.supportField, card],
              goldCount: player.goldCount - card.coste,
            };
            get().addLog(`${player.name} colocó el tótem ${card.nombre} en la línea de apoyo.`);
            break;

          // Talismanes → efecto inmediato → cementerio
          case 'talisman':
            updated = {
              ...updated,
              graveyard: [...player.graveyard, card],
              goldCount: player.goldCount - card.coste,
            };
            get().addLog(
              `${player.name} activó ${card.nombre}: "${card.habilidad}" → va al cementerio.`,
              'action'
            );
            break;

          // Armas → se equipa al primer aliado libre en defensa
          case 'arma': {
            const freeAlly = player.defenseField.find(
              (c) => c.tipo === 'aliado' && !player.equippedWeapons[c.instanceId]
            );
            if (!freeAlly) {
              get().addLog('No hay aliado libre para equipar el arma.', 'error');
              return;
            }
            updated = {
              ...updated,
              goldCount: player.goldCount - card.coste,
              equippedWeapons: {
                ...player.equippedWeapons,
                [freeAlly.instanceId]: card,
              },
            };
            get().addLog(
              `${player.name} equipó ${card.nombre} a ${freeAlly.nombre} (+${card.bonusFuerza ?? 0} ⚔).`
            );
            break;
          }

          // Tierras → línea de apoyo
          case 'tierra':
            updated = {
              ...updated,
              supportField: [...player.supportField, card],
              goldCount: player.goldCount - card.coste,
            };
            get().addLog(`${player.name} jugó la tierra ${card.nombre}.`);
            break;
        }

        set((s) => ({
          players: { ...s.players, [playerId]: updated },
          turn: {
            ...s.turn,
            cardsPlayedThisTurn: s.turn.cardsPlayedThisTurn + 1,
            goldPlayedThisTurn:
              card.tipo === 'oro'
                ? s.turn.goldPlayedThisTurn + 1
                : s.turn.goldPlayedThisTurn,
          },
        }));

        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId });
      },

      // ── Equip weapon via drag-drop ────────────────────────────────────────
      equipWeapon: (weapon, allyInstanceId, playerId) => {
        const { players } = get();
        const player = players[playerId];

        if (weapon.coste > player.goldCount) {
          get().addLog(`Necesitas ${weapon.coste} de oro para equipar ${weapon.nombre}.`, 'error');
          return;
        }

        const newHand = player.hand.filter((c) => c.instanceId !== weapon.instanceId);
        const prevWeapon = player.equippedWeapons[allyInstanceId];
        const newGraveyard = prevWeapon ? [...player.graveyard, prevWeapon] : player.graveyard;
        const ally = player.defenseField.find((c) => c.instanceId === allyInstanceId);

        set((s) => ({
          players: {
            ...s.players,
            [playerId]: {
              ...s.players[playerId],
              hand: newHand,
              graveyard: newGraveyard,
              goldCount: s.players[playerId].goldCount - weapon.coste,
              equippedWeapons: {
                ...s.players[playerId].equippedWeapons,
                [allyInstanceId]: weapon,
              },
            },
          },
          turn: { ...s.turn, cardsPlayedThisTurn: s.turn.cardsPlayedThisTurn + 1 },
        }));

        get().addLog(
          `${player.name} equipó ${weapon.nombre} a ${ally?.nombre ?? 'aliado'} (+${weapon.bonusFuerza ?? 0} ⚔).`
        );
      },

      // ── Ally attacks → moves to attack line ───────────────────────────────
      attackWithAlly: (allyInstanceId, playerId) => {
        const { players, turn } = get();
        const player = players[playerId];

        if (turn.currentPlayer !== playerId) {
          get().addLog('No es tu turno.', 'error');
          return;
        }
        if (turn.phase !== 'batalla') {
          get().addLog('Solo puedes atacar en la Batalla Mitológica.', 'error');
          return;
        }

        const ally = player.defenseField.find((c) => c.instanceId === allyInstanceId);
        if (!ally) return;
        if (ally.attackedThisTurn) {
          get().addLog(`${ally.nombre} ya atacó este turno.`, 'error');
          return;
        }

        // Move ally from defense to attack line
        const newDefense = player.defenseField.filter((c) => c.instanceId !== allyInstanceId);
        const attackingAlly: CardInPlay = { ...ally, attackedThisTurn: true, tapped: true };

        set((s) => ({
          players: {
            ...s.players,
            [playerId]: {
              ...s.players[playerId],
              defenseField: newDefense,
              attackField: [...s.players[playerId].attackField, attackingAlly],
            },
          },
        }));

        const bonus = player.equippedWeapons[allyInstanceId]?.bonusFuerza ?? 0;
        get().addLog(
          `${player.name} ataca con ${ally.nombre} (${ally.fuerza + bonus} ⚔) → Línea de Ataque.`,
          'combat'
        );
      },

      // ── Tap / untap ───────────────────────────────────────────────────────
      tapCard: (instanceId, playerId) => {
        set((s) => ({
          players: {
            ...s.players,
            [playerId]: {
              ...s.players[playerId],
              defenseField: s.players[playerId].defenseField.map((c) =>
                c.instanceId === instanceId ? { ...c, tapped: !c.tapped } : c
              ),
            },
          },
        }));
      },

      // ── Advance phase ─────────────────────────────────────────────────────
      // Fases MYL: Agrupación → Vigilia → Batalla Mitológica → Fase Final
      advancePhase: () => {
        const phases: TurnPhase[] = ['agrupacion', 'vigilia', 'batalla', 'final'];
        const { turn } = get();
        const idx = phases.indexOf(turn.phase);
        const next = phases[idx + 1];

        if (!next) { get().endTurn(); return; }

        set((s) => ({ turn: { ...s.turn, phase: next } }));

        const LABELS: Record<TurnPhase, string> = {
          agrupacion: 'Agrupación',
          vigilia:    'Vigilia',
          batalla:    'Batalla Mitológica',
          final:      'Fase Final',
        };
        get().addLog(`Fase: ${LABELS[next]}`, 'system');
      },

      // ── End turn ──────────────────────────────────────────────────────────
      // Al cambiar de turno:
      //  1. Agrupación automática: todas las cartas del siguiente jugador se enderezan
      //  2. Se roba 1 carta del Mazo Castillo
      //  3. La fase inicia en 'vigilia'
      endTurn: () => {
        const { turn, players } = get();
        const nextId: PlayerId = turn.currentPlayer === 'player' ? 'opponent' : 'player';
        const nextTurn = nextId === 'player' ? turn.turnNumber + 1 : turn.turnNumber;
        const next = players[nextId];

        // Agrupación: todos los aliados del siguiente jugador se enderezan
        const allAllies = [...next.defenseField, ...next.attackField].map((c) => ({
          ...c,
          tapped: false,
          attackedThisTurn: false,
        }));

        set((s) => ({
          turn: {
            currentPlayer: nextId,
            phase: 'vigilia',
            turnNumber: nextTurn,
            cardsPlayedThisTurn: 0,
            goldPlayedThisTurn: 0,
          },
          isBoardRotating: false,
          players: {
            ...s.players,
            [nextId]: {
              ...next,
              defenseField: allAllies,
              attackField: [],
              drawnThisTurn: false,
            },
          },
        }));

        // Auto-draw from Mazo Castillo
        get().drawCard(nextId);
        get().addLog(`Turno ${nextTurn}: es el turno de ${players[nextId].name}.`, 'system');
      },

      initGame: () => set(buildInitialState()),
      resetGame: () => set(buildInitialState()),

      addLog: (msg, type = 'action') => {
        set((s) => ({
          gameLog: [createLogEntry(msg, type), ...s.gameLog].slice(0, 60),
        }));
      },
    }),
    { name: 'myl-game-store' }
  )
);
