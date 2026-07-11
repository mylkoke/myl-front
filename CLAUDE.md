# MYL Front — Contexto del proyecto

> **Documentación canónica y completa** (reglas del juego, catálogo de
> habilidades implementadas, infraestructura de producción y flujo de trabajo
> de cartas nuevas) en el vault Obsidian JARVIS:
> `/Users/koke/Library/CloudStorage/GoogleDrive-kokehdev@gmail.com/Mi unidad/Jarvis/wiki/analisis/MYL — Reglas del Juego.md`
> — en especial §9 (habilidades), §12 (producción: Netlify/Render/Atlas/Drive)
> y §13 (flujo paso a paso para implementar la habilidad de una carta).
> Leerla SIEMPRE antes de trabajar en habilidades de cartas.

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
