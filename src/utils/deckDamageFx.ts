import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import type { PlayerId } from '@/types/game.types';

gsap.registerPlugin(MotionPathPlugin);

/**
 * Deck-damage FX: dramatizes combat damage to the castle deck.
 *
 * The lost cards travel ONE BY ONE from the castle deck (M) to the
 * graveyard (+): each card lifts off the pile, flips face-up mid-air while
 * burning red, lands on the graveyard (which flashes on every impact) and
 * only then the next one departs. Meanwhile the deck shakes, a "−N" damage
 * counter ticks up card by card, and a red vignette pulses on screen.
 *
 * Triggered by state-diff detection in GameBoard (works in local AND on
 * both devices online). Anchors: `data-fx="deck-<id>"` / `data-fx="grave-<id>"`.
 */
export function playDeckDamageFx(playerId: PlayerId, count: number): void {
  if (count <= 0) return;
  const deckEl = document.querySelector<HTMLElement>(`[data-fx="deck-${playerId}"]`);
  const graveEl = document.querySelector<HTMLElement>(`[data-fx="grave-${playerId}"]`);
  if (!deckEl || !graveEl) return;

  const d = deckEl.getBoundingClientRect();
  const g = graveEl.getBoundingClientRect();

  const cw = Math.max(56, Math.min(d.width * 0.9, 96));
  const ch = cw * 1.33;
  const startX = d.left + d.width / 2;
  const startY = d.top + d.height / 2;
  const dx = g.left + g.width / 2 - startX;
  const dy = g.top + g.height / 2 - startY;

  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden;';
  document.body.appendChild(layer);

  // Red vignette pulse (screen-wide hit feedback).
  const vignette = document.createElement('div');
  vignette.style.cssText = [
    'position:absolute;inset:0;opacity:0',
    'background:radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(220,38,38,0.4) 100%)',
  ].join(';');
  layer.appendChild(vignette);

  // Damage counter that ticks up as each card falls.
  const dmg = document.createElement('div');
  dmg.textContent = '−0';
  dmg.style.cssText = [
    `position:absolute;left:${startX}px;top:${startY - ch / 2 - 10}px`,
    'transform:translate(-50%,-100%)',
    'font-weight:900;font-size:32px;color:#f87171;font-family:inherit;opacity:0',
    'text-shadow:0 0 12px rgba(220,38,38,0.85),0 2px 3px rgba(0,0,0,0.9)',
    'will-change:transform,opacity',
  ].join(';');
  layer.appendChild(dmg);

  const shown = Math.min(count, 8);
  const master = gsap.timeline({ onComplete: () => layer.remove() });

  // Opening hit: vignette + deck shake + counter appears.
  master.to(vignette, { opacity: 1, duration: 0.12, ease: 'power1.out' }, 0);
  master.to(vignette, { opacity: 0, duration: 0.7, ease: 'power2.out' }, 0.3);
  master.fromTo(
    deckEl,
    { x: -4, rotate: -2 },
    { x: 4, rotate: 2, duration: 0.06, repeat: 7, yoyo: true, clearProps: 'x,rotate', ease: 'none' },
    0,
  );
  master.fromTo(
    dmg,
    { scale: 0.4, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2.5)' },
    0,
  );

  // Cards leave the deck ONE BY ONE.
  const STEP = 0.62;                 // cuánto tarda cada carta en salir tras la anterior
  for (let i = 0; i < shown; i++) {
    const card = document.createElement('div');
    card.style.cssText = [
      `position:absolute;left:${startX - cw / 2}px;top:${startY - ch / 2}px`,
      `width:${cw}px;height:${ch}px`,
      'border-radius:8px;border:2px solid rgba(148,163,184,0.7)',
      'background:linear-gradient(135deg,#334155,#0f172a)',
      'display:flex;align-items:center;justify-content:center',
      'box-shadow:0 6px 14px rgba(0,0,0,0.55)',
      'opacity:0;will-change:transform,opacity',
    ].join(';');
    card.innerHTML =
      '<span style="color:rgba(234,179,8,0.4);font-weight:900;font-size:20px;font-family:inherit">M</span>';
    layer.appendChild(card);

    const t0 = 0.25 + i * STEP;      // cada carta parte cuando la anterior va aterrizando
    const tilt = (i % 2 === 0 ? 1 : -1) * (10 + Math.random() * 8);

    // 1. La carta se levanta del mazo.
    master.fromTo(
      card,
      { opacity: 0, scale: 0.9, y: 0 },
      { opacity: 1, scale: 1.12, y: -14, rotate: -tilt * 0.4, duration: 0.16, ease: 'power2.out' },
      t0,
    );
    // 2. Viaja en arco hacia el cementerio, quemándose en rojo.
    master.to(
      card,
      {
        motionPath: {
          path: [
            { x: dx * 0.5, y: dy * 0.5 - Math.max(70, Math.abs(dy) * 0.4) },
            { x: dx, y: dy },
          ],
          curviness: 1.3,
        },
        rotate: tilt,
        scale: 0.8,
        borderColor: 'rgba(220,38,38,0.95)',
        boxShadow: '0 0 22px rgba(220,38,38,0.7)',
        duration: 0.5,
        ease: 'power1.inOut',
      },
      t0 + 0.16,
    );
    // 3. Aterriza: se funde en el cementerio, que destella en rojo.
    master.to(card, { opacity: 0, scale: 0.55, duration: 0.18, ease: 'power1.in' }, t0 + 0.66);
    master.fromTo(
      graveEl,
      { boxShadow: '0 0 0 0 rgba(220,38,38,0.65)', scale: 1.06 },
      {
        boxShadow: '0 0 18px 5px rgba(220,38,38,0)',
        scale: 1,
        duration: 0.35,
        ease: 'power2.out',
        clearProps: 'boxShadow,scale',
      },
      t0 + 0.66,
    );
    // 4. El contador de daño avanza con cada carta que cae.
    master.call(() => { dmg.textContent = `−${Math.min(i + 1, count)}`; }, undefined, t0 + 0.68);
    master.fromTo(dmg, { scale: 1.3 }, { scale: 1, duration: 0.18, ease: 'power2.out' }, t0 + 0.68);
  }

  // Si el daño real supera las cartas mostradas, el contador salta al total.
  if (count > shown) {
    master.call(() => { dmg.textContent = `−${count}`; }, undefined, 0.25 + shown * STEP + 0.1);
  }

  // Cierre: el contador flota y se desvanece.
  master.to(dmg, { y: -50, opacity: 0, duration: 0.8, ease: 'power1.in' }, '+=0.35');
}
