import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LabelPicker, type LabelOption } from '@/components/editor/LabelPicker';
import { getServices } from '@/services';
import { ApiError } from '@/services/api/http';
import type { CardType } from '@/types/card.types';
import {
  type AbilityMoment,
  type AbilityMode,
  type AbilityZone,
  type AbilityEffectKind,
  type AbilityDefinition,
  type AbilityCount,
  type DynamicCountSource,
  MOMENT_LABELS,
  MODE_LABELS,
  ZONE_LABELS,
  EFFECT_LABELS,
  DYNAMIC_COUNT_LABELS,
} from '@/types/ability.types';

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-500';

const CARD_TYPES: CardType[] = ['aliado', 'totem', 'arma', 'talisman', 'oro'];

// Opciones derivadas de los diccionarios de `ability.types.ts` (una sola fuente
// de verdad: si se agregan momentos/zonas/efectos, aparecen aquí solos).
const toOptions = <T extends string>(labels: Record<T, string>): LabelOption<T>[] =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

const MOMENT_OPTIONS = toOptions<AbilityMoment>(MOMENT_LABELS);
const MODE_OPTIONS = toOptions<AbilityMode>(MODE_LABELS);
const ZONE_OPTIONS = toOptions<AbilityZone>(ZONE_LABELS);
const EFFECT_OPTIONS = toOptions<AbilityEffectKind>(EFFECT_LABELS);

/** Slug automático a partir del nombre (code snake_case). */
function slugify(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function CreateAbilityPage() {
  const navigate = useNavigate();
  const { catalog } = getServices();

  // Metadatos de la habilidad
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipos, setTipos] = useState<CardType[]>([]);

  // Receta declarativa
  const [moments, setMoments] = useState<AbilityMoment[]>([]);
  const [mode, setMode] = useState<AbilityMode>('automatica');
  const [effectKind, setEffectKind] = useState<AbilityEffectKind>('mover');
  const [from, setFrom] = useState<AbilityZone | null>(null);
  const [to, setTo] = useState<AbilityZone | null>(null);
  const [barajar, setBarajar] = useState(false);
  // Cantidad: fija o dinámica.
  const [countMode, setCountMode] = useState<'fixed' | 'dynamic'>('fixed');
  const [countValue, setCountValue] = useState(1);
  const [countSource, setCountSource] = useState<DynamicCountSource>('allies_controlled');
  // Efecto 'invocar' y 'habilitar_juego' comparten los filtros de objetivo.
  const [summonRaza, setSummonRaza] = useState('');
  const [summonTipo, setSummonTipo] = useState<CardType | null>(null);
  const [summonMaxCoste, setSummonMaxCoste] = useState('');
  // Efecto 'habilitar_juego': descuento de coste (reducción positiva) y tope.
  const [costReduce, setCostReduce] = useState(0);
  const [minCoste, setMinCoste] = useState(1);
  // Condición: coste de activación en oros (solo activable).
  const [costGold, setCostGold] = useState(0);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const code = useMemo(() => slugify(nombre), [nombre]);

  // Barajar se auto-implica (y bloquea) cuando el Mazo Castillo es origen o
  // destino: mover cartas al/desde el mazo re-aleatoriza el orden de robo.
  const deckInvolved = from === 'deck' || to === 'deck';
  const effectiveBarajar = deckInvolved || barajar;

  const buildCount = (): AbilityCount =>
    countMode === 'dynamic'
      ? { kind: 'dynamic', source: countSource }
      : { kind: 'fixed', value: countValue };

  // 'habilitar_juego' es un aura: solo necesita la zona origen (el destino es
  // jugar la carta con las reglas normales, no una zona concreta).
  const isEnablePlay = effectKind === 'habilitar_juego';
  const usesTargetFilters = effectKind === 'invocar' || isEnablePlay;
  const zonesOk = isEnablePlay ? from !== null : from !== null && to !== null && from !== to;
  const countOk = countMode === 'dynamic' || countValue > 0;
  const canSave =
    nombre.trim().length > 0 &&
    code.length > 0 &&
    moments.length > 0 &&
    zonesOk &&
    (effectKind !== 'mover' || countOk) &&
    !saving;

  const buildDefinition = (): AbilityDefinition => {
    const base = { moments, mode, costGold: mode === 'activable' ? costGold : 0 };
    if (effectKind === 'invocar') {
      return {
        ...base,
        effect: {
          kind: 'invocar',
          from: from as AbilityZone,
          to: to as AbilityZone,
          raza: summonRaza.trim() || null,
          tipo: summonTipo,
          maxCoste: summonMaxCoste ? Number(summonMaxCoste) : null,
        },
      };
    }
    if (effectKind === 'habilitar_juego') {
      return {
        ...base,
        effect: {
          kind: 'habilitar_juego',
          from: from as AbilityZone,
          raza: summonRaza.trim() || null,
          tipo: summonTipo,
          maxCoste: summonMaxCoste ? Number(summonMaxCoste) : null,
          costDelta: -costReduce,
          minCoste: Math.max(0, minCoste),
        },
      };
    }
    return {
      ...base,
      effect: {
        kind: 'mover',
        from: from as AbilityZone,
        to: to as AbilityZone,
        count: buildCount(),
        barajar: effectiveBarajar,
      },
    };
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    try {
      await catalog.createAbility({
        code,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        categoria: 'carta',
        tipos,
        definition: buildDefinition(),
      });
      setMessage({
        kind: 'ok',
        text: `Habilidad "${nombre.trim()}" creada. Ya puedes asignarla a cartas desde "Nueva carta".`,
      });
      // Reset del formulario (deja tipos, es lo más reutilizado entre habilidades).
      setNombre('');
      setDescripcion('');
      setMoments([]);
      setMode('automatica');
      setFrom(null);
      setTo(null);
      setBarajar(false);
      setCountMode('fixed');
      setCountValue(1);
      setSummonRaza('');
      setSummonTipo(null);
      setSummonMaxCoste('');
      setCostReduce(0);
      setMinCoste(1);
      setCostGold(0);
    } catch (err) {
      const text =
        err instanceof ApiError
          ? err.message
          : 'No se pudo crear la habilidad. Revisa la conexión.';
      setMessage({ kind: 'error', text });
    } finally {
      setSaving(false);
    }
  };

  // Resumen legible de lo que hará la habilidad (feedback en vivo).
  const preview = useMemo(() => {
    if (from === null || (!isEnablePlay && to === null)) return null;
    const when = moments.length
      ? moments.map((m) => MOMENT_LABELS[m]).join(' + ')
      : '(elige un momento)';
    const modeText =
      mode === 'activable' ? 'el jugador puede' : mode === 'obligatoria' ? 'obligatoriamente' : 'automáticamente';
    const costText = mode === 'activable' && costGold > 0 ? ` pagando ${costGold} oros,` : '';
    if (isEnablePlay) {
      const filtro = [
        summonRaza.trim() ? `raza ${summonRaza.trim()}` : null,
        summonTipo ? `tipo ${summonTipo}` : 'aliado',
        summonMaxCoste ? `coste ≤ ${summonMaxCoste}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      const desc =
        costReduce > 0 ? ` reduciendo su coste en ${costReduce} (mínimo ${Math.max(0, minCoste)})` : '';
      return `${when}: ${modeText} jugar cartas (${filtro}) desde ${ZONE_LABELS[from]} como si estuvieran en tu Mano${desc}.`;
    }
    if (to === null) return null;
    if (effectKind === 'invocar') {
      const filtro = [
        summonRaza.trim() ? `raza ${summonRaza.trim()}` : null,
        summonTipo ? `tipo ${summonTipo}` : 'aliado',
        summonMaxCoste ? `coste ≤ ${summonMaxCoste}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      return `${when}:${costText} ${modeText} jugar una carta (${filtro}) desde ${ZONE_LABELS[from]} a ${ZONE_LABELS[to]}.`;
    }
    const cantidad =
      countMode === 'dynamic' ? DYNAMIC_COUNT_LABELS[countSource].toLowerCase() : `${countValue} carta(s)`;
    const shuffle = effectiveBarajar ? ' y baraja el Mazo Castillo del propietario' : '';
    return `${when}:${costText} ${modeText} mover ${cantidad} de ${ZONE_LABELS[from]} a ${ZONE_LABELS[to]}${shuffle}.`;
  }, [
    moments, mode, effectKind, from, to, countMode, countValue, countSource,
    effectiveBarajar, costGold, summonRaza, summonTipo, summonMaxCoste,
    isEnablePlay, costReduce, minCoste,
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/40">
        <button
          onClick={() => navigate('/editor')}
          className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Wand2 size={15} className="text-sky-400" /> Crear Habilidad
          </h1>
          <p className="text-xs text-slate-400">
            Arma la lógica con piezas; el motor la ejecuta según el reglamento.
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6">
        {/* Identidad de la habilidad */}
        <section className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-slate-500">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder='Ej. "Retorno al castillo"'
              className={inputCls}
            />
            {code && (
              <p className="mt-1 text-[10px] text-slate-500">
                code: <span className="font-mono text-slate-400">{code}</span>
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-slate-500">
              Descripción (texto de la carta, opcional)
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Cómo se describe en la carta física."
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">
              Tipos de carta a los que aplica (vacío = todos)
            </label>
            <LabelPicker
              multiple
              tone="emerald"
              value={tipos}
              onChange={setTipos}
              options={CARD_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>
        </section>

        <hr className="border-slate-800" />

        {/* Momento / tiempo */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-1">¿Cuándo se cumple este efecto?</h2>
          <p className="text-xs text-slate-500 mb-2">Puedes elegir más de uno.</p>
          <LabelPicker multiple tone="sky" value={moments} onChange={setMoments} options={MOMENT_OPTIONS} />
        </section>

        {/* Modo de activación */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-2">¿Cómo se activa?</h2>
          <LabelPicker tone="purple" value={mode} onChange={setMode} options={MODE_OPTIONS} />
        </section>

        <hr className="border-slate-800" />

        {/* Condición: coste de activación (solo activable) */}
        {mode === 'activable' && (
          <section>
            <h2 className="text-sm font-semibold text-white mb-1">Condición: coste en Oros</h2>
            <p className="text-xs text-slate-500 mb-2">
              Al activar, estos Oros pasan de la Reserva a Oro Pagado. 0 = gratis.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={costGold === 0 ? '' : String(costGold)}
              placeholder="0"
              onChange={(e) => setCostGold(Number(e.target.value.replace(/\D/g, '')) || 0)}
              className={`${inputCls} w-28`}
            />
          </section>
        )}

        <hr className="border-slate-800" />

        {/* Efecto */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white mb-2">Efecto</h2>
            <LabelPicker tone="amber" value={effectKind} onChange={setEffectKind} options={EFFECT_OPTIONS} />
          </div>

          <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            {/* Origen: común a los tres efectos */}
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">
                {isEnablePlay ? 'Zona a habilitar (origen)' : 'Desde qué lugar (origen)'}
              </label>
              <LabelPicker
                tone="amber"
                value={from}
                onChange={setFrom}
                options={ZONE_OPTIONS.filter((o) => o.value !== to)}
              />
            </div>
            {/* Destino: solo para "mover" e "invocar" (el aura juega con reglas normales) */}
            {!isEnablePlay && (
              <div>
                <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">
                  Hasta qué lugar (destino)
                </label>
                <LabelPicker
                  tone="amber"
                  value={to}
                  onChange={setTo}
                  options={ZONE_OPTIONS.filter((o) => o.value !== from)}
                />
              </div>
            )}

            {effectKind === 'mover' && (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">
                    ¿Cuántas cartas?
                  </label>
                  <LabelPicker
                    tone="sky"
                    value={countMode}
                    onChange={setCountMode}
                    options={[
                      { value: 'fixed', label: 'Cantidad fija' },
                      { value: 'dynamic', label: 'Cantidad dinámica' },
                    ]}
                  />
                  {countMode === 'fixed' ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={countValue === 0 ? '' : String(countValue)}
                      onChange={(e) => setCountValue(Number(e.target.value.replace(/\D/g, '')) || 0)}
                      className={`${inputCls} w-28 mt-2`}
                    />
                  ) : (
                    <div className="mt-2">
                      <LabelPicker
                        tone="emerald"
                        value={countSource}
                        onChange={setCountSource}
                        options={(Object.keys(DYNAMIC_COUNT_LABELS) as DynamicCountSource[]).map((s) => ({
                          value: s,
                          label: DYNAMIC_COUNT_LABELS[s],
                        }))}
                      />
                    </div>
                  )}
                </div>
                <label
                  className={[
                    'flex items-center gap-2 text-xs select-none rounded-md px-3 py-2 border',
                    deckInvolved
                      ? 'text-slate-500 bg-slate-800/40 border-slate-800 cursor-not-allowed'
                      : 'text-slate-300 bg-slate-800/60 border-slate-700 cursor-pointer',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={effectiveBarajar}
                    disabled={deckInvolved}
                    onChange={(e) => setBarajar(e.target.checked)}
                  />
                  Barajar el Mazo Castillo del propietario al terminar
                  {deckInvolved && (
                    <span className="text-[10px] text-slate-500">(implícito: el Mazo Castillo está involucrado)</span>
                  )}
                </label>
              </>
            )}

            {usesTargetFilters && (
              <>
                <p className="text-[11px] text-slate-400">
                  {isEnablePlay
                    ? 'Mientras esta carta esté en juego, su dueño puede jugar las cartas de la zona origen que cumplan estos filtros como si estuvieran en su Mano, con las reglas normales de turno/fase.'
                    : 'El jugador busca en la zona de origen una carta que cumpla estos filtros, la elige y la juega en el destino sin pagar su coste impreso.'}
                </p>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1.5">
                    Tipo de carta (vacío = aliado)
                  </label>
                  <LabelPicker
                    tone="emerald"
                    value={summonTipo}
                    onChange={(v) => setSummonTipo(v === summonTipo ? null : v)}
                    options={CARD_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1">
                    Filtro de raza (opcional, ej. Caudillo)
                  </label>
                  <input
                    value={summonRaza}
                    onChange={(e) => setSummonRaza(e.target.value)}
                    placeholder="Cualquiera"
                    className={`${inputCls} w-56`}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1">
                    Coste impreso máximo del objetivo (opcional)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={summonMaxCoste}
                    placeholder="Sin límite"
                    onChange={(e) => setSummonMaxCoste(e.target.value.replace(/\D/g, ''))}
                    className={`${inputCls} w-28`}
                  />
                </div>
                {isEnablePlay && (
                  <div className="flex gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1">
                        Reducir coste en
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={costReduce === 0 ? '' : String(costReduce)}
                        placeholder="0"
                        onChange={(e) => setCostReduce(Number(e.target.value.replace(/\D/g, '')) || 0)}
                        className={`${inputCls} w-24`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1">
                        Coste mínimo
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={String(minCoste)}
                        placeholder="1"
                        onChange={(e) => setMinCoste(Number(e.target.value.replace(/\D/g, '')) || 0)}
                        className={`${inputCls} w-24`}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Vista previa */}
        {preview && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2.5 text-xs text-sky-200">
            <span className="uppercase tracking-wide text-[10px] text-sky-400 block mb-0.5">
              Resumen
            </span>
            {preview}
          </div>
        )}

        {message && (
          <div
            className={[
              'rounded-lg px-3 py-2.5 text-xs border',
              message.kind === 'ok'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200',
            ].join(' ')}
          >
            {message.text}
          </div>
        )}

        <div className="flex justify-end gap-2 pb-8">
          <Button variant="secondary" onClick={() => navigate('/editor')}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave} className="flex items-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            Guardar habilidad
          </Button>
        </div>
      </main>
    </div>
  );
}
