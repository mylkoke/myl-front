---
name: carta
description: Implementar la lógica de juego de una carta MYL nueva en myl-front. Úsala cuando Koke pida "trabajar/crear/implementar la habilidad de <carta>", "sigue con <carta>", o agregar cartas al juego. Cubre el flujo completo: leer la doc canónica, descomponer el texto de la carta en habilidades, implementar sin romper lo existente, asignar en Atlas, documentar y desplegar.
---

# Implementar la habilidad de una carta MYL

Digitalizamos la colección física de MYL carta por carta: Koke sube cada carta
en el editor web y tú programas la lógica de su habilidad. Cada carta puede
introducir reglas nuevas al motor.

## Antes de tocar código (obligatorio)

1. Lee el `CLAUDE.md` del repo y la **documentación canónica** en el vault
   JARVIS: `Jarvis/wiki/analisis/MYL — Reglas del Juego.md` — §9 (catálogo de
   habilidades implementadas), §12 (producción), §13 (flujo paso a paso). Así
   tienes presente TODA la dinámica del juego y no interfieres con lo hecho.
2. Consulta la carta en Atlas (connection string en `server/.env` →
   `MONGODB_URI`; Docker suele estar apagado, usa un script Node con
   `mongoose` desde `server/`) para ver su texto, raza, stats y las
   `special_abilities` que Koke ya asignó.

## Dos principios que rigen siempre

1. **No romper lo que ya funciona.** El juego está en producción. Antes de
   modificar puntos compartidos (`playCard`, `resolveCombat`, `effectiveForce`,
   `effectiveCost`, modelo de armas `equippedWeapons`, ventana de respuesta,
   estados `pending*`, `reapplyCostOneSuppression`, `targetingStore`), entiende
   cómo los usan las cartas existentes y verifica con `tsc` (front + server)
   que el cambio no interfiere.
2. **Prefiere habilidades genéricas y reutilizables.** Si una habilidad puede
   servir a más de una carta, dale un `code` parametrizable y genérico. Antes
   de crear una nueva, revisa `SEED_ABILITIES` (`server/src/cards/seed-cards.ts`)
   y §9 de JARVIS: si ya existe una equivalente o casi, reutilízala o
   generalízala (p.ej. los guards `*Effective` combinan keyword propia +
   otorgada; `effectiveForce`/`effectiveCost` centralizan cálculos).

## Descomponer el texto de la carta

- **Negrita en la carta = habilidad especial** (keyword transversal,
  `categoria: 'especial'`): Furia, Relámpago, Única, Orbe, Mercenario…
- **Texto normal = restricciones y habilidades de carta** (`categoria: 'carta'`):
  cada una recibe un `code` snake_case descriptivo aunque la carta no lo nombre.
- Cada habilidad lleva `tipos` (a qué tipos de carta aplica).
- Ante ambigüedades de reglas (¿ambos jugadores?, ¿1×/turno?, ¿se incluye a sí
  misma?, ¿fuerza impresa o efectiva?), **pregunta a Koke** con AskUserQuestion;
  él es la autoridad de las reglas. Nota canónica: "Fuerza" = fuerza EFECTIVA
  salvo que la carta diga "impresa/base".

## Patrones ya construidos (reutilizar, no reinventar)

- Guards `hasX(card)` en `gameRules.ts` + versiones `*Effective(card, owner)`
  para efectos otorgados por otra carta.
- `effectiveForce(ally, owner, players)` y `effectiveCost(card, players)`:
  únicas fuentes de verdad de fuerza y coste.
- Targeting en tablero: `targetingStore` (marco rojo debilitar/destruir, dorado
  intercambio/equipar) + banner en `GameBoard`.
- Decisiones al entrar / activadas: estado `pending*` en `GameState`
  (sincronizado en `onlineSync`) + modal en `GameBoard`.
- Triggers de entrada: helpers `maybe*OnEnter` llamados desde `playCard`,
  `playFromZone` y `summonCaudilloFromDeck`.
- Ventana de respuesta (`responseWindow`, 10 s) para efectos anulables/en
  respuesta; oros/mano activables vía `ownerGated` en `useGameActions`.
- Duraciones "hasta la Fase Final" (`weaponTempBonuses`, `weakenedAllies`,
  `talismanGold`, `caudilloGold`) expiran en `endTurn`.

## Pasos de implementación

1. Predicado(s) en `src/utils/gameRules.ts` + constantes.
2. Mecánica en `src/store/gameStore.ts` (+ estado en `game.types.ts` y
   `onlineSync.ts` si hay `pending*` o campos nuevos).
3. UI donde corresponda: `AllySlot`, `ThreeLineField`, `SideZones`,
   `ZoneViewer`, `PlayerHand`, `GameBoard`; wrappers en `useGameActions`.
4. Entrada en `SEED_ABILITIES` con `categoria` y `tipos`.
5. `tsc -b` (front) + `tsc --noEmit` (server) + lint de los archivos tocados.
6. Asignar los `code` a la carta en Atlas (`db.cards.updateOne`) con su serie
   `HC`, total 160, y **`logica_pendiente: false`** (solo cuando quede 100%
   jugable — regla explícita de Koke).
7. Documentar en JARVIS (tabla §9 + entrada en `log.md`).
8. Commit + push a `main` (redespliega Netlify + Render) — salvo que Koke pida
   acumular varias cartas para un deploy conjunto.

Ojo con las homónimas: hay pares de cartas con el mismo nombre y distinto
número (Balmaceda / Balmaceda SP, Arturo Prat / Arturo Prat SP, Escudo
Nacional / Escudo Nacional SP, Diego Portales / Diego Portales SP). Confirma
siempre por `numero_carta`.
