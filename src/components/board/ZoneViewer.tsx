import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import { Modal } from '@/components/ui/Modal';
import { CardView } from '@/components/cards/CardView';
import { CardDetail } from '@/components/cards/CardDetail';

interface ZoneViewerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Título de la zona, p.ej. "Cementerio" */
  title: string;
  /** Letra identificadora de la zona (P, R, M, +, O, D) */
  letter?: string;
  cards: CardInPlay[];
  /**
   * Acción opcional del detalle de carta (p.ej. pagar un oro 'oro_talismanes').
   * Devuelve null para cartas sin acción.
   */
  detailAction?: (card: CardInPlay) => { label: string; onUse: () => void } | null;
  /** Cartas a destacar con marco dorado (p.ej. jugables desde esta zona). */
  isHighlighted?: (card: CardInPlay) => boolean;
}

/**
 * Visor de zona: modal que muestra todas las cartas de una zona del tablero.
 * Regla: un jugador solo puede inspeccionar SUS PROPIAS zonas — el llamador
 * decide si abrirlo (ver `canInspectZone` en SideZones). Una habilidad o
 * habilidad especial de carta podrá habilitar mirar zonas del oponente.
 */
export function ZoneViewer({ isOpen, onClose, title, letter, cards, detailAction, isHighlighted }: ZoneViewerProps) {
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);
  const action = detailCard ? detailAction?.(detailCard) ?? null : null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${letter ? `${letter} — ` : ''}${title} (${cards.length})`}
      >
        {cards.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-6">
            No hay cartas en esta zona.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {/* Se muestran en orden de llegada; la última carta es la de más arriba */}
            {cards.map((card, i) => (
              <div key={card.instanceId} className="relative">
                {/* Marco dorado: carta con acción disponible desde esta zona */}
                {isHighlighted?.(card) && (
                  <div className="absolute -inset-0.5 rounded-lg ring-2 ring-yellow-400 animate-pulse pointer-events-none z-20" />
                )}
                <CardView card={card} size="sm" onClick={() => setDetailCard(card)} />
                <span className="absolute -top-1 -left-1 z-10 bg-slate-800 text-slate-400 text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-slate-600">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <CardDetail
        card={detailCard}
        isOpen={!!detailCard}
        onClose={() => setDetailCard(null)}
        onUseSpecialAbility={
          action
            ? () => {
                action.onUse();
                setDetailCard(null);
                onClose();
              }
            : undefined
        }
        canUseSpecialAbility={!!action}
        specialAbilityLabel={action?.label}
      />
    </>
  );
}
