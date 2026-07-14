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
  turn: TurnState,
  /** Ambos jugadores: necesario para sobrecostes activos ('nombrar_tipo_sobrecoste'). */
  players?: Record<PlayerId, PlayerState>,
): { allowed: boolean; reason?: string } {
  // 'instantaneo' (talismanes) y 'relampago' (cualquier tipo) se juegan a
  // velocidad de respuesta: ignoran la restricción de turno y fase.
  const instant = isInstantTalisman(card) || hasRelampago(card);

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
  const cost = players ? effectiveCost(card, players) : card.coste;
  if (cost > available) {
    return {
      allowed: false,
      reason: `Necesitas ${cost} de oro (tienes ${available})`,
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

/**
 * "Orbe": the strictest deck-building restriction — only ONE card with the
 * Orbe keyword in the whole castle deck, regardless of its name (unlike
 * 'unica', which restricts per-name). Including an Orbe card forbids both a
 * second copy of it AND any other Orbe card.
 */
export function hasOrbe(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('orbe') ?? false;
}

/** Max copies of `card` allowed in a deck ('unica' y 'orbe' → 1). */
export function maxCopiesInDeck(card: Card): number {
  return hasUnica(card) || hasOrbe(card) ? 1 : MAX_COPIES_PER_CARD;
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
 * 'inmunidad_aliados' (Arturo Prat): this card cannot be affected by ANY
 * ally's ability — targeted ally effects fail on it and mass ally effects
 * skip it. Every ally-sourced effect that touches a card MUST check this.
 */
export function hasInmunidadAliados(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('inmunidad_aliados') ?? false;
}

/**
 * 'otorga_inmunidad_talismanes' (Arturo Prat): while this card is in play,
 * the controller's Patriota allies gain "Inmunidad: Talismanes".
 */
export function grantsTalismanImmunity(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('otorga_inmunidad_talismanes') ?? false;
}

/**
 * Effective "Inmunidad: Talismanes" for `card` controlled by `owner`:
 * either its own ability, or granted because it is a Patriota ally and its
 * controller has a card with 'otorga_inmunidad_talismanes' in play.
 */
export function hasInmunidadTalismanesEffective(card: Card, owner: PlayerState): boolean {
  if (hasInmunidadTalismanes(card)) return true;
  return (
    card.tipo === 'aliado' &&
    card.raza === 'Patriota' &&
    [...owner.defenseField, ...owner.attackField].some(grantsTalismanImmunity)
  );
}

/**
 * 'trigger_patriota_roba_baraja' (Arturo Prat): each time a Patriota ally
 * enters play, its controller MAY draw 1 card from the castle deck, shuffle
 * one card from the graveyard back into the castle, then shuffle the deck.
 */
export function hasPatriotaEnterTrigger(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('trigger_patriota_roba_baraja') ?? false;
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

/** Duration of the response window after an ally/talisman is played. */
export const RESPONSE_WINDOW_MS = 10_000;

/**
 * 'anular_respuesta' (Duelo a Siete Pasos SP): response talisman. During the
 * response window it annuls the just-played Ally or Talisman: the annulled
 * card is REMOVED from the game (zona R) and the responder draws as many
 * cards as the annulled card's coste.
 */
export function hasAnnulResponse(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('anular_respuesta') ?? false;
}

/**
 * "Relámpago": this card can be played at ANY moment a talisman could be
 * played — during the opponent's turn, as a surprise blocker while an attack
 * awaits defense, or at the rival's Final Phase — paying its cost normally.
 * Breaks the "allies/weapons/totems only in your Vigilia" rule.
 */
export function hasRelampago(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('relampago') ?? false;
}

/**
 * 'agrupar_fase_final' (Balmaceda SP): at the start of EVERY Final Phase
 * (either player's turn), regroup all cards its controller owns — paid gold
 * returns to the reserve and attacking allies return untapped to defense.
 */
export function hasFinalPhaseRegroup(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('agrupar_fase_final') ?? false;
}

/** Cards milled by 'botar3_destruye'. */
export const MILL_DESTROY_COST = 3;

/**
 * 'botar3_destruye' (Balmaceda SP): mill 3 cards from your own castle deck
 * to destroy a target ally (blocked by 'indestructible' / 'no_sale_del_juego').
 */
export function hasMillDestroy(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('botar3_destruye') ?? false;
}

/** Extra cost per active 'nombrar_tipo_sobrecoste' source (Plaza de Armas SP). */
export const TYPE_TAX_AMOUNT = 2;

/**
 * 'nombrar_tipo_sobrecoste' (Plaza de Armas SP): when this totem enters
 * play, its owner names a non-gold card type. Cards of the named type cost
 * +2 golds (BOTH players) while this card is on the support line.
 */
export function hasTypeTax(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('nombrar_tipo_sobrecoste') ?? false;
}

/** Total cost surcharge for playing `card` ('nombrar_tipo_sobrecoste'). */
export function typeTax(card: Card, players: Record<PlayerId, PlayerState>): number {
  let tax = 0;
  for (const p of Object.values(players)) {
    for (const t of p.supportField) {
      if (hasTypeTax(t) && t.namedType === card.tipo) tax += TYPE_TAX_AMOUNT;
    }
  }
  return tax;
}

/** Coste efectivo de jugar una carta: impreso + sobrecostes activos. */
export function effectiveCost(card: Card, players: Record<PlayerId, PlayerState>): number {
  return card.coste + typeTax(card, players);
}

/** Cost and mill amount of 'pagar2_bota6' (Luis Carrera SP). */
export const MILL_GOLD_COST = 2;
export const MILL_GOLD_AMOUNT = 6;

/**
 * 'pagar2_bota6' (Luis Carrera SP): in your Vigilia, once per turn, pay 2
 * golds → the opponent mills 6 cards from their castle deck to the
 * graveyard, UNLESS they respond first (10 s effect window; a future
 * "prevent effect" talisman/relámpago card can stop it).
 */
export function hasMillGoldAbility(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('pagar2_bota6') ?? false;
}

/**
 * 'nombrar_raza_suprime' (Luis Carrera SP): once per turn, name a race —
 * every OTHER ally that is not of that race loses its abilities until the
 * Final Phase (their habilidadesEspeciales are stripped and restored at
 * endTurn via PlayerState.suppressedAbilities).
 */
export function hasRaceSuppress(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('nombrar_raza_suprime') ?? false;
}

/** Per-ability once-per-turn tracking key (instanceId alone is ambiguous
 *  when a card has several activated abilities). */
export function abilityUseKey(instanceId: string, code: string): string {
  return `${instanceId}:${code}`;
}

/** Temp force bonus granted by 'anulado_fuerza3' when the card is annulled. */
export const ANNUL_TRIGGER_BONUS = 3;

/**
 * 'anulado_fuerza3' (Diego Portales SP): if this card is ANNULLED (e.g. by a
 * response talisman), its owner's allies gain +3 Force until the Final Phase.
 * The trigger fires from outside the board, right when the annul resolves.
 */
export function hasAnnulTrigger(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('anulado_fuerza3') ?? false;
}

/**
 * 'fuerza_por_cementerio' (Diego Portales SP): while this card is on the
 * board, its controller's allies gain +1 Force per ALLY card in the
 * controller's graveyard (dynamic; stacks per source card in play).
 */
export function hasGraveyardForceBonus(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('fuerza_por_cementerio') ?? false;
}

/** Total graveyard-scaling bonus an ally receives ('fuerza_por_cementerio'). */
export function graveyardForceBonus(ally: CardInPlay, owner: PlayerState): number {
  if (ally.tipo !== 'aliado') return 0;
  const sources = [...owner.defenseField, ...owner.attackField].filter(
    hasGraveyardForceBonus,
  ).length;
  if (sources === 0) return 0;
  const alliesInGrave = owner.graveyard.filter((c) => c.tipo === 'aliado').length;
  return sources * alliesInGrave;
}

/**
 * 'intercambio_control' (Arturo Prat SP): when this card enters play, its
 * owner MAY exchange its control with any non-gold rival card in play (ally,
 * totem or machinery weapon on the board). The exchange lasts for the rest
 * of the game: each card acts as if owned by the player whose side it is on.
 */
export function hasControlSwap(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('intercambio_control') ?? false;
}

/**
 * 'inanulable' (Manuel Rodríguez): this card cannot be annulled by ANY card.
 */
export function hasInanulable(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('inanulable') ?? false;
}

/**
 * 'no_sale_del_juego' (Manuel Rodríguez): this card cannot leave play by any
 * means — destruction, removal, exile, bounce… Every current and future
 * effect that takes a card off the battlefield MUST check this guard.
 */
export function cannotLeavePlay(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('no_sale_del_juego') ?? false;
}

/** Cards drawn by 'barajar_mano_roba8' when the shuffle option is accepted. */
export const SHUFFLE_DRAW_COUNT = 8;

/**
 * 'barajar_mano_roba8' (Manuel Rodríguez): when this card enters play, its
 * owner MAY shuffle their hand into the castle deck; if they do, they draw 8
 * new cards. (Shuffling rule: the deck is re-randomized whenever cards enter
 * it or it is looked at — not when drawing blindly from the top.)
 */
export function hasShuffleDraw(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('barajar_mano_roba8') ?? false;
}

/**
 * 'fuerza1_no_caudillos' (Manuel Rodríguez): while this card is on the board,
 * every ally that is NOT raza Caudillo has Force 1 (set — ignores bonuses).
 * Affects both players' allies.
 */
export function hasCaudilloForceLock(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('fuerza1_no_caudillos') ?? false;
}

/** Is a 'fuerza1_no_caudillos' card on any player's board? */
export function caudilloForceLockActive(players: Record<PlayerId, PlayerState>): boolean {
  return Object.values(players).some((p) =>
    [...p.defenseField, ...p.attackField].some(hasCaudilloForceLock),
  );
}

/**
 * Can `card` be annulled by a talisman response?
 * Returns the blocking reason, or null when annullable. Checks the standing
 * protections: 'inanulable' on the card itself, 'inmunidad_talismanes' and
 * the Patriota protection ('patriotas_no_anulables') of its controller.
 */
export function annulBlockReason(target: Card, owner: PlayerState): string | null {
  if (hasInanulable(target)) {
    return `${target.nombre} no puede ser anulada por ninguna carta.`;
  }
  if (hasInmunidadTalismanesEffective(target, owner)) {
    return `${target.nombre} tiene Inmunidad: Talismanes — no puede ser anulada.`;
  }
  if (isProtectedFromAnnulment(target, owner)) {
    return `${target.nombre} está protegida: tus Aliados Patriota no pueden ser anulados.`;
  }
  return null;
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
 * 'jugar_desde_cementerio' (Bernardo O'Higgins): this card can be played from
 * its owner's Cementerio or Destierro as if it were in their hand, paying its
 * normal cost. The zones holding a playable card glow golden in the UI.
 */
export function hasPlayFromGraveyard(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('jugar_desde_cementerio') ?? false;
}

/**
 * 'desde_cementerio' (genérica, cualquier tipo): la carta puede jugarse desde
 * el Cementerio propio como si estuviera en la mano, pagando su coste. Las
 * armas sin maquinaria eligen portador (targeting dorado).
 */
export function hasDesdeCementerio(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('desde_cementerio') ?? false;
}

/** ¿Puede `card` jugarse desde `zone`? ('jugar_desde_cementerio' cubre
 *  Cementerio y Destierro; 'desde_cementerio' solo Cementerio). */
export function canPlayFromZone(card: Card, zone: 'graveyard' | 'exile'): boolean {
  if (hasPlayFromGraveyard(card)) return true;
  return zone === 'graveyard' && hasDesdeCementerio(card);
}

/**
 * 'destierro_combate' (Sable de Caballería SP): cada vez que el PORTADOR de
 * esta arma hace daño de combate a un Mazo Castillo, se destierran todos los
 * aliados en juego de ese oponente (respeta 'indesterrable' y
 * 'no_sale_del_juego'; las armas equipadas de los desterrados van al
 * cementerio).
 */
export function hasCombatExileAll(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('destierro_combate') ?? false;
}

/**
 * 'bonus_patriotas' (Bernardo O'Higgins): while this card is on the board
 * (defense or attack line), ALL Patriota allies — both players', including
 * itself — gain +1 Fuerza. Stacks per card with the ability in play.
 */
export function hasPatriotaBuff(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('bonus_patriotas') ?? false;
}

/**
 * 'bonus_patriotas_propios' (Estrella Solitaria): while in play, only the
 * CONTROLLER's Patriota allies gain +1 Fuerza (unlike 'bonus_patriotas' which
 * buffs both players' Patriotas).
 */
export function hasPatriotaBuffOwn(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('bonus_patriotas_propios') ?? false;
}

/**
 * Total +1s a Patriota ally receives: 'bonus_patriotas' cards anywhere (both
 * players) + 'bonus_patriotas_propios' cards controlled by the ally's OWNER.
 */
export function patriotaBonus(
  ally: CardInPlay,
  owner: PlayerState,
  players: Record<PlayerId, PlayerState>,
): number {
  if (ally.tipo !== 'aliado' || ally.raza !== 'Patriota') return 0;
  let bonus = 0;
  for (const p of Object.values(players)) {
    for (const c of [...p.defenseField, ...p.attackField]) {
      if (hasPatriotaBuff(c)) bonus += 1;
    }
  }
  // Fuentes propias: solo cuentan si están en el tablero del dueño del aliado.
  for (const c of [...owner.defenseField, ...owner.attackField]) {
    if (hasPatriotaBuffOwn(c)) bonus += 1;
  }
  return bonus;
}

/**
 * 'inmunidad_habilidades_oponentes' (Estrella Solitaria): this card cannot be
 * targeted or affected by ANY opponent ability (allies, totems, weapons,
 * gold — everything except talismans, covered by 'inmunidad_talismanes').
 * Guard for every opponent-sourced effect that touches a card.
 */
export function hasInmunidadHabilidadesOponentes(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('inmunidad_habilidades_oponentes') ?? false;
}

/** Immune to an ally/opponent-sourced ability (either specific immunity). */
export function immuneToAllyOrOpponentEffect(card: Card): boolean {
  return hasInmunidadAliados(card) || hasInmunidadHabilidadesOponentes(card);
}

/** Cost/yield of 'oro_traba_rival' (Carbón piedra). */
export function hasGoldChokeRival(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('oro_traba_rival') ?? false;
}

/** 'oro_descarta_talisman' (Aurora de Chile): destroy → discard a rival talisman. */
export function hasGoldDiscardTalisman(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('oro_descarta_talisman') ?? false;
}

/** Golds generated by 'oro_caudillo_x3' (Primer Escudo). */
export const CAUDILLO_GOLD_YIELD = 3;

/** 'oro_caudillo_x3' (Primer Escudo): pay → 3 golds usable only for Caudillo abilities. */
export function hasCaudilloGoldAbility(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('oro_caudillo_x3') ?? false;
}

/** 'mano_descarta_roba' (Bandera Patria Vieja): from hand, discard → draw 1. */
export function hasHandDiscardDraw(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('mano_descarta_roba') ?? false;
}

/** 'mano_tutor_caudillo' (Salitre): from hand, remove → tutor a Caudillo ally. */
export function hasHandTutorCaudillo(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('mano_tutor_caudillo') ?? false;
}

/**
 * 'suprime_coste1' (Bandera Transición): while in play, every card in play
 * (both players) with coste 1 loses its abilities. Continuous effect.
 */
export function hasCostOneSuppress(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('suprime_coste1') ?? false;
}

/** Is any 'suprime_coste1' card in play (any zone/player)? */
export function costOneSuppressActive(players: Record<PlayerId, PlayerState>): boolean {
  return Object.values(players).some((p) =>
    [...p.defenseField, ...p.attackField, ...p.supportField, ...p.gold].some(hasCostOneSuppress),
  );
}

/**
 * 'revela_mano_caudillos' (Monitor Araucano): while its controller has at
 * least one ally and ALL their allies are raza Caudillo, that player's
 * opponents play with their hand revealed.
 */
export function hasRevealHandCaudillos(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('revela_mano_caudillos') ?? false;
}

/** Does `player` control at least one ally and are they ALL Caudillo? */
export function controlsOnlyCaudillos(player: PlayerState): boolean {
  const allies = [...player.defenseField, ...player.attackField];
  return allies.length > 0 && allies.every((c) => c.raza === 'Caudillo');
}

/**
 * Should `handOwner`'s hand be revealed to everyone? True when their opponent
 * has a 'revela_mano_caudillos' card in play and controls only Caudillos.
 */
export function isHandRevealed(
  handOwnerId: PlayerId,
  players: Record<PlayerId, PlayerState>,
): boolean {
  const oppId: PlayerId = handOwnerId === 'player' ? 'opponent' : 'player';
  const opp = players[oppId];
  const hasMonitor = [...opp.defenseField, ...opp.attackField, ...opp.supportField, ...opp.gold].some(
    hasRevealHandCaudillos,
  );
  return hasMonitor && controlsOnlyCaudillos(opp);
}

/** Cost discount of the 'talisman_reciclado' activated ability. */
export const TALISMAN_RECYCLE_DISCOUNT = 3;

/**
 * 'talisman_reciclado' (Bernardo O'Higgins): once per turn, play a Talisman
 * from your Cementerio or Destierro reducing its cost by 3 (min 0). After
 * resolving, the talisman is REMOVED from the game (zona R).
 */
export function hasTalismanRecycle(card: Card): boolean {
  return card.habilidadesEspeciales?.includes('talisman_reciclado') ?? false;
}

/**
 * Effective combat force of an ally — single source of truth:
 * - weakened ('debilitar_aliado') → 0, ignoring every bonus;
 * - strength-locked ('fuerza_inmutable' rival) → printed fuerza only;
 * - otherwise printed fuerza + weapon bonus + temp bonuses + Patriota buff.
 */
export function effectiveForce(
  ally: CardInPlay,
  owner: PlayerState,
  players: Record<PlayerId, PlayerState>,
): number {
  if (owner.weakenedAllies?.includes(ally.instanceId)) return 0;
  if (strengthLockedFor(owner.id, players)) return ally.fuerza;
  // 'fuerza1_no_caudillos' en mesa: los aliados no-Caudillo tienen Fuerza 1
  // fija (ignora bonos). Los Caudillo no se ven afectados.
  if (ally.tipo === 'aliado' && ally.raza !== 'Caudillo' && caudilloForceLockActive(players)) {
    return 1;
  }
  return (
    ally.fuerza +
    (owner.equippedWeapons[ally.instanceId]?.bonusFuerza ?? 0) +
    (owner.weaponTempBonuses[ally.instanceId] ?? 0) +
    patriotaBonus(ally, owner, players) +
    graveyardForceBonus(ally, owner)
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
