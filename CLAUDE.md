# MYL Front — Contexto del proyecto

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
