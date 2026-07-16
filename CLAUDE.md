# MYL Front — Contexto del proyecto

> **Documentación canónica y completa** (reglas del juego, catálogo de
> habilidades implementadas, infraestructura de producción y flujo de trabajo
> de cartas nuevas) en el vault Obsidian JARVIS:
> `/Users/koke/Library/CloudStorage/GoogleDrive-kokehdev@gmail.com/Mi unidad/Jarvis/wiki/analisis/MYL — Reglas del Juego.md`
> — en especial §9 (habilidades), §12 (producción: Netlify/Render/Atlas/Drive)
> y §13 (flujo paso a paso para implementar la habilidad de una carta).
> Leerla SIEMPRE antes de trabajar en habilidades de cartas.

## Qué significa "agregar cartas" (modelo de colaboración)

Estamos digitalizando la colección física de MYL de Koke, carta por carta,
convirtiendo el texto impreso de cada una en mecánicas jugables reales. No es
solo meter datos: **cada carta nueva puede introducir reglas de juego nuevas**
(keywords, triggers, efectos con objetivo, ventanas de respuesta…). El reparto
de roles es fijo:

- **Koke** crea la carta en el editor web (foto escaneada, stats, texto de
  habilidad, habilidades especiales que ya existan) y explica en el chat cómo
  funciona cada habilidad nueva, con sus matices de reglas.
- **Claude** descompone el texto en habilidades con código, implementa la
  mecánica, la asigna a la carta en Atlas y despliega. Ante ambigüedades de
  reglas (¿afecta a ambos jugadores?, ¿una vez por turno?, ¿incluye a la
  propia carta?) se pregunta a Koke — él es la autoridad de las reglas.

**Dos principios de diseño que rigen SIEMPRE:**
1. **No romper lo que ya funciona.** Antes de tocar puntos compartidos
   (`playCard`, `resolveCombat`, `effectiveForce`, `effectiveCost`, el modelo
   de armas, la ventana de respuesta, los `pending*`), entender cómo lo usan
   las cartas ya implementadas y verificar que el cambio no interfiere. El
   juego está en producción; un refactor mal hecho rompe decenas de cartas.
   Correr `tsc` (front + server) tras cada bloque de cambios.
2. **Preferir habilidades genéricas y reutilizables.** Si una habilidad puede
   servir a más de una carta, se crea con un `code` genérico y parametrizable
   en vez de uno atado a una carta concreta. Antes de crear una habilidad
   nueva, revisar el catálogo (`SEED_ABILITIES` + §9 de JARVIS): si ya existe
   una equivalente o casi, reutilizarla o generalizarla. Ejemplos ya hechos:
   `effectiveForce`/`effectiveCost` centralizan fuerza/coste; los guards
   `isIndestructibleEffective`, `hasInmunidadTalismanesEffective`,
   `annulBlockReason`, `hasFuriaEffective` combinan la keyword propia con la
   otorgada por otra carta; `reapplyCostOneSuppression` sirve a Bandera
   Transición y Héroes de Chile; `targetingStore` cubre todos los efectos con
   objetivo en tablero.

Cómo descomponer el texto de una carta (regla canónica):
- **Negrita en la carta física = habilidad especial** (keyword transversal,
  `categoria: 'especial'`): Furia, Relámpago, Imbloqueable, Única, Orbe…
- **Texto normal = restricciones y habilidades de carta**
  (`categoria: 'carta'`): cada una recibe un code snake_case descriptivo
  (p.ej. `botar3_destruye`, `oro_robar_descartar`) aunque la carta impresa
  no le dé nombre. Ambas categorías se guardan igual en
  `habilidadesEspeciales[]` de la carta; la distinción es de catálogo/UI.
- Cada habilidad lleva `tipos` (a qué tipos de carta aplica) para que el
  editor filtre los chips por tipo.

Patrones de implementación ya construidos (reutilizarlos, no reinventar):
- **Guards/predicados** en `gameRules.ts` (`hasX(card)`) + constantes de
  costes. Guards "obligatorios para efectos futuros": `annulBlockReason`,
  `cannotLeavePlay`, `hasInmunidadTalismanes`, `isProtectedFromAnnulment`.
- **`effectiveForce(ally, owner, players)`**: única fuente de verdad de la
  fuerza (debilitado → 0; `fuerza_inmutable` → impresa; `fuerza1_no_caudillos`
  → 1; si no, base + arma + temporales + buff Patriota). Toda mecánica de
  fuerza se integra AHÍ.
- **Targeting en tablero** (`targetingStore`): marco rojo pulsante
  (debilitar/destruir) o dorado (intercambio de control / seleccionables);
  banner superior con Cancelar.
- **Decisiones al entrar en juego**: estado `pending*` en `GameState`
  (sincronizado online) + modal en `GameBoard` (ej. `pendingShuffleChoice`,
  `pendingSwapChoice`, `pendingDiscard`).
- **Ventana de respuesta** (`responseWindow`, 10 s tras jugar aliado/talismán,
  siempre): talismanes `anular_respuesta` anulan → zona Removidas + robo.
- **Acciones desde zonas** (`ZoneViewer.detailAction` + zona dorada
  `SmallZone.highlight`): oros activables, jugar desde Cementerio/Destierro.
- **Velocidad de respuesta**: `relampago`/`instantaneo` ignoran turno/fase en
  `canPlayCard`; sus acciones online van con `ownerGated` (gate de asiento,
  no de turno) en `useGameActions`.
- **Límite "una vez por turno"**: `allyAbilityUsedThisTurn` /
  `weaponAbilityUsedThisTurn`, o el propio ciclo de zonas (oros pagados).
- Duraciones "hasta la Fase Final" expiran en `endTurn`
  (`weakenedAllies`, `weaponTempBonuses`, `talismanGold`).

## Flujo de cartas nuevas (resumen; detalle en JARVIS §13)

1. Koke crea la carta en el editor web de producción (https://mylgame.netlify.app);
   nace con `logica_pendiente: true` (badge ⚠ en el catálogo).
2. Koke pasa el texto de la carta: **negrita = habilidad especial (keyword)**,
   texto normal = restricciones y habilidades de carta.
3. Implementar: predicado en `src/utils/gameRules.ts`, mecánica en
   `src/store/gameStore.ts` (+ UI), entrada en `SEED_ABILITIES`
   (`server/src/cards/seed-cards.ts`) con `categoria` y `tipos`.
4. Asignar los codes a la carta directamente en Atlas (la fuente de verdad
   del catálogo es Atlas, no el Mongo local).
5. **Al completar la lógica, poner `logica_pendiente: false` en la carta** —
   solo cuando quede 100 % jugable.
6. Typecheck front+server, commit y push a `main` → Netlify y Render
   redespliegan solos (~3 min). Documentar en JARVIS (§9 + log).

## Descripción del juego

MYL es un juego de cartas para dos jugadores. Cada jugador tiene **dos mazos** de cartas:

1. **Mazo de castillo** — representa el castillo medieval del jugador. El oponente debe derribarlo usando ataques y/o habilidades.
2. **Mazo de juego** — las cartas que el jugador usa para atacar, defender y activar habilidades.

El objetivo de cada jugador es destruir el castillo del oponente antes de que destruyan el suyo.

---

## Reglas fundamentales del juego

### Robar cartas del mazo castillo
- Un jugador **solo puede robar una carta de su mazo castillo al finalizar su turno**, y únicamente en ese momento.
- La única excepción es si una habilidad de carta específica permite robar cartas del mazo castillo fuera de ese momento.

### Tipos de carta
Los tipos válidos son exactamente 5: **oro, aliado, tótem, arma, talismán** (no existe el tipo "tierra").

### Armas y habilidad "maquinaria"
- Un arma debe **asignarse a un aliado específico** al jugarse (drag & drop sobre el aliado → `equipWeapon`).
- Excepción: si el arma tiene la habilidad especial **"maquinaria"** (`habilidadesEspeciales: ['maquinaria']` en `Card`), puede jugarse en la línea de apoyo como si fuera un tótem.

### Oro inicial
Cada jugador comienza la partida con **1 oro ya jugado** ("oro inicial"), extraído automáticamente de su propio mazo al inicio.

### Fases del turno (orden)
> Ajustar según la implementación real en `src/utils/gameRules.ts` si se añaden más fases.

1. Inicio del turno (activación de efectos de inicio)
2. Fase de acción del jugador (jugar cartas, atacar, activar habilidades)
3. Final del turno — el jugador **puede** robar 1 carta de su mazo castillo

---

## Convenciones de código

- React + TypeScript + Vite
- Estado global con Zustand (`src/store/gameStore.ts`)
- Lógica de reglas en `src/utils/gameRules.ts`
- Hooks personalizados en `src/hooks/`
- Componentes del tablero en `src/components/board/`
- Idioma de comunicación con el usuario: **Español**
- Idioma del código (variables, funciones, comentarios técnicos): **Inglés**

---

## Notas de diseño

- Cualquier cambio en las reglas del turno debe reflejarse tanto en `gameRules.ts` como en `gameStore.ts`.
- Los mazos castillo y de juego son entidades distintas y deben tratarse como tal en el estado y la UI.
