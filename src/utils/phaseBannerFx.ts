import gsap from 'gsap';
import type { TurnPhase } from '@/types/game.types';

/** Accent color per phase (banner text glow + sweep lines). */
const PHASE_COLORS: Record<TurnPhase, string> = {
  agrupacion: '251,191,36',  // amber
  vigilia:    '56,189,248',  // sky
  batalla:    '248,113,113', // red
  final:      '167,139,250', // violet
};

/**
 * Phase-change banner: the phase name sweeps into the center of the board
 * between two horizontal light rays, holds for a beat and dissolves.
 *
 * Triggered by state-diff on `turn.phase` in GameBoard, so it plays in
 * local and on BOTH devices online.
 */
export function playPhaseBannerFx(phase: TurnPhase, label: string): void {
  const rgb = PHASE_COLORS[phase] ?? '251,191,36';

  const layer = document.createElement('div');
  layer.style.cssText = [
    'position:fixed;inset:0;z-index:55;pointer-events:none',
    'display:flex;align-items:center;justify-content:center;flex-direction:column',
  ].join(';');
  document.body.appendChild(layer);

  const makeLine = () => {
    const line = document.createElement('div');
    line.style.cssText = [
      'height:2px;width:min(60vw,340px);margin:10px 0',
      `background:linear-gradient(90deg,transparent,rgba(${rgb},0.9),transparent)`,
      'transform:scaleX(0);will-change:transform,opacity',
    ].join(';');
    return line;
  };
  const topLine = makeLine();
  const text = document.createElement('div');
  text.textContent = label;
  text.style.cssText = [
    'font-weight:900;font-size:clamp(20px,4.5vw,34px);letter-spacing:0.14em',
    'text-transform:uppercase;color:#f8fafc;text-align:center;padding:0 16px',
    `text-shadow:0 0 18px rgba(${rgb},0.9),0 0 40px rgba(${rgb},0.45),0 2px 4px rgba(0,0,0,0.9)`,
    'opacity:0;will-change:transform,opacity',
  ].join(';');
  const bottomLine = makeLine();
  layer.append(topLine, text, bottomLine);

  const tl = gsap.timeline({ onComplete: () => layer.remove() });
  tl.to([topLine, bottomLine], { scaleX: 1, duration: 0.3, ease: 'power2.out' }, 0);
  tl.fromTo(
    text,
    { opacity: 0, y: 14, scale: 0.92 },
    { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: 'back.out(1.8)' },
    0.06,
  );
  tl.to([topLine, bottomLine], { opacity: 0, duration: 0.35, ease: 'power1.in' }, 1.0);
  tl.to(text, { opacity: 0, y: -12, duration: 0.35, ease: 'power1.in' }, 1.0);
}
