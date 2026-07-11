import type { CardInPlay, Card } from '@/types/card.types';
import type { PlayerId, PlayerState, TurnState } from '@/types/game.types';

export const INITIAL_HAND_SIZE = 5;
export const MAX_GOLD_CARDS    = 15;

/**
 * "Maquinaria": weapons with this special ability can be played onto the
 * support line like a totem, instead of equipping an ally.
 */
export function hasMachinery(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('maquinaria') ?? false;
}

/**
 * "Instantáneo": un talismán con esta habilidad especial puede jugarse fuera de
 * la Vigilia y de la Guerra de Talismanes (en cualquier momento, según indique
 * su habilidad), omitiendo la restricción normal de fase/turno.
 */
export function isInstantTalisman(card: Card): boolean {
  return card.tipo === 'talisman' && (card.habilidadesEspeciales?.includes('instantaneo') ?? false);
}

/**
 * Pure function: can a card be played given player's current state?
 *
 * Regla general de talismanes: solo se juegan en 2 momentos — la Vigilia del
 * jugador activo (esta función) o la Guerra de Talismanes (`playCombatTalisman`).
 * Excepción: los talismanes con la habilidad 'instantaneo' ignoran la fase/turno.
 */
export function canPlayCard(
  card: Card,
  player: PlayerState,
  turn: TurnState
): { allowed: boolean; reason?: string } {
  const instant = isInstantTalisman(card);

  if (!instant) {
    if (turn.currentPlayer !== player.id) {
      return { allowed: false, reason: 'No es tu turno' };
    }
    if (turn.phase !== 'vigilia') {
      return { allowed: false, reason: 'Solo puedes jugar cartas en la fase de Vigilia' };
    }
  }

  if (card.tipo === 'oro') {
    if (turn.goldPlayedThisTurn >= 1) {
      return { allowed: false, reason: 'Solo puedes jugar 1 carta de oro por turno' };
    }
    if (player.gold.length >= MAX_GOLD_CARDS) {
      return { allowed: false, reason: `La zona de oro está llena (máximo ${MAX_GOLD_CARDS})` };
    }
    return { allowed: true };
  }

  // Los talismanes pueden pagarse también con oros virtuales 'oro_talismanes'.
  const available =
    card.tipo === 'talisman' ? player.goldCount + player.talismanGold : player.goldCount;
  if (card.coste > available) {
    return {
      allowed: false,
      reason: `Necesitas ${card.coste} de oro (tienes ${available})`,
    };
  }

  if (
    card.tipo === 'arma' &&
    !hasMachinery(card) &&
    player.defenseField.filter(c => c.tipo === 'aliado').length === 0
  ) {
    return { allowed: false, reason: 'Necesitas un aliado en la línea de defensa para equipar un arma' };
  }

  return { allowed: true };
}

/**
 * "Única": deck-building rule — at most 1 copy of this card per castle deck
 * (the general MYL rule allows up to MAX_COPIES_PER_CARD copies).
 */
export function hasUnica(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('unica') ?? false;
}

/** General MYL deck rule: up to 3 copies of the same card per deck. */
export const MAX_COPIES_PER_CARD = 3;

/** Max copies of `card` allowed in a deck ('unica' → 1). */
export function maxCopiesInDeck(card: Card): number {
  return hasUnica(card) ? 1 : MAX_COPIES_PER_CARD;
}

/**
 * 'solo_desde_mano': this card can only be played from its owner's hand —
 * it cannot enter play through effects or abilities, nor be used as the
 * initial gold. Every future effect that puts cards into play MUST check
 * this guard first.
 */
export function isHandOnly(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('solo_desde_mano') ?? false;
}

/** Golds generated when paying a card with 'oro_talismanes' (Escudo Nacional). */
export const GOLD_TALISMAN_YIELD = 2;

/**
 * 'oro_talismanes': this gold can be paid (moved to the paid-gold zone) to
 * generate GOLD_TALISMAN_YIELD virtual golds that can ONLY pay talismans.
 * Activatable during either player's turn; the virtual golds expire at the
 * end of the turn.
 */
export function hasGoldTalismanAbility(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('oro_talismanes') ?? false;
}

/**
 * "Imbloqueable": when this ally attacks, the defender cannot declare a
 * blocker against it — the attack always resolves as undefended (the
 * Talisman War still happens; only the block is forbidden).
 */
export function hasImbloqueable(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('imbloqueable') ?? false;
}

/**
 * "Inmunidad: Talismanes": talisman effects have NO effect on this card —
 * targeted talisman effects fail on it and global talisman effects skip it
 * (e.g. "Destruye un aliado en juego" cannot destroy it). Every future
 * automated talisman effect MUST check this guard before touching a card.
 */
export function hasInmunidadTalismanes(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('inmunidad_talismanes') ?? false;
}

/**
 * 'patriotas_no_anulables' (Manuel Blanco Encalada): while a card with this
 * ability is in play, its controller's Patriota allies cannot be annulled.
 */
export function hasPatriotProtection(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('patriotas_no_anulables') ?? false;
}

/**
 * Is `target` protected from annulment effects ("Anula un aliado…")?
 * True when target is a Patriota ally and its OWN controller has a card with
 * 'patriotas_no_anulables' in play. Every future annulment effect MUST check
 * this guard before annulling a card (targeted annulments fail on protected
 * cards; mass annulments skip them).
 */
export function isProtectedFromAnnulment(target: Card, owner: PlayerState): boolean {
  return (
    target.tipo === 'aliado' &&
    target.raza === 'Patriota' &&
    [...owner.defenseField, ...owner.attackField, ...owner.supportField].some(
      hasPatriotProtection,
    )
  );
}

/**
 * "Oro Inicial": setup keyword. The general rule requires the initial gold
 * (auto-played at game start) to be a BASIC gold — one with no special
 * abilities. A gold with this keyword is also allowed to be the initial gold.
 */
export function hasOroInicial(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('oro_inicial') ?? false;
}

/** Basic gold: tipo oro with no special abilities (mechanics-free). */
export function isBasicGold(card: Card): boolean {
  return card.tipo === 'oro' && (card.habilidadesEspeciales?.length ?? 0) === 0;
}

/**
 * 'oro_robar_descartar' (Escarapela Nacional): once per turn (enforced by the
 * zone cycle: paying moves it to goldPaid and it only returns on your
 * Agrupación regroup), if you control at least one Patriota ally, pay this
 * gold → draw 1 card from your castle deck, then MANDATORY discard 1 card
 * from hand. Activatable in any phase, during either player's turn.
 */
export function hasDrawDiscardGold(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('oro_robar_descartar') ?? false;
}

/** Does `player` control at least one Patriota ally on the board? */
export function controlsPatriota(player: PlayerState): boolean {
  return [...player.defenseField, ...player.attackField].some(
    (c) => c.tipo === 'aliado' && c.raza === 'Patriota',
  );
}

/** Gold cost of the 'debilitar_aliado' activated ability. */
export const WEAKEN_GOLD_COST = 1;

/**
 * 'debilitar_aliado' (Manuel Baquedano): in your Vigilia, pay 1 gold — a
 * target ally in play has Force 0 until the Final Phase. Repeatable while
 * you have gold (the card text sets no per-turn limit).
 */
export function hasWeakenAbility(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('debilitar_aliado') ?? false;
}

/**
 * Effective combat force of an ally — single source of truth:
 * - weakened ('debilitar_aliado') → 0, ignoring every bonus;
 * - strength-locked ('fuerza_inmutable' rival) → printed fuerza only;
 * - otherwise printed fuerza + equipped weapon bonus + temp bonuses.
 */
export function effectiveForce(
  ally: CardInPlay,
  owner: PlayerState,
  players: Record<PlayerId, PlayerState>,
): number {
  if (owner.weakenedAllies?.includes(ally.instanceId)) return 0;
  if (strengthLockedFor(owner.id, players)) return ally.fuerza;
  return (
    ally.fuerza +
    (owner.equippedWeapons[ally.instanceId]?.bonusFuerza ?? 0) +
    (owner.weaponTempBonuses[ally.instanceId] ?? 0)
  );
}

/** "Defensor": this ally cannot attack, only defend from the defense line. */
export function hasDefensor(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('defensor') ?? false;
}

/**
 * "Furia": this ally can attack the same turn it enters play, ignoring the
 * "must have been in play since Agrupación" rule.
 */
export function hasFuria(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('furia') ?? false;
}

/**
 * "Indestructible": this card never goes to the graveyard by destruction —
 * neither by direct "Destruye" effects nor by losing (or tying) the force
 * comparison in the damage-assignment step of the Mythological Battle.
 */
export function hasIndestructible(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('indestructible') ?? false;
}

/**
 * "Indesterrable": while on the battlefield, no ability or effect can send
 * this card to the Exile zone (D — Destierro). Targeted banish effects may
 * still pick it, but the banish fails on resolution; global "banish all"
 * sweeps skip it. Every future effect that moves a card from the field to
 * `exile` MUST check this guard first.
 */
export function hasIndesterrable(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('indesterrable') ?? false;
}

/**
 * "Fuerza inmutable" (Cerro Huelen): while this card is in play, the
 * OPPONENT's allies cannot modify their strength — weapon bonuses, temporary
 * buffs and any other force modifier are inert; they fight with their
 * printed fuerza. The controller's own allies are NOT affected.
 */
export function hasStrengthLock(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('fuerza_inmutable') ?? false;
}

/**
 * Are `ownerId`'s allies strength-locked? True when any OTHER player has a
 * 'fuerza_inmutable' card in play (any line of the field).
 */
export function strengthLockedFor(
  ownerId: PlayerId,
  players: Record<PlayerId, PlayerState>,
): boolean {
  return (Object.entries(players) as [PlayerId, PlayerState][]).some(
    ([id, p]) =>
      id !== ownerId &&
      [...p.supportField, ...p.defenseField, ...p.attackField].some(hasStrengthLock),
  );
}

/** Cost and reach of the 'invocacion_caudillo' activated ability. */
export const CAUDILLO_SUMMON_GOLD_COST = 3;
export const CAUDILLO_SUMMON_MAX_COST = 4;
/** Cards milled by 'castigo_bloqueo' when the attacker is blocked. */
export const BLOCK_PUNISHMENT_MILL = 6;

/**
 * "Invocación Caudillo" (activated, once per turn): pay 3 gold to play an
 * ally of the same raza with coste ≤ 4 straight from the castle deck,
 * without paying its cost.
 */
export function hasCaudilloSummon(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('invocacion_caudillo') ?? false;
}

/**
 * "Castigo al bloqueo": every time this ally attacks and is blocked, the
 * defending player mills 6 cards from their castle deck to their graveyard.
 */
export function hasBlockPunishment(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('castigo_bloqueo') ?? false;
}

/**
 * May `target` (a castle-deck card) be summoned by `source`'s
 * 'invocacion_caudillo' ability? Ally of the same raza, coste ≤ 4.
 */
export function isSummonableByCaudillo(target: Card, source: Card): boolean {
  return (
    target.tipo === 'aliado' &&
    target.coste <= CAUDILLO_SUMMON_MAX_COST &&
    !!source.raza &&
    target.raza === source.raza
  );
}

/**
 * Pure function: can this ally declare an attack?
 * Each ally attacks at most once per its owner's turn; allies with the
 * 'defensor' special ability cannot attack at all; a freshly summoned ally
 * cannot attack unless it has the 'furia' special ability.
 */
export function canDeclareAttack(
  card: CardInPlay,
  turn: TurnState,
  ownerId: string
): { allowed: boolean; reason?: string } {
  if (turn.currentPlayer !== ownerId) {
    return { allowed: false, reason: 'Solo puedes atacar en tu turno' };
  }
  if (card.attackedThisTurn) {
    return { allowed: false, reason: 'Este aliado ya atacó este turno' };
  }
  if (card.tapped) {
    return { allowed: false, reason: 'Este aliado está agotado' };
  }
  if (hasDefensor(card)) {
    return { allowed: false, reason: 'Este aliado es Defensor: no puede atacar' };
  }
  if (card.summonedThisTurn && !hasFuria(card)) {
    return {
      allowed: false,
      reason: 'Este aliado acaba de entrar en juego: no puede atacar este turno',
    };
  }
  return { allowed: true };
}

export interface CombatOutcome {
  attackerDestroyed: boolean;
  defenderDestroyed: boolean;
  /** Cards moved from the attacked player's castle deck to their graveyard. */
  deckDamage: number;
}

/**
 * Pure combat resolution (forces already include weapon bonuses).
 * - No defender: full attacker force hits the castle deck.
 * - Attacker > defender: defender destroyed + difference hits the deck.
 * - Defender > attacker: attacker destroyed; decks untouched.
 * - Tie: both destroyed; decks untouched.
 */
export function resolveInteractiveCombat(
  attackerForce: number,
  defenderForce: number | null
): CombatOutcome {
  if (defenderForce === null) {
    return { attackerDestroyed: false, defenderDestroyed: false, deckDamage: attackerForce };
  }
  if (attackerForce > defenderForce) {
    return {
      attackerDestroyed: false,
      defenderDestroyed: true,
      deckDamage: attackerForce - defenderForce,
    };
  }
  if (defenderForce > attackerForce) {
    return { attackerDestroyed: true, defenderDestroyed: false, deckDamage: 0 };
  }
  return { attackerDestroyed: true, defenderDestroyed: true, deckDamage: 0 };
}

/**
 * Check if the game is over (any player's life ≤ 0).
 */
export function checkGameOver(players: Record<string, PlayerState>): {
  isOver: boolean;
  winnerId?: string;
} {
  for (const [id, player] of Object.entries(players)) {
    if (player.life <= 0) {
      const winnerId = Object.keys(players).find(k => k !== id);
      return { isOver: true, winnerId };
    }
  }
  return { isOver: false };
}
