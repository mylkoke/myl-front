import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import type { PlayerId } from '@/types/game.types';

gsap.registerPlugin(MotionPathPlugin);

/**
 * Ally-destroyed FX: a fallen ally shatters and its remains fall into
 * its owner's graveyard.
 *
 * The card ghost flashes red at the slot where the ally stood (rect captured
 * BEFORE React unmounted it), bursts into shards that scatter, and the card
 * itself tumbles in an arc down to the graveyard, which flashes on impact.
 *
 * Triggered by state-diff detection in GameBoard (an instanceId disappears
 * from both field lines), so it plays in local and on BOTH devices online.
 */
export function playAllyDestroyedFx(rect: DOMRect, playerId: PlayerId): void {
  const graveEl = document.querySelector<HTMLElement>(`[data-fx="grave-${playerId}"]`);
  if (!graveEl) return;

  const g = graveEl.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const dx = g.left + g.width / 2 - startX;
  const dy = g.top + g.height / 2 - startY;

  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden;';
  document.body.appendChild(layer);

  // Card ghost standing where the ally was.
  const card = document.createElement('div');
  card.style.cssText = [
    `position:absolute;left:${startX - rect.width / 2}px;top:${startY - rect.height / 2}px`,
    `width:${rect.width}px;height:${rect.height}px`,
    'border-radius:8px;border:2px solid rgba(248,113,113,0.9)',
    'background:linear-gradient(135deg,rgba(127,29,29,0.9),rgba(15,23,42,0.95))',
    'box-shadow:0 0 18px rgba(220,38,38,0.6)',
    'will-change:transform,opacity',
  ].join(';');
  layer.appendChild(card);

  // Shards bursting out of the card on the killing blow.
  const shards: HTMLElement[] = [];
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div');
    const size = 5 + Math.random() * 7;
    s.style.cssText = [
      `position:absolute;left:${startX}px;top:${startY}px`,
      `width:${size}px;height:${size}px`,
      'background:rgba(248,113,113,0.9);border-radius:2px',
      'box-shadow:0 0 8px rgba(220,38,38,0.8);opacity:0',
      'will-change:transform,opacity',
    ].join(';');
    layer.appendChild(s);
    shards.push(s);
  }

  const tl = gsap.timeline({ onComplete: () => layer.remove() });

  // 1. Impact: white-hot flash + shake where the ally stood.
  tl.fromTo(
    card,
    { opacity: 0, scale: 1 },
    { opacity: 1, scale: 1.12, duration: 0.12, ease: 'power2.out' },
    0,
  );
  tl.to(card, { x: '+=5', duration: 0.045, repeat: 5, yoyo: true, ease: 'none' }, 0.1);

  // 2. Shards scatter outward and fall.
  shards.forEach((s, i) => {
    const ang = (i / shards.length) * Math.PI * 2 + Math.random() * 0.7;
    tl.fromTo(
      s,
      { opacity: 1, x: 0, y: 0 },
      {
        x: Math.cos(ang) * (36 + Math.random() * 30),
        y: Math.sin(ang) * (26 + Math.random() * 22) + 34,
        rotation: Math.random() * 240 - 120,
        opacity: 0,
        duration: 0.55 + Math.random() * 0.25,
        ease: 'power2.out',
      },
      0.14,
    );
  });

  // 3. The broken card tumbles in an arc into the graveyard.
  tl.to(
    card,
    {
      motionPath: {
        path: [
          { x: dx * 0.45, y: dy * 0.45 - Math.max(50, Math.abs(dy) * 0.3) },
          { x: dx, y: dy },
        ],
        curviness: 1.2,
      },
      rotation: dx >= 0 ? 100 : -100,
      scale: 0.4,
      opacity: 0.15,
      duration: 0.55,
      ease: 'power1.in',
    },
    0.3,
  );
  tl.to(card, { opacity: 0, duration: 0.12 }, 0.82);

  // 4. Graveyard flashes on impact.
  tl.fromTo(
    graveEl,
    { boxShadow: '0 0 0 0 rgba(220,38,38,0.65)', scale: 1.08 },
    {
      boxShadow: '0 0 20px 6px rgba(220,38,38,0)',
      scale: 1,
      duration: 0.4,
      ease: 'power2.out',
      clearProps: 'boxShadow,scale',
    },
    0.82,
  );
}
