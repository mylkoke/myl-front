/**
 * FX de "Relámpago": destello + rayo sobre el tablero cuando una carta con
 * la habilidad se juega fuera de la Vigilia de su dueño. Se dispara desde
 * GameBoard observando `fxLightning` en el estado (funciona en local y en
 * ambos clientes online, que hidratan el mismo estado).
 */
export function playLightningFx(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999', 'pointer-events:none',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(147,197,253,0)',
  ].join(';');

  const bolt = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  bolt.setAttribute('viewBox', '0 0 24 24');
  bolt.setAttribute('width', '180');
  bolt.setAttribute('height', '180');
  bolt.innerHTML =
    '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="#fde047" stroke="#93c5fd" stroke-width="0.8"/>';
  bolt.style.cssText = 'filter:drop-shadow(0 0 24px #93c5fd);opacity:0;transform:scale(0.4)';
  overlay.appendChild(bolt);
  document.body.appendChild(overlay);

  const flashes = overlay.animate(
    [
      { background: 'rgba(219,234,254,0)' },
      { background: 'rgba(219,234,254,0.85)', offset: 0.08 },
      { background: 'rgba(219,234,254,0.05)', offset: 0.2 },
      { background: 'rgba(219,234,254,0.6)', offset: 0.3 },
      { background: 'rgba(219,234,254,0)' },
    ],
    { duration: 700, easing: 'ease-out' },
  );
  bolt.animate(
    [
      { opacity: 0, transform: 'scale(0.4) rotate(-8deg)' },
      { opacity: 1, transform: 'scale(1.15) rotate(4deg)', offset: 0.15 },
      { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: 0.5 },
      { opacity: 0, transform: 'scale(1.3)' },
    ],
    { duration: 700, easing: 'ease-out' },
  );
  flashes.onfinish = () => overlay.remove();
}
