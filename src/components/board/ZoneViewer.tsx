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
const TYPE_LABELS: Record<string, string> = {
  aliado: 'Aliados',
  totem: 'Tótems',
  arma: 'Armas',
  talisman: 'Talismanes',
  oro: 'Oros',
};

const TYPE_CHIP_COLORS: Record<string, string> = {
  aliado: 'bg-blue-500/20 border-blue-400 text-blue-300',
  totem: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
  arma: 'bg-red-500/20 border-red-400 text-red-300',
  talisman: 'bg-purple-500/20 border-purple-400 text-purple-300',
  oro: 'bg-yellow-500/20 border-yellow-400 text-yellow-300',
};

export function ZoneViewer({ isOpen, onClose, title, letter, cards, detailAction, isHighlighted }: ZoneViewerProps) {
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const action = detailCard ? detailAction?.(detailCard) ?? null : null;

  // Desglose por tipo: chips con contador que además filtran la grilla.
  const typeCounts = Object.keys(TYPE_LABELS)
    .map((tipo) => ({ tipo, count: cards.filter((c) => c.tipo === tipo).length }))
    .filter((t) => t.count > 0);
  const visibleCards = typeFilter ? cards.filter((c) => c.tipo === typeFilter) : cards;

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
          <>
            {/* Desglose por tipo — chips que filtran la grilla al tocarlos */}
            {typeCounts.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {typeCounts.map(({ tipo, count }) => {
                  const active = typeFilter === tipo;
                  return (
                    <button
                      key={tipo}
                      onClick={() => setTypeFilter(active ? null : tipo)}
                      className={[
                        'px-2 py-1 rounded-full text-[11px] font-medium border transition-all',
                        TYPE_CHIP_COLORS[tipo],
                        active ? 'ring-1 ring-white/60' : 'opacity-80 hover:opacity-100',
                      ].join(' ')}
                    >
                      {TYPE_LABELS[tipo]} <b>{count}</b>
                    </button>
                  );
                })}
                {typeFilter && (
                  <button
                    onClick={() => setTypeFilter(null)}
                    className="px-2 py-1 rounded-full text-[11px] text-slate-400 hover:text-white underline"
                  >
                    Ver todas
                  </button>
                )}
              </div>
            )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {/* Se muestran en orden de llegada; la última carta es la de más arriba */}
            {visibleCards.map((card, i) => (
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
          </>
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
