import { useState } from 'react';
import type { Card, CardInPlay } from '@/types/card.types';
import { Modal } from '@/components/ui/Modal';
import { CardView } from '@/components/cards/CardView';
import { CardDetail } from '@/components/cards/CardDetail';
import { createCardInPlay } from '@/utils/cardFactory';

interface DeckSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Castle deck of the player activating the ability. */
  deck: Card[];
  /** Which deck cards may be picked (they show in color; the rest grayscale). */
  isEligible: (card: Card) => boolean;
  /** Called with the deck index of the chosen card; the modal closes itself. */
  onPlay: (deckIndex: number) => void;
}

/**
 * Deck-search modal for abilities that fetch a card from the castle deck
 * (e.g. 'invocacion_caudillo'): eligible cards render in full color and are
 * selectable; the rest render grayscale and inert. Tapping an eligible card
 * opens its detail with a "Jugar carta" button that plays it immediately.
 */
export function DeckSearchModal({ isOpen, onClose, title, deck, isEligible, onPlay }: DeckSearchModalProps) {
  const [selected, setSelected] = useState<{ card: CardInPlay; index: number } | null>(null);

  const eligibleCount = deck.filter(isEligible).length;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`${title} (${eligibleCount} elegible${eligibleCount === 1 ? '' : 's'})`}>
        {deck.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-6">El Mazo Castillo está vacío.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {deck.map((card, i) => {
              const eligible = isEligible(card);
              return (
                <div
                  key={`${card.id}-${i}`}
                  className={eligible ? 'cursor-pointer' : 'grayscale opacity-40 pointer-events-none'}
                >
                  <CardView
                    card={createCardInPlay(card)}
                    size="sm"
                    onClick={eligible ? () => setSelected({ card: createCardInPlay(card), index: i }) : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <CardDetail
        card={selected?.card ?? null}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        onPlay={() => {
          if (!selected) return;
          const idx = selected.index;
          setSelected(null);
          onClose();
          onPlay(idx);
        }}
        canPlay
        playLabel="Jugar carta"
      />
    </>
  );
}
