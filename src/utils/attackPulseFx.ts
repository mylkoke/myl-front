import gsap from 'gsap';

/**
 * Attack-declared FX: the attacking ally lunges forward with a double red
 * shockwave ring, marking who just entered the battle.
 *
 * Triggered by state-diff on `combat.attackerInstanceId` in GameBoard;
 * the card is located via its `data-fx-instance` anchor.
 */
export function playAttackPulseFx(instanceId: string): void {
  const el = document.querySelector<HTMLElement>(`[data-fx-instance="${instanceId}"]`);
  if (!el) return;

  const r = el.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:58;pointer-events:none;';
  document.body.appendChild(layer);

  // Two expanding shockwave rings around the attacker.
  const rings = [0, 1].map(() => {
    const ring = document.createElement('div');
    ring.style.cssText = [
      `position:absolute;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`,
      `width:${r.width}px;height:${r.height}px`,
      'transform:translate(-50%,-50%) scale(0.9)',
      'border-radius:10px;border:2px solid rgba(248,113,113,0.85)',
      'box-shadow:0 0 14px rgba(220,38,38,0.6);opacity:0;will-change:transform,opacity',
    ].join(';');
    layer.appendChild(ring);
    return ring;
  });

  const tl = gsap.timeline({ onComplete: () => layer.remove() });
  rings.forEach((ring, i) => {
    tl.fromTo(
      ring,
      { opacity: 0.9, scale: 0.9 },
      {
        opacity: 0,
        scale: 1.5 + i * 0.25,
        duration: 0.55,
        ease: 'power2.out',
        transformOrigin: 'center',
      },
      i * 0.18,
    );
  });
  // The card itself lunges toward the enemy side and snaps back.
  tl.fromTo(
    el,
    { scale: 1 },
    { scale: 1.12, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'scale' },
    0,
  );
}
