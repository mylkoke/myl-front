import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import type { PlayerId } from '@/types/game.types';

gsap.registerPlugin(MotionPathPlugin);

/**
 * Draw-card FX: simulates a hand physically picking the top card of the
 * castle deck (M) and carrying it along an arc into the player's hand row.
 *
 * Sequence: 🖐️ open hand slides toward the deck → ✊ grabs (card lifts with
 * shadow) → both travel a curved path to the hand zone → 🖐️ releases → the
 * card flips revealing a golden face with the card name → melts into the
 * hand row, which pulses gold to confirm the arrival.
 *
 * Purely visual: it runs BEFORE the store mutation, using data-fx anchors
 * (`deck-<playerId>` / `hand-<playerId>`). Resolves when the timeline ends.
 */
export function playDrawCardFx(playerId: PlayerId, cardName?: string): Promise<void> {
  return new Promise((resolve) => {
    const deckEl = document.querySelector<HTMLElement>(`[data-fx="deck-${playerId}"]`);
    const handEl = document.querySelector<HTMLElement>(`[data-fx="hand-${playerId}"]`);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!deckEl || !handEl || reduced) {
      resolve();
      return;
    }

    const d = deckEl.getBoundingClientRect();
    const h = handEl.getBoundingClientRect();

    // Card ghost size ≈ the deck pile footprint.
    const cw = Math.max(56, Math.min(d.width * 0.85, 96));
    const ch = cw * 1.33;

    const startX = d.left + d.width / 2;
    const startY = d.top + d.height / 2;
    const endX = h.left + h.width / 2;
    const endY = h.top + h.height / 2;

    // FX overlay (portal-free, pointer-transparent, above the board).
    const layer = document.createElement('div');
    layer.style.cssText =
      'position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden;';

    // Card ghost — back face (deck look).
    const card = document.createElement('div');
    card.style.cssText = [
      `position:absolute;left:${startX - cw / 2}px;top:${startY - ch / 2}px`,
      `width:${cw}px;height:${ch}px`,
      'border-radius:8px;border:2px solid rgba(148,163,184,0.6)',
      'background:linear-gradient(135deg,#334155,#0f172a)',
      'display:flex;align-items:center;justify-content:center',
      'box-shadow:0 4px 10px rgba(0,0,0,0.45)',
      'will-change:transform;backface-visibility:hidden',
    ].join(';');
    card.innerHTML =
      '<span style="color:rgba(234,179,8,0.4);font-weight:900;font-size:22px;font-family:inherit">M</span>';

    // Golden front face, revealed on the flip.
    const front = document.createElement('div');
    front.style.cssText = [
      'position:absolute;inset:-2px;border-radius:8px;border:2px solid rgba(250,204,21,0.9)',
      'background:linear-gradient(150deg,#713f12,#422006 60%,#1c1917)',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px',
      'padding:4px;text-align:center;opacity:0',
      'box-shadow:0 0 24px rgba(250,204,21,0.35)',
    ].join(';');
    front.innerHTML = `
      <span style="color:#fde047;font-size:16px">✦</span>
      <span style="color:#fefce8;font-weight:800;font-size:10px;line-height:1.15">${
        cardName ? cardName.replace(/</g, '&lt;') : 'Carta robada'
      }</span>`;
    card.appendChild(front);

    // The grabbing hand.
    const hand = document.createElement('div');
    hand.style.cssText = [
      `position:absolute;left:${startX - 18}px;top:${startY - 6}px`,
      'font-size:34px;line-height:1;will-change:transform',
      'filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5))',
    ].join(';');
    hand.textContent = '🖐️';

    layer.appendChild(card);
    layer.appendChild(hand);
    document.body.appendChild(layer);

    const dx = endX - startX;
    const dy = endY - startY;
    // Control point of the arc: sideways + lifted, so the card "swings" naturally.
    const arc = { x: dx * 0.5 + (dx >= 0 ? -40 : 40), y: dy * 0.5 - Math.max(60, Math.abs(dy) * 0.35) };

    const cleanup = () => {
      layer.remove();
      resolve();
    };

    const tl = gsap.timeline({ onComplete: cleanup });

    // 1. The open hand approaches the deck.
    tl.from(hand, { x: 60, y: 90, opacity: 0, rotate: -25, duration: 0.32, ease: 'power2.out' });

    // 2. Grab: fist closes, the card lifts off the pile.
    tl.call(() => { hand.textContent = '✊'; });
    tl.to(card, {
      scale: 1.14,
      rotate: -4,
      boxShadow: '0 16px 30px rgba(0,0,0,0.6)',
      duration: 0.18,
      ease: 'back.out(2)',
    });

    // 3. Carry both along the arc to the hand row.
    tl.to([card, hand], {
      motionPath: { path: [{ x: arc.x, y: arc.y }, { x: dx, y: dy }], curviness: 1.4 },
      rotate: 3,
      duration: 0.68,
      ease: 'power2.inOut',
    }, '+=0.05');

    // 4. Release: the hand opens and drifts away.
    tl.call(() => { hand.textContent = '🖐️'; });
    tl.to(hand, { y: `-=36`, opacity: 0, rotate: 15, duration: 0.28, ease: 'power1.in' });

    // 5. Flip reveal: back → golden front with the card name.
    tl.to(card, { rotateY: 90, duration: 0.16, ease: 'power1.in' }, '<');
    tl.call(() => { front.style.opacity = '1'; });
    tl.to(card, { rotateY: 0, duration: 0.2, ease: 'power1.out' });

    // 6. The card melts into the hand row, which pulses gold.
    tl.to(card, { scale: 0.5, y: `+=${h.height / 2}`, opacity: 0, duration: 0.34, ease: 'power2.in' }, '+=0.28');
    tl.fromTo(
      handEl,
      { boxShadow: '0 0 0 0 rgba(250,204,21,0.55)' },
      { boxShadow: '0 0 18px 4px rgba(250,204,21,0)', duration: 0.6, ease: 'power2.out', clearProps: 'boxShadow' },
      '<',
    );
  });
}
