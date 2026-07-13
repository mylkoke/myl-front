import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Library, Loader2, Save } from 'lucide-react';
import type { Card, CardInPlay } from '@/types/card.types';
import { CardView } from '@/components/cards/CardView';
import { CardDetail } from '@/components/cards/CardDetail';
import { Button } from '@/components/ui/Button';
import { getServices } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { hasOrbe, maxCopiesInDeck } from '@/utils/gameRules';

const MAX_DECK = 60;

/** Deck contents as cardId → qty. */
type DeckMap = Record<string, number>;

function asCardInPlay(card: Card): CardInPlay {
  return { ...card, instanceId: card.id, tapped: false, attackedThisTurn: false, summonedThisTurn: false };
}

export function DeckEditorPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [catalog, setCatalog] = useState<Card[]>([]);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [deckName, setDeckName] = useState('Mi mazo');
  const [deckMap, setDeckMap] = useState<DeckMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Mobile-first: single column with tabs; two panels from lg upward.
  const [tab, setTab] = useState<'deck' | 'catalog'>('deck');
  const [detailCard, setDetailCard] = useState<Card | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { catalog: catalogSvc, decks } = getServices();
        const [cards, myDecks] = await Promise.all([
          catalogSvc.listAvailable(),
          decks.listMine(),
        ]);
        setCatalog(cards);
        const active =
          myDecks.find((d) => d.id === user?.activeDeckId) ?? myDecks[0] ?? null;
        if (active) {
          setDeckId(active.id);
          setDeckName(active.name);
          // Sanea el mazo: descarta entradas de cartas que ya no existen en el
          // catálogo (p.ej. cartas del seed borradas). Sin esto quedan
          // "cartas fantasma" que inflan el total y bloquean el botón Agregar.
          const validIds = new Set(cards.map((c) => c.id));
          const entries = active.entries.filter((e) => validIds.has(e.cardId));
          const ghosts = active.entries.length - entries.length;
          setDeckMap(Object.fromEntries(entries.map((e) => [e.cardId, e.qty])));
          if (ghosts > 0) {
            setMessage(
              `Se quitaron ${ghosts} carta(s) de tu mazo que ya no existen en el catálogo — pulsa Guardar para confirmar`,
            );
          }
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.activeDeckId]);

  const total = useMemo(
    () => Object.values(deckMap).reduce((s, q) => s + q, 0),
    [deckMap],
  );
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  const addCard = (card: Card) => {
    if (total >= MAX_DECK) {
      setMessage(`El mazo ya tiene el máximo de ${MAX_DECK} cartas`);
      return;
    }
    // 'Orbe': solo UNA carta con Orbe en todo el Castillo, sin importar el
    // nombre (incluir una prohíbe la segunda copia y cualquier otra Orbe).
    if (hasOrbe(card)) {
      const orbeInDeck = Object.entries(deckMap).find(([id, qty]) => {
        const c = byId.get(id);
        return qty > 0 && c && hasOrbe(c);
      });
      if (orbeInDeck) {
        const existing = byId.get(orbeInDeck[0]);
        setMessage(
          existing?.id === card.id
            ? `${card.nombre} es Orbe: solo puedes tener 1 carta con Orbe en tu Castillo`
            : `Ya tienes una carta Orbe en el mazo (${existing?.nombre}): solo se permite una en todo el Castillo`,
        );
        return;
      }
    }
    // Regla general: máx. 3 copias por carta; 'Única' → máx. 1 copia por mazo.
    const max = maxCopiesInDeck(card);
    if ((deckMap[card.id] ?? 0) >= max) {
      setMessage(
        max === 1
          ? `${card.nombre} es Única: solo puedes incluir 1 copia en tu Castillo`
          : `Máximo ${max} copias de ${card.nombre} por mazo`,
      );
      return;
    }
    setMessage(null);
    setDeckMap((m) => ({ ...m, [card.id]: (m[card.id] ?? 0) + 1 }));
  };

  const removeCard = (cardId: string) => {
    setMessage(null);
    setDeckMap((m) => {
      const qty = (m[cardId] ?? 0) - 1;
      const next = { ...m };
      if (qty <= 0) delete next[cardId];
      else next[cardId] = qty;
      return next;
    });
  };

  const save = async () => {
    if (!deckId) return;
    setSaving(true);
    setMessage(null);
    try {
      await getServices().decks.setEntries(
        deckId,
        Object.entries(deckMap).map(([cardId, qty]) => ({ cardId, qty })),
      );
      setMessage('Mazo guardado ✓');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const deckCards = Object.entries(deckMap)
    .map(([id, qty]) => ({ card: byId.get(id), qty }))
    .filter((x): x is { card: Card; qty: number } => !!x.card);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1520] flex items-center justify-center">
        <Loader2 size={32} className="text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1520] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/40">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{deckName}</h1>
          <p className={`text-xs ${total > MAX_DECK ? 'text-red-400' : 'text-slate-400'}`}>
            {total}/{MAX_DECK} cartas
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={save}
          disabled={saving || !deckId}
          className="flex items-center gap-1.5"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Guardar
        </Button>
      </header>

      {message && (
        <div className="px-4 py-2 text-xs text-center text-yellow-300 bg-yellow-500/10 border-b border-yellow-500/20">
          {message}
        </div>
      )}

      {/* Tabs — mobile only */}
      <div className="flex lg:hidden border-b border-slate-800">
        {(
          [
            ['deck', 'Mi mazo', Layers],
            ['catalog', 'Cartas disponibles', Library],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors',
              tab === key
                ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-500/5'
                : 'text-slate-500',
            ].join(' ')}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="flex-1 flex flex-col lg:flex-row lg:gap-4 lg:p-4 overflow-hidden">
        {/* Mi mazo */}
        <section
          className={[
            'flex-1 overflow-y-auto p-3 lg:p-4 lg:bg-slate-900/40 lg:rounded-xl lg:border lg:border-slate-800',
            tab === 'deck' ? 'block' : 'hidden lg:block',
          ].join(' ')}
        >
          <h2 className="hidden lg:flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400 mb-3">
            <Layers size={14} /> Mi mazo ({total}/{MAX_DECK})
          </h2>
          {deckCards.length === 0 && (
            <p className="text-slate-600 text-sm italic text-center py-8">
              Tu mazo está vacío — agrega cartas desde "Cartas disponibles"
            </p>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3">
            {deckCards.map(({ card, qty }) => (
              <div key={card.id} className="relative flex flex-col items-center gap-1">
                <div className="relative">
                  <CardView card={asCardInPlay(card)} size="sm" onClick={() => setDetailCard(card)} />
                  {/* Contador de copias: neutro (blanco) para no confundirse
                      con el coste (amarillo) ni la fuerza (rojo) */}
                  <span className="absolute -top-1.5 -right-1.5 z-20 bg-slate-100 text-slate-900 text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center shadow border border-slate-400">
                    ×{qty}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => removeCard(card.id)}
                    className="w-7 h-7 rounded-md bg-slate-800 text-red-400 text-sm font-bold hover:bg-slate-700 active:scale-95 transition-all"
                  >
                    −
                  </button>
                  <button
                    onClick={() => addCard(card)}
                    className="w-7 h-7 rounded-md bg-slate-800 text-green-400 text-sm font-bold hover:bg-slate-700 active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cartas disponibles */}
        <section
          className={[
            'flex-1 overflow-y-auto p-3 lg:p-4 lg:bg-slate-900/40 lg:rounded-xl lg:border lg:border-slate-800',
            tab === 'catalog' ? 'block' : 'hidden lg:block',
          ].join(' ')}
        >
          <h2 className="hidden lg:flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400 mb-3">
            <Library size={14} /> Cartas disponibles ({catalog.length})
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3">
            {catalog.map((card) => (
              <div key={card.id} className="flex flex-col items-center gap-1">
                <CardView card={asCardInPlay(card)} size="sm" onClick={() => setDetailCard(card)} />
                <button
                  onClick={() => addCard(card)}
                  disabled={total >= MAX_DECK}
                  className="w-full py-1.5 rounded-md bg-yellow-500/15 text-yellow-400 text-[11px] font-bold hover:bg-yellow-500/25 active:scale-95 disabled:opacity-40 transition-all"
                >
                  + Agregar {deckMap[card.id] ? `(${deckMap[card.id]})` : ''}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <CardDetail
        card={detailCard ? asCardInPlay(detailCard) : null}
        isOpen={!!detailCard}
        onClose={() => setDetailCard(null)}
      />
    </div>
  );
}
