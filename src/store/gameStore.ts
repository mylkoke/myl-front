import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { GameState, PlayerState, TurnPhase, PlayerId } from '@/types/game.types';
import type { CardInPlay, Card } from '@/types/card.types';
import { createCardInPlay, createCardsInPlay } from '@/utils/cardFactory';
import { shuffleDeck, drawCards } from '@/utils/deckUtils';
import {
  INITIAL_HAND_SIZE,
  canPlayCard,
  checkGameOver,
  hasMachinery,
  canDeclareAttack,
  hasIndestructible,
  hasBlockPunishment,
  hasCaudilloSummon,
  isSummonableByCaudillo,
  CAUDILLO_SUMMON_GOLD_COST,
  BLOCK_PUNISHMENT_MILL,
  GOLD_TALISMAN_YIELD,
  hasGoldTalismanAbility,
  annulBlockReason,
  controlsPatriota,
  effectiveForce,
  hasAnnulResponse,
  RESPONSE_WINDOW_MS,
  hasDrawDiscardGold,
  cannotLeavePlay,
  hasControlSwap,
  hasFinalPhaseRegroup,
  hasImbloqueable,
  hasMillDestroy,
  hasOroInicial,
  hasPlayFromGraveyard,
  hasRelampago,
  hasShuffleDraw,
  hasTalismanRecycle,
  MILL_DESTROY_COST,
  SHUFFLE_DRAW_COUNT,
  isBasicGold,
  hasWeakenAbility,
  TALISMAN_RECYCLE_DISCOUNT,
  WEAKEN_GOLD_COST,
  isHandOnly,
  resolveInteractiveCombat,
  strengthLockedFor,
} from '@/utils/gameRules';
import { createLogEntry } from '@/utils/gameLog';
import { STARTING_DECK_PLAYER, STARTING_DECK_OPPONENT } from '@/data/mockCards';

// ─── Builder ──────────────────────────────────────────────────────────────────

function buildInitialPlayer(id: PlayerId, name: string, rawDeck: Card[]): PlayerState {
  const shuffled = shuffleDeck(rawDeck);
  const { drawn, remaining } = drawCards(shuffled, INITIAL_HAND_SIZE);

  // Oro inicial: cada jugador comienza con un oro de su mazo ya jugado.
  // Regla: debe ser un ORO BÁSICO (sin habilidades) o tener la keyword
  // 'oro_inicial' (Escarapela Nacional), que autoriza la excepción. Se
  // prefiere el oro con la keyword si existe. Los 'solo_desde_mano' quedan
  // excluidos por tener habilidades.
  const keywordIdx = remaining.findIndex((c) => c.tipo === 'oro' && hasOroInicial(c));
  const initialGoldIdx =
    keywordIdx >= 0 ? keywordIdx : remaining.findIndex((c) => isBasicGold(c) && !isHandOnly(c));
  const initialGold = initialGoldIdx >= 0 ? remaining[initialGoldIdx] : null;
  const deck = initialGold
    ? remaining.filter((_, i) => i !== initialGoldIdx)
    : remaining;

  return {
    id,
    name,
    deck,
    hand: createCardsInPlay(drawn),
    defenseField: [],
    attackField: [],
    supportField: [],
    gold: initialGold ? [createCardInPlay(initialGold)] : [],
    goldPaid: [],
    graveyard: [],
    removed: [],
    exile: [],
    equippedWeapons: {},
    weaponTempBonuses: {},
    weaponAbilityUsedThisTurn: [],
    allyAbilityUsedThisTurn: [],
    weakenedAllies: [],
    life: deck.length,
    goldCount: initialGold ? 1 : 0,
    talismanGold: 0,
    drawnThisTurn: false,
    goldSpentThisTurn: false,
  };
}

export function buildInitialState(
  deckPlayer?: Card[],
  deckOpponent?: Card[],
  names?: { player: string; opponent: string },
): GameState {
  return {
    players: {
      player: buildInitialPlayer(
        'player',
        names?.player ?? 'Jugador',
        deckPlayer ?? STARTING_DECK_PLAYER,
      ),
      opponent: buildInitialPlayer(
        'opponent',
        names?.opponent ?? 'Oponente',
        deckOpponent ?? STARTING_DECK_OPPONENT,
      ),
    },
    turn: {
      currentPlayer: 'player',
      // El primer turno no tiene nada que reagrupar → arranca en Vigilia.
      phase: 'vigilia',
      turnNumber: 1,
      cardsPlayedThisTurn: 0,
      goldPlayedThisTurn: 0,
    },
    combat: null,
    selectedCard: null,
    isGameOver: false,
    winner: null,
    isBoardRotating: false,
    pendingDiscard: null,
    pendingShuffleChoice: null,
    pendingSwapChoice: null,
    responseWindow: null,
    fxLightning: null,
    gameLog: [
      createLogEntry('Cada jugador comienza con su oro inicial en juego.', 'system'),
      createLogEntry('¡Partida iniciada! Turno del Jugador — Vigilia.', 'system'),
    ],
  };
}

// ─── Actions interface ────────────────────────────────────────────────────────

type GameLogEntry = import('@/types/game.types').GameLogEntry;

interface GameActions {
  playCard: (card: CardInPlay, playerId: PlayerId) => void;
  equipWeapon: (weapon: CardInPlay, allyInstanceId: string, playerId: PlayerId) => void;
  /** Declara un ataque: mueve el aliado a la línea de ataque y abre la ventana de defensa. */
  declareAttack: (allyInstanceId: string, playerId: PlayerId) => void;
  /** El defensor declara bloqueo (aliado o null) → inicia la Guerra de Talismanes. */
  defendWith: (defenderInstanceId: string | null, playerId: PlayerId) => void;
  /** Guerra de Talismanes: el jugador activo pasa (2 pases seguidos = resolver). */
  passCombat: (playerId: PlayerId) => void;
  /** Guerra de Talismanes: el jugador activo juega un talismán. */
  playCombatTalisman: (card: CardInPlay, playerId: PlayerId) => void;
  /** Asignación de daño: resuelve el combate al terminar la Guerra de Talismanes. */
  resolveCombat: () => void;
  selectCard: (card: CardInPlay | null) => void;
  tapCard: (instanceId: string, playerId: PlayerId) => void;
  drawCard: (playerId: PlayerId) => void;
  advancePhase: () => void;
  endTurn: () => void;
  /** Mueve goldPaid → gold (disponible durante el turno del jugador) */
  regroupGold: (playerId: PlayerId) => void;
  /** Mueve todos los aliados de attackField → defenseField y los endereza */
  regroupAllies: (playerId: PlayerId) => void;
  setBoardRotating: (v: boolean) => void;
  initGame: (deckPlayer?: Card[], deckOpponent?: Card[]) => void;
  resetGame: () => void;
  /** El jugador indicado se rinde; su rival es declarado ganador. */
  surrender: (loserId: PlayerId) => void;
  /**
   * Activa la habilidad "poder_temporal" de un arma equipada:
   * paga 1 oro del jugador y suma +2 de fuerza al aliado portador hasta la Fase Final.
   */
  activateWeaponAbility: (weaponInstanceId: string, allyInstanceId: string, playerId: PlayerId) => void;
  /**
   * 'invocacion_caudillo': paga 3 oros y juega desde el Mazo Castillo un
   * aliado de la misma raza con coste ≤ 4, sin pagar su coste. 1 vez por turno.
   */
  summonCaudilloFromDeck: (sourceInstanceId: string, deckIndex: number, playerId: PlayerId) => void;
  /**
   * 'oro_talismanes' (Escudo Nacional): paga ese oro (va a la zona P) y genera
   * 2 oros virtuales que SOLO pagan talismanes. Activable durante el turno
   * propio o el del oponente; los oros virtuales expiran al terminar el turno.
   */
  activateGoldTalisman: (goldInstanceId: string, playerId: PlayerId) => void;
  /**
   * 'debilitar_aliado' (Manuel Baquedano): en tu Vigilia, paga 1 oro — el
   * aliado objetivo tiene Fuerza 0 hasta la Fase Final. Repetible.
   */
  weakenAlly: (
    sourceInstanceId: string,
    targetInstanceId: string,
    targetOwnerId: PlayerId,
    playerId: PlayerId,
  ) => void;
  /**
   * 'oro_robar_descartar' (Escarapela Nacional): paga ese oro (→ zona P) si
   * controlas al menos un aliado Patriota → roba 1 carta del Mazo Castillo y
   * deja un descarte obligatorio pendiente (pendingDiscard). Cualquier fase
   * y cualquier turno; 1 vez por turno vía ciclo de zonas.
   */
  activateGoldDrawDiscard: (goldInstanceId: string, playerId: PlayerId) => void;
  /** Resuelve el descarte obligatorio: carta de la mano → cementerio. */
  discardFromHand: (cardInstanceId: string, playerId: PlayerId) => void;
  /**
   * 'jugar_desde_cementerio': juega la carta desde el Cementerio o Destierro
   * propio como si estuviera en la mano, pagando su coste normal.
   */
  playFromZone: (
    cardInstanceId: string,
    zone: 'graveyard' | 'exile',
    playerId: PlayerId,
  ) => void;
  /**
   * 'talisman_reciclado': 1 vez por turno, juega un talismán desde tu
   * Cementerio o Destierro con coste −3 (mín. 0); tras resolverse va a la
   * zona de Removidas.
   */
  playRecycledTalisman: (
    sourceInstanceId: string,
    talismanInstanceId: string,
    playerId: PlayerId,
  ) => void;
  /**
   * 'botar3_destruye' (Balmaceda SP): bota 3 cartas de tu Mazo Castillo al
   * Cementerio para destruir un aliado objetivo (respeta 'indestructible' y
   * 'no_sale_del_juego').
   */
  millDestroyAlly: (
    sourceInstanceId: string,
    targetInstanceId: string,
    targetOwnerId: PlayerId,
    playerId: PlayerId,
  ) => void;
  /**
   * 'barajar_mano_roba8': resuelve la decisión — si acepta, baraja la mano
   * en el Mazo Castillo (orden aleatorio) y roba 8 cartas nuevas.
   */
  resolveShuffleChoice: (accept: boolean, playerId: PlayerId) => void;
  /** 'intercambio_control': cierra la decisión (la selección la abre la UI). */
  resolveSwapChoice: (accept: boolean, playerId: PlayerId) => void;
  /**
   * 'intercambio_control': intercambia el control de la carta origen por el
   * de una carta rival no-oro en juego, por el resto de la partida.
   */
  swapControl: (
    sourceInstanceId: string,
    targetInstanceId: string,
    targetOwnerId: PlayerId,
    playerId: PlayerId,
  ) => void;
  /**
   * 'anular_respuesta': durante la ventana de respuesta, juega el talismán
   * de anulación — la carta jugada se remueve del juego y el respondedor
   * roba tantas cartas como el coste de la carta anulada.
   */
  respondWithAnnul: (responseCardInstanceId: string, playerId: PlayerId) => void;
  /** El respondedor renuncia a responder: cierra la ventana de inmediato. */
  passResponse: (playerId: PlayerId) => void;
  /** Cierra la ventana de respuesta si ya expiró (idempotente). */
  closeResponseWindow: () => void;
  /** Replace the whole game state (online sync). */
  hydrateState: (state: GameState) => void;
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
              life: remaining.length,
            },
          },
        }));

        get().addLog(`${player.name} robó una carta del Mazo Castillo.`);
      },

      // ── Play a card from hand ─────────────────────────────────────────────
      playCard: (card, playerId) => {
        const { players, turn, responseWindow } = get();
        const player = players[playerId];

        if (responseWindow) {
          get().addLog('Espera: hay una ventana de respuesta abierta.', 'error');
          return;
        }
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
          case 'aliado': {
            const paid    = player.gold.slice(player.gold.length - card.coste);
            const remaining = player.gold.slice(0, player.gold.length - card.coste);
            updated = {
              ...updated,
              defenseField: [...player.defenseField, { ...card, summonedThisTurn: true }],
              gold:     remaining,
              goldPaid: [...player.goldPaid, ...paid],
              goldCount: remaining.length,
            };
            get().addLog(`${player.name} invocó a ${card.nombre} (${card.fuerza} ⚔).`);
            break;
          }

          // Tótems → línea de apoyo (permanente)
          case 'totem': {
            const paid    = player.gold.slice(player.gold.length - card.coste);
            const remaining = player.gold.slice(0, player.gold.length - card.coste);
            updated = {
              ...updated,
              supportField: [...player.supportField, card],
              gold:     remaining,
              goldPaid: [...player.goldPaid, ...paid],
              goldCount: remaining.length,
            };
            get().addLog(`${player.name} colocó el tótem ${card.nombre} en la línea de apoyo.`);
            break;
          }

          // Talismanes → efecto inmediato → cementerio
          case 'talisman': {
            // Se pagan primero con oros virtuales 'oro_talismanes' (si hay).
            const fromVirtual = Math.min(player.talismanGold, card.coste);
            const fromCards   = card.coste - fromVirtual;
            const paid    = player.gold.slice(player.gold.length - fromCards);
            const remaining = player.gold.slice(0, player.gold.length - fromCards);
            updated = {
              ...updated,
              graveyard: [...player.graveyard, card],
              gold:     remaining,
              goldPaid: [...player.goldPaid, ...paid],
              goldCount: remaining.length,
              talismanGold: player.talismanGold - fromVirtual,
            };
            get().addLog(
              `${player.name} activó ${card.nombre}: "${card.habilidad}" → va al cementerio.`,
              'action'
            );
            break;
          }

          // Armas: con "maquinaria" se juegan en apoyo como un tótem;
          // sin ella deben equiparse a un aliado específico (equipWeapon).
          case 'arma': {
            if (!hasMachinery(card)) {
              get().addLog(
                'Las armas deben equiparse a un aliado (arrástrala sobre él).',
                'error'
              );
              return;
            }
            const paid    = player.gold.slice(player.gold.length - card.coste);
            const remaining = player.gold.slice(0, player.gold.length - card.coste);
            updated = {
              ...updated,
              supportField: [...player.supportField, card],
              gold:     remaining,
              goldPaid: [...player.goldPaid, ...paid],
              goldCount: remaining.length,
            };
            get().addLog(
              `${player.name} jugó la maquinaria ${card.nombre} en la línea de apoyo.`
            );
            break;
          }
        }

        const paidGold = card.tipo !== 'oro' && card.coste > 0;
        set((s) => ({
          players: {
            ...s.players,
            [playerId]: paidGold
              ? { ...updated, goldSpentThisTurn: true }
              : updated,
          },
          turn: {
            ...s.turn,
            cardsPlayedThisTurn: s.turn.cardsPlayedThisTurn + 1,
            goldPlayedThisTurn: card.tipo === 'oro'
              ? s.turn.goldPlayedThisTurn + 1
              : s.turn.goldPlayedThisTurn,
          },
        }));

        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId });

        // ── Ventana de respuesta: tras jugar un Aliado o Talismán, el
        // oponente tiene 10 s para responder con un talismán de anulación.
        if (!get().isGameOver && (card.tipo === 'aliado' || card.tipo === 'talisman')) {
          const responderId: PlayerId = playerId === 'player' ? 'opponent' : 'player';
          set({
            responseWindow: {
              cardInstanceId: card.instanceId,
              cardName: card.nombre,
              cardCoste: card.coste,
              cardOwnerId: playerId,
              responderId,
              expiresAt: Date.now() + RESPONSE_WINDOW_MS,
            },
          });
        }

        // 'barajar_mano_roba8': al entrar en juego, su dueño decide si baraja
        // su mano en el Castillo y roba 8.
        if (!get().isGameOver && card.tipo === 'aliado' && hasShuffleDraw(card)) {
          set({ pendingShuffleChoice: { playerId, cardName: card.nombre } });
        }

        // 'intercambio_control': al entrar en juego, su dueño decide si
        // intercambia su control con una carta rival no-oro.
        if (!get().isGameOver && card.tipo === 'aliado' && hasControlSwap(card)) {
          set({
            pendingSwapChoice: {
              playerId,
              cardInstanceId: card.instanceId,
              cardName: card.nombre,
            },
          });
        }

        // FX de Relámpago: la carta se jugó a velocidad de respuesta (fuera
        // de la Vigilia propia) gracias a la keyword.
        if (
          hasRelampago(card) &&
          (turn.currentPlayer !== playerId || turn.phase !== 'vigilia')
        ) {
          set({ fxLightning: Date.now() });
        }
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

        set((s) => {
          const p = s.players[playerId];
          const paid      = p.gold.slice(p.gold.length - weapon.coste);
          const remaining = p.gold.slice(0, p.gold.length - weapon.coste);
          return {
            players: {
              ...s.players,
              [playerId]: {
                ...p,
                hand: newHand,
                graveyard: newGraveyard,
                gold:     remaining,
                goldPaid: [...p.goldPaid, ...paid],
                goldCount: remaining.length,
                equippedWeapons: {
                  ...p.equippedWeapons,
                  [allyInstanceId]: weapon,
                },
              },
            },
            turn: { ...s.turn, cardsPlayedThisTurn: s.turn.cardsPlayedThisTurn + 1 },
          };
        });

        get().addLog(
          `${player.name} equipó ${weapon.nombre} a ${ally?.nombre ?? 'aliado'} (+${weapon.bonusFuerza ?? 0} ⚔).`
        );
      },

      // ── Declare attack: defense → attack line + open defense window ───────
      declareAttack: (allyInstanceId, playerId) => {
        const { players, turn, combat, responseWindow } = get();
        const player = players[playerId];

        if (responseWindow) {
          get().addLog('Espera: hay una ventana de respuesta abierta.', 'error');
          return;
        }
        if (combat) {
          get().addLog('Ya hay un combate en curso.', 'error');
          return;
        }
        const ally = player.defenseField.find((c) => c.instanceId === allyInstanceId);
        if (!ally) return;

        const { allowed, reason } = canDeclareAttack(ally, turn, playerId);
        if (!allowed) {
          get().addLog(reason ?? 'No puedes atacar con ese aliado.', 'error');
          return;
        }

        const defenderId: PlayerId = playerId === 'player' ? 'opponent' : 'player';
        const attackingAlly: CardInPlay = { ...ally, attackedThisTurn: true, tapped: true };
        const attackForce = effectiveForce(ally, player, players);

        // Declaring an attack jumps the game straight into the battle phase.
        set((s) => ({
          turn: { ...s.turn, phase: 'batalla' },
          combat: {
            attackerId: playerId,
            attackerInstanceId: allyInstanceId,
            defenderInstanceId: null,
            status: 'awaiting_defense',
            activePlayer: defenderId,
            consecutivePasses: 0,
          },
          players: {
            ...s.players,
            [playerId]: {
              ...s.players[playerId],
              defenseField: s.players[playerId].defenseField.filter(
                (c) => c.instanceId !== allyInstanceId
              ),
              attackField: [...s.players[playerId].attackField, attackingAlly],
            },
          },
        }));

        get().addLog(
          `${player.name} ataca con ${ally.nombre} (${attackForce} ⚔). ${players[defenderId].name} puede defender.`,
          'combat'
        );

        // No defenders available → resolve immediately as undefended.
        if (players[defenderId].defenseField.length === 0) {
          get().defendWith(null, defenderId);
        }
      },

      // ── Defender chooses an ally (or null) → combat resolution ────────────
      // ── Declaración de bloqueo → inicia la Guerra de Talismanes ───────────
      // El defensor elige un aliado (o null = no defender). NO se resuelve el
      // daño todavía: se pasa a la sub-fase 'talisman_war', donde ambos
      // jugadores pueden jugar talismanes/habilidades empezando por el defensor.
      defendWith: (defenderInstanceId, playerId) => {
        const { players, combat, responseWindow } = get();
        if (responseWindow) {
          get().addLog('Espera: hay una ventana de respuesta abierta.', 'error');
          return;
        }
        if (!combat || combat.status !== 'awaiting_defense') return;

        const defenderId: PlayerId = combat.attackerId === 'player' ? 'opponent' : 'player';
        if (playerId !== defenderId) {
          get().addLog('Solo el jugador atacado puede defender.', 'error');
          return;
        }

        const defenderPlayer = players[defenderId];

        // 'imbloqueable': no se puede declarar bloqueador contra este atacante.
        const attackingCard = players[combat.attackerId].attackField.find(
          (c) => c.instanceId === combat.attackerInstanceId
        );
        if (defenderInstanceId && attackingCard && hasImbloqueable(attackingCard)) {
          get().addLog(`${attackingCard.nombre} es Imbloqueable: no puede ser bloqueado.`, 'error');
          return;
        }

        const blocker = defenderInstanceId
          ? defenderPlayer.defenseField.find((c) => c.instanceId === defenderInstanceId) ?? null
          : null;

        set({
          combat: {
            ...combat,
            defenderInstanceId: blocker ? defenderInstanceId : null,
            status: 'talisman_war',
            activePlayer: defenderId,
            consecutivePasses: 0,
          },
        });

        get().addLog(
          blocker
            ? `${defenderPlayer.name} bloquea con ${blocker.nombre}.`
            : `${defenderPlayer.name} no declara bloqueo.`,
          'combat'
        );

        // 'castigo_bloqueo': si el atacante tiene la habilidad y fue bloqueado,
        // el defensor bota 6 cartas de su Mazo Castillo al Cementerio.
        const attackerCard = players[combat.attackerId].attackField.find(
          (c) => c.instanceId === combat.attackerInstanceId
        );
        if (blocker && attackerCard && hasBlockPunishment(attackerCard)) {
          const milled = Math.min(BLOCK_PUNISHMENT_MILL, defenderPlayer.deck.length);
          if (milled > 0) {
            const lost = defenderPlayer.deck.slice(0, milled).map(createCardInPlay);
            set((s) => ({
              players: {
                ...s.players,
                [defenderId]: {
                  ...s.players[defenderId],
                  deck: s.players[defenderId].deck.slice(milled),
                  graveyard: [...s.players[defenderId].graveyard, ...lost],
                  life: s.players[defenderId].deck.length - milled,
                },
              },
            }));
            get().addLog(
              `${attackerCard.nombre} fue bloqueado: ${defenderPlayer.name} bota ${milled} carta(s) de su Mazo Castillo al Cementerio.`,
              'combat'
            );
            const { isOver, winnerId } = checkGameOver(get().players);
            if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId });
          }
        }
        get().addLog(
          `Guerra de Talismanes: ${defenderPlayer.name} puede jugar talismanes o pasar.`,
          'combat'
        );
      },

      // ── Guerra de Talismanes: pasar ───────────────────────────────────────
      // Si ambos jugadores pasan consecutivamente, se asigna el daño.
      passCombat: (playerId) => {
        const { players, combat } = get();
        if (!combat || combat.status !== 'talisman_war') return;
        if (playerId !== combat.activePlayer) {
          get().addLog('No es tu turno en la Guerra de Talismanes.', 'error');
          return;
        }

        const passes = combat.consecutivePasses + 1;
        if (passes >= 2) {
          get().addLog('Ambos jugadores pasan: se asigna el daño.', 'combat');
          get().resolveCombat();
          return;
        }

        const other: PlayerId = playerId === 'player' ? 'opponent' : 'player';
        set({ combat: { ...combat, consecutivePasses: passes, activePlayer: other } });
        get().addLog(`${players[playerId].name} pasa. Turno de ${players[other].name}.`, 'combat');
      },

      // ── Guerra de Talismanes: jugar un talismán ───────────────────────────
      // El jugador activo paga su coste; el talismán va al cementerio. Reinicia
      // el contador de pases y cede el turno al oponente.
      playCombatTalisman: (card, playerId) => {
        const { players, combat } = get();
        if (!combat || combat.status !== 'talisman_war') return;
        if (playerId !== combat.activePlayer) {
          get().addLog('No es tu turno en la Guerra de Talismanes.', 'error');
          return;
        }
        if (card.tipo !== 'talisman') {
          get().addLog('En la Guerra de Talismanes solo puedes jugar talismanes.', 'error');
          return;
        }
        const player = players[playerId];
        if (card.coste > player.goldCount + player.talismanGold) {
          get().addLog(`Necesitas ${card.coste} de oro para jugar ${card.nombre}.`, 'error');
          return;
        }

        const withoutCard = player.hand.filter((c) => c.instanceId !== card.instanceId);
        // Se pagan primero con oros virtuales 'oro_talismanes' (si hay).
        const fromVirtual = Math.min(player.talismanGold, card.coste);
        const fromCards   = card.coste - fromVirtual;
        const paid      = player.gold.slice(player.gold.length - fromCards);
        const remaining = player.gold.slice(0, player.gold.length - fromCards);
        const other: PlayerId = playerId === 'player' ? 'opponent' : 'player';

        set((s) => ({
          players: {
            ...s.players,
            [playerId]: {
              ...player,
              hand: withoutCard,
              graveyard: [...player.graveyard, card],
              gold:      remaining,
              goldPaid:  [...player.goldPaid, ...paid],
              goldCount: remaining.length,
              talismanGold: player.talismanGold - fromVirtual,
              goldSpentThisTurn: fromCards > 0 ? true : player.goldSpentThisTurn,
            },
          },
          combat: { ...combat, consecutivePasses: 0, activePlayer: other },
        }));

        get().addLog(
          `${player.name} juega ${card.nombre} en la Guerra de Talismanes: "${card.habilidad}". Turno de ${players[other].name}.`,
          'combat'
        );
      },

      // ── Asignación de daño (fin de la Guerra de Talismanes) ───────────────
      resolveCombat: () => {
        const { players, combat } = get();
        if (!combat) return;

        const defenderId: PlayerId = combat.attackerId === 'player' ? 'opponent' : 'player';
        const attackerPlayer = players[combat.attackerId];
        const defenderPlayer = players[defenderId];

        const attacker = attackerPlayer.attackField.find(
          (c) => c.instanceId === combat.attackerInstanceId
        );
        if (!attacker) {
          set({ combat: null });
          return;
        }

        const defender = combat.defenderInstanceId
          ? defenderPlayer.defenseField.find((c) => c.instanceId === combat.defenderInstanceId) ?? null
          : null;

        // Fuerza efectiva (bonos de arma/temporales, 'fuerza_inmutable',
        // 'debilitar_aliado') centralizada en effectiveForce.
        const atkForce = effectiveForce(attacker, attackerPlayer, players);
        const defForce = defender ? effectiveForce(defender, defenderPlayer, players) : null;

        const outcome = resolveInteractiveCombat(atkForce, defForce);

        // Destroys an ally: card + equipped weapon go to its owner's graveyard.
        // 'Indestructible' allies survive destruction and stay on the table.
        const destroyAlly = (owner: PlayerState, instanceId: string): PlayerState => {
          const inAttack = owner.attackField.find((c) => c.instanceId === instanceId);
          const inDefense = owner.defenseField.find((c) => c.instanceId === instanceId);
          const card = inAttack ?? inDefense;
          if (!card) return owner;
          // 'indestructible' sobrevive a la destrucción; 'no_sale_del_juego'
          // no puede abandonar el campo por ningún medio.
          if (hasIndestructible(card) || cannotLeavePlay(card)) return owner;
          const weapon = owner.equippedWeapons[instanceId];
          const { [instanceId]: _, ...restWeapons } = owner.equippedWeapons;
          return {
            ...owner,
            attackField: owner.attackField.filter((c) => c.instanceId !== instanceId),
            defenseField: owner.defenseField.filter((c) => c.instanceId !== instanceId),
            graveyard: [...owner.graveyard, card, ...(weapon ? [weapon] : [])],
            equippedWeapons: restWeapons,
          };
        };

        let newAttacker = attackerPlayer;
        let newDefender = defenderPlayer;

        if (outcome.attackerDestroyed) {
          newAttacker = destroyAlly(newAttacker, attacker.instanceId);
        }
        if (outcome.defenderDestroyed && defender) {
          newDefender = destroyAlly(newDefender, defender.instanceId);
        }
        if (outcome.deckDamage > 0) {
          const damaged = Math.min(outcome.deckDamage, newDefender.deck.length);
          const lost = newDefender.deck.slice(0, damaged).map(createCardInPlay);
          newDefender = {
            ...newDefender,
            deck: newDefender.deck.slice(damaged),
            graveyard: [...newDefender.graveyard, ...lost],
            life: newDefender.deck.length - damaged,
          };
        }

        set((s) => ({
          combat: null,
          players: {
            ...s.players,
            [combat.attackerId]: newAttacker,
            [defenderId]: newDefender,
          },
        }));


        // Combat log
        if (!defender) {
          get().addLog(
            `${defenderPlayer.name} no defendió: ${outcome.deckDamage} carta(s) del Mazo Castillo van al cementerio.`,
            'combat'
          );
        } else if (outcome.attackerDestroyed && outcome.defenderDestroyed) {
          const atkFate = hasIndestructible(attacker) ? `${attacker.nombre} sobrevive (Indestructible)` : `${attacker.nombre} es destruido`;
          const defFate = hasIndestructible(defender) ? `${defender.nombre} sobrevive (Indestructible)` : `${defender.nombre} es destruido`;
          get().addLog(`Empate ${atkForce} ⚔ ${defForce}: ${atkFate}; ${defFate}.`, 'combat');
        } else if (outcome.defenderDestroyed) {
          const defFate = hasIndestructible(defender) ? 'el defensor sobrevive (Indestructible)' : 'defensor destruido';
          get().addLog(
            `${attacker.nombre} (${atkForce}) vence a ${defender.nombre} (${defForce}): ${defFate} y ${outcome.deckDamage} carta(s) del mazo de ${defenderPlayer.name} al cementerio.`,
            'combat'
          );
        } else {
          const atkFate = hasIndestructible(attacker) ? 'el atacante sobrevive (Indestructible)' : 'atacante destruido';
          get().addLog(
            `${defender.nombre} (${defForce}) detiene a ${attacker.nombre} (${atkForce}): ${atkFate}.`,
            'combat'
          );
        }

        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId });
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

      // ── Regroup gold ──────────────────────────────────────────────────────
      // Mueve todas las cartas de goldPaid → gold, restaurando los oros disponibles.
      regroupGold: (playerId) => {
        const { players, turn } = get();
        const player = players[playerId];

        if (turn.currentPlayer !== playerId) {
          get().addLog('No es tu turno.', 'error');
          return;
        }
        if (turn.phase !== 'agrupacion') {
          get().addLog('Solo puedes reagrupar durante la fase de Agrupación.', 'error');
          return;
        }
        if (player.goldPaid.length === 0) return;

        const newGold = [...player.gold, ...player.goldPaid];

        set((s) => ({
          players: {
            ...s.players,
            [playerId]: {
              ...s.players[playerId],
              gold:     newGold,
              goldPaid: [],
              goldCount: newGold.length,
            },
          },
        }));

        get().addLog(
          `${player.name} reagrupó ${player.goldPaid.length} oro(s). Disponibles: ${newGold.length}.`
        );

        // Si ya no queda nada por reagrupar, la Agrupación terminó → Vigilia.
        if (player.attackField.length === 0) {
          set((s) => ({ turn: { ...s.turn, phase: 'vigilia' } }));
          get().addLog('Nada más que reagrupar — Fase: Vigilia.', 'system');
        }
      },

      // ── Regroup allies ────────────────────────────────────────────────────
      // Mueve los aliados de la línea de ataque → línea de defensa y los endereza.
      regroupAllies: (playerId) => {
        const { players, turn } = get();
        const player = players[playerId];

        if (turn.currentPlayer !== playerId) {
          get().addLog('No es tu turno.', 'error');
          return;
        }
        if (turn.phase !== 'agrupacion') {
          get().addLog('Solo puedes reagrupar durante la fase de Agrupación.', 'error');
          return;
        }
        if (player.attackField.length === 0) return;

        const count = player.attackField.length;
        const returned = player.attackField.map((c) => ({
          ...c,
          tapped: false,
          attackedThisTurn: false,
        }));
        const untappedDefense = player.defenseField.map((c) => ({
          ...c,
          tapped: false,
        }));

        set((s) => ({
          players: {
            ...s.players,
            [playerId]: {
              ...s.players[playerId],
              defenseField: [...untappedDefense, ...returned],
              attackField: [],
            },
          },
        }));

        get().addLog(
          `${player.name} reagrupó ${count} aliado(s) a la línea de defensa.`
        );

        // Si ya no queda nada por reagrupar, la Agrupación terminó → Vigilia.
        if (player.goldPaid.length === 0) {
          set((s) => ({ turn: { ...s.turn, phase: 'vigilia' } }));
          get().addLog('Nada más que reagrupar — Fase: Vigilia.', 'system');
        }
      },

      // ── Advance phase ─────────────────────────────────────────────────────
      // Fases MYL: Agrupación → Vigilia → Batalla Mitológica → Fase Final
      advancePhase: () => {
        if (get().responseWindow) {
          get().addLog('Espera: hay una ventana de respuesta abierta.', 'error');
          return;
        }
        if (get().combat) {
          get().addLog('Hay un combate pendiente: primero se debe defender.', 'error');
          return;
        }
        const phases: TurnPhase[] = ['agrupacion', 'vigilia', 'batalla', 'final'];
        const { turn } = get();
        const idx = phases.indexOf(turn.phase);
        const next = phases[idx + 1];

        if (!next) { get().endTurn(); return; }

        set((s) => ({ turn: { ...s.turn, phase: next } }));

        // 'agrupar_fase_final' (Balmaceda SP): al comenzar CADA Fase Final,
        // los jugadores que controlen una carta con la habilidad reagrupan
        // todo lo suyo (oros pagados → reserva; atacantes → defensa, listos).
        if (next === 'final') {
          for (const pid of ['player', 'opponent'] as PlayerId[]) {
            const p = get().players[pid];
            const hasRegrouper = [...p.defenseField, ...p.attackField].some(
              hasFinalPhaseRegroup
            );
            if (!hasRegrouper) continue;
            const regrouperName = [...p.defenseField, ...p.attackField].find(
              hasFinalPhaseRegroup
            )!.nombre;
            set((s) => {
              const pl = s.players[pid];
              const newGold = [...pl.gold, ...pl.goldPaid];
              const returned = pl.attackField.map((c) => ({
                ...c,
                tapped: false,
                attackedThisTurn: false,
              }));
              return {
                players: {
                  ...s.players,
                  [pid]: {
                    ...pl,
                    gold: newGold,
                    goldPaid: [],
                    goldCount: newGold.length,
                    defenseField: [
                      ...pl.defenseField.map((c) => ({ ...c, tapped: false })),
                      ...returned,
                    ],
                    attackField: [],
                  },
                },
              };
            });
            get().addLog(
              `${regrouperName}: ${p.name} agrupa todas sus cartas al comenzar la Fase Final.`,
              'action'
            );
          }
        }

        const LABELS: Record<TurnPhase, string> = {
          agrupacion: 'Agrupación',
          vigilia:    'Vigilia',
          batalla:    'Batalla Mitológica',
          final:      'Fase Final',
        };
        get().addLog(`Fase: ${LABELS[next]}`, 'system');

      },

      // ── End turn ──────────────────────────────────────────────────────────
      // Al finalizar el turno:
      //  1. El jugador actual roba 1 carta de su Mazo Castillo
      //  2. El turno pasa al siguiente jugador. Si tiene algo que reagrupar
      //     (oro pagado o aliados en ataque) arranca en 'agrupacion'; si no,
      //     se salta directo a 'vigilia' para evitar un paso vacío.
      endTurn: () => {
        if (get().responseWindow) {
          get().addLog('Espera: hay una ventana de respuesta abierta.', 'error');
          return;
        }
        if (get().combat) {
          get().addLog('Hay un combate pendiente: primero se debe defender.', 'error');
          return;
        }
        const { turn, players } = get();
        const currentId = turn.currentPlayer;
        const nextId: PlayerId = currentId === 'player' ? 'opponent' : 'player';
        const nextTurn = nextId === 'player' ? turn.turnNumber + 1 : turn.turnNumber;

        const current = players[currentId];
        const next    = players[nextId];

        const nextHasRegroup = next.goldPaid.length > 0 || next.attackField.length > 0;
        const nextPhase: TurnPhase = nextHasRegroup ? 'agrupacion' : 'vigilia';

        // Robar 1 carta del Mazo Castillo para el jugador que finaliza su turno
        let updatedCurrent = current;
        let drewCard = false;
        if (current.deck.length > 0) {
          const { drawn, remaining } = drawCards(current.deck, 1);
          const newCard = createCardInPlay(drawn[0]);
          updatedCurrent = {
            ...current,
            deck: remaining,
            hand: [...current.hand, newCard],
            drawnThisTurn: true,
            life: remaining.length,
          };
          drewCard = true;
        }

        set((s) => ({
          turn: {
            currentPlayer: nextId,
            phase: nextPhase,
            turnNumber: nextTurn,
            cardsPlayedThisTurn: 0,
            goldPlayedThisTurn: 0,
          },
          isBoardRotating: false,
          players: {
            ...s.players,
            [currentId]: {
              ...updatedCurrent,
              weaponTempBonuses: {},
              // Los oros virtuales 'oro_talismanes' expiran al terminar el turno.
              talismanGold: 0,
              // 'debilitar_aliado' dura "hasta la Fase Final": expira aquí.
              weakenedAllies: [],
            },
            [nextId]: {
              ...next,
              drawnThisTurn: false,
              goldSpentThisTurn: false,
              talismanGold: 0,
              weaponTempBonuses: {},
              weaponAbilityUsedThisTurn: [],
              allyAbilityUsedThisTurn: [],
              weakenedAllies: [],
              // Los aliados que entraron el turno anterior ya llevan en juego
              // desde esta Agrupación: pueden atacar este turno.
              defenseField: next.defenseField.map((c) => ({ ...c, summonedThisTurn: false })),
              attackField: next.attackField.map((c) => ({ ...c, summonedThisTurn: false })),
            },
          },
        }));

        if (drewCard) {
          get().addLog(`${current.name} robó una carta del Mazo Castillo al finalizar su turno.`);
        } else {
          get().addLog(`${current.name}: ¡Mazo Castillo vacío! No se robó carta.`, 'system');
        }
        get().addLog(
          `Turno ${nextTurn}: turno de ${players[nextId].name} — ${nextPhase === 'agrupacion' ? 'Agrupación' : 'Vigilia'}.`,
          'system'
        );
      },

      initGame: (deckPlayer, deckOpponent) => set(buildInitialState(deckPlayer, deckOpponent)),
      resetGame: () => set(buildInitialState()),

      surrender: (loserId) => {
        const winnerId: PlayerId = loserId === 'player' ? 'opponent' : 'player';
        const loserName = get().players[loserId].name;
        get().addLog(`${loserName} se ha rendido.`, 'system');
        set({ isGameOver: true, winner: winnerId, combat: null });
      },

      activateWeaponAbility: (weaponInstanceId, allyInstanceId, playerId) => {
        const player = get().players[playerId];
        if (strengthLockedFor(playerId, get().players)) {
          get().addLog(
            'Una carta rival en juego impide modificar la Fuerza de tus aliados.',
            'error'
          );
          return;
        }
        if (player.goldCount < 1) {
          get().addLog('No tienes oro suficiente para activar esta habilidad.', 'error');
          return;
        }
        if (player.weaponAbilityUsedThisTurn.includes(weaponInstanceId)) {
          get().addLog('Esta habilidad ya fue usada este turno.', 'error');
          return;
        }
        // Pagar 1 oro: mover el último oro disponible a goldPaid
        const paid = player.gold[player.gold.length - 1];
        const newGold = player.gold.slice(0, -1);
        const weapon = player.equippedWeapons[allyInstanceId];
        const weaponName = weapon?.nombre ?? 'El arma';
        set((s) => ({
          players: {
            ...s.players,
            [playerId]: {
              ...s.players[playerId],
              gold: newGold,
              goldPaid: [...s.players[playerId].goldPaid, paid],
              goldCount: s.players[playerId].goldCount - 1,
              weaponTempBonuses: {
                ...s.players[playerId].weaponTempBonuses,
                [allyInstanceId]: (s.players[playerId].weaponTempBonuses[allyInstanceId] ?? 0) + 2,
              },
              weaponAbilityUsedThisTurn: [
                ...s.players[playerId].weaponAbilityUsedThisTurn,
                weaponInstanceId,
              ],
            },
          },
        }));
        get().addLog(`${weaponName}: ¡el portador gana +2 de Fuerza hasta la Fase Final!`, 'action');
      },

      activateGoldTalisman: (goldInstanceId, playerId) => {
        const { players, isGameOver } = get();
        if (isGameOver) return;
        const player = players[playerId];
        const goldCard = player.gold.find((c) => c.instanceId === goldInstanceId);
        if (!goldCard || !hasGoldTalismanAbility(goldCard)) return;

        // Sin restricción de turno: la habilidad es activable también en el
        // turno del oponente (el propietario decide cuándo pagar su oro).
        set((s) => {
          const p = s.players[playerId];
          const remaining = p.gold.filter((c) => c.instanceId !== goldInstanceId);
          return {
            players: {
              ...s.players,
              [playerId]: {
                ...p,
                gold: remaining,
                goldPaid: [...p.goldPaid, goldCard],
                goldCount: remaining.length,
                talismanGold: p.talismanGold + GOLD_TALISMAN_YIELD,
                goldSpentThisTurn: true,
              },
            },
          };
        });
        get().addLog(
          `${player.name} pagó ${goldCard.nombre}: genera ${GOLD_TALISMAN_YIELD} Oros que solo pueden pagar Talismanes (hasta el final del turno).`,
          'action'
        );
      },

      activateGoldDrawDiscard: (goldInstanceId, playerId) => {
        const { players, isGameOver, pendingDiscard } = get();
        if (isGameOver || pendingDiscard) return;
        const player = players[playerId];
        const goldCard = player.gold.find((c) => c.instanceId === goldInstanceId);
        if (!goldCard || !hasDrawDiscardGold(goldCard)) return;

        if (!controlsPatriota(player)) {
          get().addLog('Necesitas controlar al menos un Aliado Patriota.', 'error');
          return;
        }
        if (player.deck.length === 0) {
          get().addLog('No quedan cartas en tu Mazo Castillo para robar.', 'error');
          return;
        }

        // Pagar el oro (→ zona P), robar 1 del Mazo Castillo y dejar el
        // descarte obligatorio pendiente. Sin restricción de turno/fase.
        const { drawn, remaining: newDeck } = drawCards(player.deck, 1);
        const drawnCard = createCardInPlay(drawn[0]);
        set((s) => {
          const p = s.players[playerId];
          const remainingGold = p.gold.filter((c) => c.instanceId !== goldInstanceId);
          return {
            pendingDiscard: playerId,
            players: {
              ...s.players,
              [playerId]: {
                ...p,
                gold: remainingGold,
                goldPaid: [...p.goldPaid, goldCard],
                goldCount: remainingGold.length,
                goldSpentThisTurn: true,
                deck: newDeck,
                hand: [...p.hand, drawnCard],
                life: newDeck.length,
              },
            },
          };
        });
        get().addLog(
          `${player.name} pagó ${goldCard.nombre}: roba 1 carta y debe descartar 1 carta de su mano.`,
          'action'
        );
        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId, pendingDiscard: null });
      },

      discardFromHand: (cardInstanceId, playerId) => {
        const { players, pendingDiscard } = get();
        if (pendingDiscard !== playerId) return;
        const player = players[playerId];
        const card = player.hand.find((c) => c.instanceId === cardInstanceId);
        if (!card) return;
        set((s) => {
          const p = s.players[playerId];
          return {
            pendingDiscard: null,
            players: {
              ...s.players,
              [playerId]: {
                ...p,
                hand: p.hand.filter((c) => c.instanceId !== cardInstanceId),
                graveyard: [...p.graveyard, card],
              },
            },
          };
        });
        get().addLog(`${player.name} descartó ${card.nombre}.`, 'action');
      },

      playFromZone: (cardInstanceId, zone, playerId) => {
        const { players, turn, combat, responseWindow } = get();
        const player = players[playerId];
        if (responseWindow) {
          get().addLog('Espera: hay una ventana de respuesta abierta.', 'error');
          return;
        }
        if (combat) {
          get().addLog('Hay un combate en curso.', 'error');
          return;
        }
        const card = player[zone].find((c) => c.instanceId === cardInstanceId);
        if (!card || !hasPlayFromGraveyard(card)) return;

        // Mismas reglas que jugar desde la mano (turno, fase, coste, líneas).
        const { allowed, reason } = canPlayCard(card, player, turn);
        if (!allowed) {
          get().addLog(reason ?? 'No puedes jugar esa carta ahora.', 'error');
          return;
        }
        if (card.tipo !== 'aliado') {
          get().addLog('Solo los aliados pueden jugarse así por ahora.', 'error');
          return;
        }

        const paid = player.gold.slice(player.gold.length - card.coste);
        const remaining = player.gold.slice(0, player.gold.length - card.coste);
        set((s) => {
          const p = s.players[playerId];
          return {
            players: {
              ...s.players,
              [playerId]: {
                ...p,
                [zone]: p[zone].filter((c) => c.instanceId !== cardInstanceId),
                defenseField: [...p.defenseField, { ...card, summonedThisTurn: true, tapped: false }],
                gold: remaining,
                goldPaid: [...p.goldPaid, ...paid],
                goldCount: remaining.length,
                goldSpentThisTurn: card.coste > 0 ? true : p.goldSpentThisTurn,
              },
            },
            turn: { ...s.turn, cardsPlayedThisTurn: s.turn.cardsPlayedThisTurn + 1 },
          };
        });
        get().addLog(
          `${player.name} juega a ${card.nombre} desde ${zone === 'graveyard' ? 'su Cementerio' : 'su Destierro'} (−${card.coste} Oros).`,
          'action'
        );

        // La carta jugada abre la ventana de respuesta normal.
        const responderId: PlayerId = playerId === 'player' ? 'opponent' : 'player';
        set({
          responseWindow: {
            cardInstanceId: card.instanceId,
            cardName: card.nombre,
            cardCoste: card.coste,
            cardOwnerId: playerId,
            responderId,
            expiresAt: Date.now() + RESPONSE_WINDOW_MS,
          },
        });

        // 'barajar_mano_roba8': también aplica al entrar desde estas zonas.
        if (hasShuffleDraw(card)) {
          set({ pendingShuffleChoice: { playerId, cardName: card.nombre } });
        }
      },

      playRecycledTalisman: (sourceInstanceId, talismanInstanceId, playerId) => {
        const { players, turn, combat, responseWindow } = get();
        const player = players[playerId];
        if (responseWindow || combat) {
          get().addLog('No puedes activar esta habilidad ahora.', 'error');
          return;
        }
        if (turn.currentPlayer !== playerId || turn.phase !== 'vigilia') {
          get().addLog('Esta habilidad solo puede activarse en tu Vigilia.', 'error');
          return;
        }
        const source = [...player.defenseField, ...player.attackField].find(
          (c) => c.instanceId === sourceInstanceId
        );
        if (!source || !hasTalismanRecycle(source)) return;
        if (player.allyAbilityUsedThisTurn.includes(sourceInstanceId)) {
          get().addLog('Esta habilidad ya fue usada este turno.', 'error');
          return;
        }

        const zone: 'graveyard' | 'exile' | null = player.graveyard.some(
          (c) => c.instanceId === talismanInstanceId
        )
          ? 'graveyard'
          : player.exile.some((c) => c.instanceId === talismanInstanceId)
          ? 'exile'
          : null;
        if (!zone) return;
        const talisman = player[zone].find((c) => c.instanceId === talismanInstanceId)!;
        if (talisman.tipo !== 'talisman') return;

        const cost = Math.max(0, talisman.coste - TALISMAN_RECYCLE_DISCOUNT);
        if (cost > player.goldCount + player.talismanGold) {
          get().addLog(`Necesitas ${cost} de oro para jugar ${talisman.nombre}.`, 'error');
          return;
        }

        // Pago (oros virtuales de talismán primero) y resolución → Removidas.
        const fromVirtual = Math.min(player.talismanGold, cost);
        const fromCards = cost - fromVirtual;
        const paid = player.gold.slice(player.gold.length - fromCards);
        const remaining = player.gold.slice(0, player.gold.length - fromCards);
        set((s) => {
          const p = s.players[playerId];
          return {
            players: {
              ...s.players,
              [playerId]: {
                ...p,
                [zone]: p[zone].filter((c) => c.instanceId !== talismanInstanceId),
                removed: [...p.removed, talisman],
                gold: remaining,
                goldPaid: [...p.goldPaid, ...paid],
                goldCount: remaining.length,
                talismanGold: p.talismanGold - fromVirtual,
                goldSpentThisTurn: fromCards > 0 ? true : p.goldSpentThisTurn,
                allyAbilityUsedThisTurn: [...p.allyAbilityUsedThisTurn, sourceInstanceId],
              },
            },
          };
        });
        get().addLog(
          `${source.nombre}: ${player.name} juega ${talisman.nombre} desde ${zone === 'graveyard' ? 'su Cementerio' : 'su Destierro'} (coste −${TALISMAN_RECYCLE_DISCOUNT} → ${cost}): "${talisman.habilidad}" → removida del juego.`,
          'action'
        );

        // El talismán jugado abre la ventana de respuesta normal.
        const responderId: PlayerId = playerId === 'player' ? 'opponent' : 'player';
        set({
          responseWindow: {
            cardInstanceId: talisman.instanceId,
            cardName: talisman.nombre,
            cardCoste: talisman.coste,
            cardOwnerId: playerId,
            responderId,
            expiresAt: Date.now() + RESPONSE_WINDOW_MS,
          },
        });
      },

      millDestroyAlly: (sourceInstanceId, targetInstanceId, targetOwnerId, playerId) => {
        const { players, turn, combat, responseWindow, isGameOver } = get();
        if (isGameOver || combat || responseWindow) return;
        const player = players[playerId];

        if (turn.currentPlayer !== playerId || turn.phase !== 'vigilia') {
          get().addLog('Esta habilidad solo puede activarse en tu Vigilia.', 'error');
          return;
        }
        const source = [...player.defenseField, ...player.attackField].find(
          (c) => c.instanceId === sourceInstanceId
        );
        if (!source || !hasMillDestroy(source)) return;
        if (player.deck.length < MILL_DESTROY_COST) {
          get().addLog(`Necesitas al menos ${MILL_DESTROY_COST} cartas en tu Mazo Castillo.`, 'error');
          return;
        }

        const targetOwner = players[targetOwnerId];
        const target = [...targetOwner.defenseField, ...targetOwner.attackField].find(
          (c) => c.instanceId === targetInstanceId && c.tipo === 'aliado'
        );
        if (!target) return;
        if (hasIndestructible(target) || cannotLeavePlay(target)) {
          get().addLog(`${target.nombre} no puede ser destruido.`, 'error');
          return;
        }

        // Coste: botar 3 del propio Mazo Castillo al Cementerio.
        const milled = player.deck.slice(0, MILL_DESTROY_COST).map(createCardInPlay);
        set((s) => {
          const p = s.players[playerId];
          const payerPatch = {
            deck: p.deck.slice(MILL_DESTROY_COST),
            graveyard: [...p.graveyard, ...milled],
            life: p.deck.length - MILL_DESTROY_COST,
          };
          const o = s.players[targetOwnerId];
          const weapon = o.equippedWeapons[targetInstanceId];
          const restWeapons = { ...o.equippedWeapons };
          delete restWeapons[targetInstanceId];
          const ownerPatch = {
            defenseField: o.defenseField.filter((c) => c.instanceId !== targetInstanceId),
            attackField: o.attackField.filter((c) => c.instanceId !== targetInstanceId),
            graveyard: [...o.graveyard, target, ...(weapon ? [weapon] : [])],
            equippedWeapons: restWeapons,
          };
          const same = playerId === targetOwnerId;
          return {
            players: {
              ...s.players,
              [playerId]: same
                ? { ...p, ...ownerPatch, ...payerPatch, graveyard: [...p.graveyard, target, ...(weapon ? [weapon] : []), ...milled] }
                : { ...p, ...payerPatch },
              [targetOwnerId]: same
                ? { ...p, ...ownerPatch, ...payerPatch, graveyard: [...p.graveyard, target, ...(weapon ? [weapon] : []), ...milled] }
                : { ...o, ...ownerPatch },
            },
          };
        });
        get().addLog(
          `${source.nombre}: ${player.name} bota ${MILL_DESTROY_COST} cartas y destruye a ${target.nombre}.`,
          'combat'
        );
        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId });
      },

      resolveSwapChoice: (accept, playerId) => {
        const { pendingSwapChoice } = get();
        if (!pendingSwapChoice || pendingSwapChoice.playerId !== playerId) return;
        set({ pendingSwapChoice: null });
        get().addLog(
          accept
            ? `${get().players[playerId].name} elige una carta rival para intercambiar el control con ${pendingSwapChoice.cardName}…`
            : `${get().players[playerId].name} no usa el efecto de ${pendingSwapChoice.cardName}.`,
          'system'
        );
      },

      swapControl: (sourceInstanceId, targetInstanceId, targetOwnerId, playerId) => {
        const { players, isGameOver } = get();
        if (isGameOver || targetOwnerId === playerId) return;
        const owner = players[playerId];
        const rival = players[targetOwnerId];

        const source = [...owner.defenseField, ...owner.attackField].find(
          (c) => c.instanceId === sourceInstanceId
        );
        if (!source || !hasControlSwap(source)) return;

        const target =
          [...rival.defenseField, ...rival.attackField, ...rival.supportField].find(
            (c) => c.instanceId === targetInstanceId && c.tipo !== 'oro'
          ) ?? null;
        if (!target) return;

        set((s) => {
          const me = s.players[playerId];
          const op = s.players[targetOwnerId];

          // Limpia estados por-instancia asociados a ambas cartas en sus
          // dueños originales (bonos temporales, debilitaciones, usos).
          const strip = (p: PlayerState, ids: string[]) => ({
            weakenedAllies: p.weakenedAllies.filter((i) => !ids.includes(i)),
            weaponTempBonuses: Object.fromEntries(
              Object.entries(p.weaponTempBonuses).filter(([k]) => !ids.includes(k))
            ),
            allyAbilityUsedThisTurn: p.allyAbilityUsedThisTurn.filter((i) => !ids.includes(i)),
          });

          // El arma equipada acompaña a su aliado al cambiar de bando.
          const sourceWeapon = me.equippedWeapons[sourceInstanceId];
          const targetWeapon = op.equippedWeapons[targetInstanceId];
          const myWeapons = { ...me.equippedWeapons };
          delete myWeapons[sourceInstanceId];
          const opWeapons = { ...op.equippedWeapons };
          delete opWeapons[targetInstanceId];
          if (targetWeapon) myWeapons[targetInstanceId] = targetWeapon;
          if (sourceWeapon) opWeapons[sourceInstanceId] = sourceWeapon;

          return {
            players: {
              ...s.players,
              [playerId]: {
                ...me,
                ...strip(me, [sourceInstanceId, targetInstanceId]),
                defenseField: [
                  ...me.defenseField.filter((c) => c.instanceId !== sourceInstanceId),
                  // El aliado rival llega a mi línea de defensa
                  ...(target.tipo === 'aliado' ? [target] : []),
                ],
                attackField: me.attackField.filter((c) => c.instanceId !== sourceInstanceId),
                supportField: [
                  ...me.supportField,
                  ...(target.tipo !== 'aliado' ? [target] : []),
                ],
                equippedWeapons: myWeapons,
              },
              [targetOwnerId]: {
                ...op,
                ...strip(op, [sourceInstanceId, targetInstanceId]),
                defenseField: [
                  ...op.defenseField.filter((c) => c.instanceId !== targetInstanceId),
                  // La carta origen (aliado) pasa a la defensa del rival
                  source,
                ],
                attackField: op.attackField.filter((c) => c.instanceId !== targetInstanceId),
                supportField: op.supportField.filter((c) => c.instanceId !== targetInstanceId),
                equippedWeapons: opWeapons,
              },
            },
          };
        });
        get().addLog(
          `${source.nombre}: ${owner.name} intercambia su control por ${target.nombre} (por el resto de la partida).`,
          'combat'
        );
      },

      resolveShuffleChoice: (accept, playerId) => {
        const { players, pendingShuffleChoice } = get();
        if (!pendingShuffleChoice || pendingShuffleChoice.playerId !== playerId) return;
        const player = players[playerId];

        if (!accept) {
          set({ pendingShuffleChoice: null });
          get().addLog(`${player.name} conserva su mano.`, 'system');
          return;
        }

        // La mano entra al Castillo y el mazo SE BARAJA (regla: el mazo se
        // re-aleatoriza siempre que entran cartas o se mira su contenido).
        const shuffled = shuffleDeck([...player.deck, ...player.hand]);
        const { drawn, remaining } = drawCards(shuffled, Math.min(SHUFFLE_DRAW_COUNT, shuffled.length));
        set((s) => {
          const p = s.players[playerId];
          return {
            pendingShuffleChoice: null,
            players: {
              ...s.players,
              [playerId]: {
                ...p,
                hand: drawn.map(createCardInPlay),
                deck: remaining,
                life: remaining.length,
              },
            },
          };
        });
        get().addLog(
          `${pendingShuffleChoice.cardName}: ${player.name} baraja su mano en su Castillo y roba ${Math.min(SHUFFLE_DRAW_COUNT, shuffled.length)} cartas.`,
          'action'
        );
        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId });
      },

      respondWithAnnul: (responseCardInstanceId, playerId) => {
        const { players, responseWindow } = get();
        if (!responseWindow || playerId !== responseWindow.responderId) return;
        if (Date.now() > responseWindow.expiresAt) {
          get().closeResponseWindow();
          return;
        }
        const responder = players[playerId];
        const responseCard = responder.hand.find(
          (c) => c.instanceId === responseCardInstanceId
        );
        if (!responseCard || responseCard.tipo !== 'talisman' || !hasAnnulResponse(responseCard)) {
          return;
        }
        if (responseCard.coste > responder.goldCount + responder.talismanGold) {
          get().addLog(`Necesitas ${responseCard.coste} de oro para jugar ${responseCard.nombre}.`, 'error');
          return;
        }

        // Localizar la carta jugada en las zonas de su dueño (aliado en la
        // línea de defensa; talismán ya resuelto en el cementerio).
        const owner = players[responseWindow.cardOwnerId];
        const target =
          owner.defenseField.find((c) => c.instanceId === responseWindow.cardInstanceId) ??
          owner.graveyard.find((c) => c.instanceId === responseWindow.cardInstanceId) ??
          // Talismanes reciclados ('talisman_reciclado') se resuelven en Removidas
          owner.removed.find((c) => c.instanceId === responseWindow.cardInstanceId);
        if (!target) {
          get().closeResponseWindow();
          return;
        }

        // Protecciones vigentes: Inmunidad Talismanes y Patriotas de MBE.
        const blockReason = annulBlockReason(target, owner);
        if (blockReason) {
          get().addLog(blockReason, 'error');
          return;
        }

        // Pagar el talismán de respuesta (oros virtuales primero) → cementerio.
        const fromVirtual = Math.min(responder.talismanGold, responseCard.coste);
        const fromCards = responseCard.coste - fromVirtual;
        const paid = responder.gold.slice(responder.gold.length - fromCards);
        const remainingGold = responder.gold.slice(0, responder.gold.length - fromCards);

        // Robo: tantas cartas como el coste de la carta anulada.
        const drawCount = Math.min(target.coste, responder.deck.length);
        const { drawn, remaining: newDeck } = drawCards(responder.deck, drawCount);

        set((s) => {
          const r = s.players[playerId];
          const o = s.players[responseWindow.cardOwnerId];
          const ownerPatch = {
            // La carta anulada se REMUEVE del juego (zona R), venga de donde venga.
            defenseField: o.defenseField.filter((c) => c.instanceId !== target.instanceId),
            graveyard: o.graveyard.filter((c) => c.instanceId !== target.instanceId),
            removed: [
              ...o.removed.filter((c) => c.instanceId !== target.instanceId),
              target,
            ],
          };
          const responderPatch = {
            hand: [
              ...r.hand.filter((c) => c.instanceId !== responseCardInstanceId),
              ...drawn.map(createCardInPlay),
            ],
            graveyard: [...r.graveyard, responseCard],
            gold: remainingGold,
            goldPaid: [...r.goldPaid, ...paid],
            goldCount: remainingGold.length,
            talismanGold: r.talismanGold - fromVirtual,
            goldSpentThisTurn: fromCards > 0 ? true : r.goldSpentThisTurn,
            deck: newDeck,
            life: newDeck.length,
          };
          const samePlayer = playerId === responseWindow.cardOwnerId;
          return {
            responseWindow: null,
            players: {
              ...s.players,
              [responseWindow.cardOwnerId]: { ...o, ...ownerPatch, ...(samePlayer ? responderPatch : {}) },
              [playerId]: samePlayer
                ? { ...o, ...ownerPatch, ...responderPatch }
                : { ...r, ...responderPatch },
            },
          };
        });

        get().addLog(
          `${responder.name} responde con ${responseCard.nombre}: ${target.nombre} es anulada y removida del juego. ${responder.name} roba ${drawCount} carta(s).`,
          'combat'
        );
        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId });
      },

      passResponse: (playerId) => {
        const { responseWindow } = get();
        if (!responseWindow || playerId !== responseWindow.responderId) return;
        set({ responseWindow: null });
        get().addLog(`${get().players[playerId].name} no responde.`, 'system');
      },

      closeResponseWindow: () => {
        const { responseWindow } = get();
        if (!responseWindow || Date.now() < responseWindow.expiresAt) return;
        set({ responseWindow: null });
        get().addLog('Ventana de respuesta cerrada.', 'system');
      },

      weakenAlly: (sourceInstanceId, targetInstanceId, targetOwnerId, playerId) => {
        const { players, turn, combat, isGameOver } = get();
        if (isGameOver || combat) return;
        const player = players[playerId];

        if (turn.currentPlayer !== playerId || turn.phase !== 'vigilia') {
          get().addLog('Esta habilidad solo puede activarse en tu Vigilia.', 'error');
          return;
        }
        const source = [...player.defenseField, ...player.attackField].find(
          (c) => c.instanceId === sourceInstanceId
        );
        if (!source || !hasWeakenAbility(source)) return;
        if (player.goldCount < WEAKEN_GOLD_COST) {
          get().addLog('No tienes oro suficiente para activar esta habilidad.', 'error');
          return;
        }

        const targetOwner = players[targetOwnerId];
        const target = [...targetOwner.defenseField, ...targetOwner.attackField].find(
          (c) => c.instanceId === targetInstanceId && c.tipo === 'aliado'
        );
        if (!target) return;

        // 'fuerza_inmutable': si el bando del objetivo tiene la fuerza
        // bloqueada, tampoco puede reducírsele a 0.
        if (strengthLockedFor(targetOwnerId, players)) {
          get().addLog(
            `Una carta en juego impide modificar la Fuerza de ${target.nombre}.`,
            'error'
          );
          return;
        }

        // Pagar 1 oro: el último oro disponible pasa a la zona de Oro Pagado.
        const paid = player.gold[player.gold.length - 1];
        set((s) => {
          const p = s.players[playerId];
          const owner = s.players[targetOwnerId];
          const payerPatch = {
            gold: p.gold.slice(0, -1),
            goldPaid: [...p.goldPaid, paid],
            goldCount: p.goldCount - 1,
            goldSpentThisTurn: true,
          };
          const ownerPatch = {
            weakenedAllies: [...owner.weakenedAllies, targetInstanceId],
          };
          return {
            players: {
              ...s.players,
              [playerId]: { ...p, ...payerPatch },
              [targetOwnerId]: {
                ...s.players[targetOwnerId],
                ...(targetOwnerId === playerId ? payerPatch : {}),
                ...ownerPatch,
              },
            },
          };
        });
        get().addLog(
          `${source.nombre}: ${target.nombre} tiene Fuerza 0 hasta la Fase Final (−1 Oro).`,
          'action'
        );
      },

      summonCaudilloFromDeck: (sourceInstanceId, deckIndex, playerId) => {
        const { players, combat } = get();
        const player = players[playerId];

        const source =
          player.defenseField.find((c) => c.instanceId === sourceInstanceId) ??
          player.attackField.find((c) => c.instanceId === sourceInstanceId);
        if (!source || !hasCaudilloSummon(source)) return;

        if (combat) {
          get().addLog('No puedes invocar durante un combate pendiente.', 'error');
          return;
        }
        if (player.allyAbilityUsedThisTurn.includes(sourceInstanceId)) {
          get().addLog(`La habilidad de ${source.nombre} ya fue usada este turno.`, 'error');
          return;
        }
        if (player.goldCount < CAUDILLO_SUMMON_GOLD_COST) {
          get().addLog(`Necesitas ${CAUDILLO_SUMMON_GOLD_COST} oros disponibles para activar esta habilidad.`, 'error');
          return;
        }
        const target = player.deck[deckIndex];
        if (!target || !isSummonableByCaudillo(target, source)) {
          get().addLog('Esa carta no puede invocarse con esta habilidad.', 'error');
          return;
        }

        // Paga 3 oros (van a la zona P) y saca la carta del Mazo Castillo.
        const paid = player.gold.slice(player.gold.length - CAUDILLO_SUMMON_GOLD_COST);
        const remainingGold = player.gold.slice(0, player.gold.length - CAUDILLO_SUMMON_GOLD_COST);
        const newDeck = player.deck.filter((_, i) => i !== deckIndex);

        set((s) => ({
          players: {
            ...s.players,
            [playerId]: {
              ...s.players[playerId],
              deck: newDeck,
              life: newDeck.length,
              defenseField: [
                ...s.players[playerId].defenseField,
                { ...createCardInPlay(target), summonedThisTurn: true },
              ],
              gold: remainingGold,
              goldPaid: [...s.players[playerId].goldPaid, ...paid],
              goldCount: remainingGold.length,
              goldSpentThisTurn: true,
              allyAbilityUsedThisTurn: [
                ...s.players[playerId].allyAbilityUsedThisTurn,
                sourceInstanceId,
              ],
            },
          },
        }));

        get().addLog(
          `${source.nombre} paga ${CAUDILLO_SUMMON_GOLD_COST} oros e invoca a ${target.nombre} desde el Mazo Castillo sin pagar su coste.`,
          'action'
        );

        const { isOver, winnerId } = checkGameOver(get().players);
        if (isOver) set({ isGameOver: true, winner: winnerId as PlayerId });
      },

      hydrateState: (state) => set(state),

      addLog: (msg, type = 'action') => {
        set((s) => ({
          gameLog: [createLogEntry(msg, type), ...s.gameLog].slice(0, 60),
        }));
      },
    }),
    { name: 'myl-game-store' }
  )
);
