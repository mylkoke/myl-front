import { createPortal } from 'react-dom';
import { useDragStore } from '@/store/dragStore';
import { CardView } from '@/components/cards/CardView';

/**
 * Floating copy of the dragged card that follows the pointer/finger.
 * Rendered once (GameBoard). pointer-events: none so it never interferes
 * with the elementFromPoint hit test.
 */
export function DragGhost() {
  const payload = useDragStore((s) => s.payload);
  const x = useDragStore((s) => s.x);
  const y = useDragStore((s) => s.y);

  if (!payload) return null;

  return createPortal(
    <div
      className="fixed z-[100] pointer-events-none opacity-90 drop-shadow-2xl"
      style={{ left: 0, top: 0, transform: `translate(${x}px, ${y}px) translate(-50%, -80%) rotate(3deg)` }}
    >
      <CardView card={payload.card} size="md" />
    </div>,
    document.body,
  );
}
