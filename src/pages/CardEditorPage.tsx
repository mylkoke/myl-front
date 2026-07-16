import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Crop,
  Eraser,
  Images,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import type { AbilityCategory, Card, CardInPlay, CardType, SpecialAbilityInfo } from '@/types/card.types';
import { CardView } from '@/components/cards/CardView';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getServices } from '@/services';
import { ApiError } from '@/services/api/http';
import type { CardFormData } from '@/services/api/catalogService';
import { blobToDataUrl, compressImage, rotateImage } from '@/utils/imageUtils';
import { removeCardBackground } from '@/utils/cardScanner';
import { CardScanModal } from '@/components/editor/CardScanModal';

const CARD_TYPES: CardType[] = ['aliado', 'totem', 'arma', 'talisman', 'oro'];

type UploadTarget = 'drive' | 'cloudinary';
const UPLOAD_TARGET_KEY = 'myl-upload-target';

/** Total de cartas por serie/edición (fijo por edición): HC son 160. */
const SERIES_TOTALS: Record<string, number> = {
  HC: 160,
};

/**
 * Props para campos numéricos que permiten ESCRIBIR con normalidad:
 * input de texto con teclado numérico, vacío cuando el valor es 0
 * (los type="number" controlados con 0 inicial solo dejaban usar las flechas).
 */
const numericProps = (value: number, onValue: (n: number) => void) => ({
  type: 'text' as const,
  inputMode: 'numeric' as const,
  pattern: '[0-9]*',
  value: value === 0 ? '' : String(value),
  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
    onValue(Number(e.target.value.replace(/\D/g, '')) || 0),
});

const EMPTY_FORM: CardFormData = {
  nombre: '',
  tipo: 'aliado',
  fuerza: 0,
  coste: 0,
  historia: '',
  habilidad: '',
  habilidadesEspeciales: [],
  imageUrl: '',
  numeroCarta: 0,
  cantidadEdicion: 0,
  expansion: '',
  raza: '',
  // Las cartas nuevas nacen con la lógica pendiente hasta que se implementa.
  logicaPendiente: true,
};

function asCardInPlay(card: Card): CardInPlay {
  return { ...card, instanceId: card.id, tapped: false, attackedThisTurn: false, summonedThisTurn: false };
}

export function CardEditorPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [abilities, setAbilities] = useState<SpecialAbilityInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Card form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CardFormData>(EMPTY_FORM);
  // Destino de subida: Drive (15 GB) por defecto, Cloudinary (1 GB) como alternativa.
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>(
    () => (localStorage.getItem(UPLOAD_TARGET_KEY) as UploadTarget) ?? 'drive',
  );
  // Escáner (recorte con marco): cola de fotos y modo de destino del resultado.
  // 'edit' → el recorte vuelve a la imagen local del formulario (sin subir);
  // 'batch' → se sube y se crea una carta por foto.
  const [scanQueue, setScanQueue] = useState<File[] | null>(null);
  const scanModeRef = useRef<'edit' | 'batch'>('edit');
  const batchCreatedRef = useRef(0);
  const batchRef = useRef<HTMLInputElement>(null);

  // Imagen local del formulario: se edita en la app (recortar / quitar fondo /
  // rotar) y solo se sube a Drive/Cloudinary al crear o guardar la carta.
  const [localImage, setLocalImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [toolBusy, setToolBusy] = useState<'bg' | 'rotate' | null>(null);
  // Visor a pantalla completa de la imagen del formulario (clic en la miniatura).
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const updateLocalImage = async (blob: Blob | null) => {
    setLocalImage(blob);
    // Data URL en vez de object URL: la vista previa siempre refleja el último
    // estado de la imagen (sin problemas de revocación en re-renders).
    setPreviewUrl(blob ? await blobToDataUrl(blob) : null);
  };
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // New ability modal
  const [abilityOpen, setAbilityOpen] = useState(false);
  const [abilityForm, setAbilityForm] = useState({
    code: '',
    nombre: '',
    descripcion: '',
    categoria: 'especial' as AbilityCategory,
    tipos: [] as CardType[],
  });

  const reload = async () => {
    const { catalog: svc } = getServices();
    const [cards, abs] = await Promise.all([svc.listAvailable(), svc.listAbilities()]);
    setCatalog(cards);
    setAbilities(abs);
  };

  useEffect(() => {
    reload()
      .catch((e) => setMessage(e instanceof Error ? e.message : 'Error cargando'))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    updateLocalImage(null);
    setFormOpen(true);
  };

  const openEdit = (card: Card) => {
    setEditingId(card.id);
    setForm({
      nombre: card.nombre,
      tipo: card.tipo,
      fuerza: card.fuerza,
      coste: card.coste,
      historia: card.historia,
      habilidad: card.habilidad,
      bonusFuerza: card.bonusFuerza,
      habilidadesEspeciales: card.habilidadesEspeciales ?? [],
      imageUrl: card.imagen,
      numeroCarta: card.numeroCarta ?? 0,
      cantidadEdicion: card.cantidadEdicion ?? 0,
      expansion: card.expansion ?? '',
      raza: card.raza ?? '',
      logicaPendiente: card.logicaPendiente ?? false,
    });
    updateLocalImage(null);
    setFormOpen(true);
  };

  /** Comprime y sube al destino elegido (con fallback Drive → Cloudinary). */
  const uploadImage = async (image: Blob): Promise<string> => {
    const blob = await compressImage(image, 1200, 0.8);
    const { catalog: svc } = getServices();
    if (uploadTarget === 'drive') {
      try {
        return await svc.uploadCardImageToDrive(blob);
      } catch (err) {
        // Drive sin configurar en el backend → fallback a Cloudinary
        if (err instanceof ApiError && err.status === 503) {
          setMessage('Google Drive no está configurado en el servidor; se subió a Cloudinary');
          return svc.uploadCardImage(blob);
        }
        throw err;
      }
    }
    return svc.uploadCardImage(blob);
  };

  // Foto individual → queda local en el formulario; se edita con los botones
  // (recortar / quitar fondo / rotar) y se sube recién al guardar la carta.
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null);
    updateLocalImage(file);
  };

  // Botón "Recortar": abre el escáner con marco sobre la imagen local.
  const openCrop = () => {
    if (!localImage) return;
    scanModeRef.current = 'edit';
    setScanQueue([
      new File([localImage], 'carta.jpg', { type: localImage.type || 'image/jpeg' }),
    ]);
  };

  // Botón "Quitar fondo": blanquea todo lo que queda fuera del borde detectado.
  const handleRemoveBackground = async () => {
    if (!localImage) return;
    setToolBusy('bg');
    setMessage(null);
    try {
      const result = await removeCardBackground(localImage);
      if (result) updateLocalImage(result);
      else setMessage('No se detectó el borde de la carta para quitar el fondo');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error quitando el fondo');
    } finally {
      setToolBusy(null);
    }
  };

  // Botón "Rotar": gira la imagen 90° en sentido horario.
  const handleRotate = async () => {
    if (!localImage) return;
    setToolBusy('rotate');
    try {
      updateLocalImage(await rotateImage(localImage));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error rotando la imagen');
    } finally {
      setToolBusy(null);
    }
  };

  // Lote de fotos → escáner con marco foto a foto; se crea una carta por foto.
  const handleBatch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    files.sort((a, b) => a.name.localeCompare(b.name));
    scanModeRef.current = 'batch';
    batchCreatedRef.current = 0;
    setMessage(null);
    setScanQueue(files);
  };

  /** Nombre provisional de la carta a partir del nombre del archivo. */
  const nameFromFile = (fileName: string) =>
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim()
      .slice(0, 60) || 'Carta sin nombre';

  const handleScanResult = async (blob: Blob, file: File) => {
    if (scanModeRef.current === 'edit') {
      // El recorte vuelve al formulario como imagen local; NO se sube aún.
      await updateLocalImage(blob);
      return;
    }
    const url = await uploadImage(blob);
    await getServices().catalog.createCard({
      ...EMPTY_FORM,
      nombre: nameFromFile(file.name),
      imageUrl: url,
    });
    batchCreatedRef.current += 1;
  };

  const handleScanClose = async () => {
    setScanQueue(null);
    if (scanModeRef.current === 'batch' && batchCreatedRef.current > 0) {
      setMessage(
        `${batchCreatedRef.current} carta(s) creada(s) — edítalas para completar tipo, coste y habilidades`,
      );
      await reload().catch(() => undefined);
    }
  };

  const toggleAbility = (code: string) => {
    setForm((f) => ({
      ...f,
      habilidadesEspeciales: f.habilidadesEspeciales.includes(code)
        ? f.habilidadesEspeciales.filter((c) => c !== code)
        : [...f.habilidadesEspeciales, code],
    }));
  };

  const saveCard = async () => {
    if (!form.nombre.trim() || (!localImage && !form.imageUrl.trim())) {
      setMessage('La carta necesita nombre e imagen');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      // La imagen local editada se sube recién ahora, al guardar la carta.
      const imageUrl = localImage ? await uploadImage(localImage) : form.imageUrl;
      const payload = { ...form, imageUrl };
      const { catalog: svc } = getServices();
      if (editingId) await svc.updateCard(editingId, payload);
      else await svc.createCard(payload);
      updateLocalImage(null);
      await reload();
      setFormOpen(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al guardar la carta');
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async (card: Card) => {
    if (!window.confirm(`¿Eliminar "${card.nombre}" del catálogo?`)) return;
    try {
      await getServices().catalog.deleteCard(card.id);
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  const saveAbility = async () => {
    try {
      await getServices().catalog.createAbility(abilityForm);
      await reload();
      setAbilityOpen(false);
      setAbilityForm({ code: '', nombre: '', descripcion: '', categoria: 'especial', tipos: [] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error creando la habilidad');
    }
  };

  // ── Orden y búsqueda del catálogo ─────────────────────────────────────
  const [sortBy, setSortBy] = useState<'numero' | 'coste' | 'fuerza' | 'tipo'>('numero');
  const [search, setSearch] = useState('');

  const visibleCatalog = useMemo(() => {
    // Búsqueda insensible a mayúsculas y tildes ("rodriguez" encuentra "Rodríguez")
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = normalize(search.trim());
    const filtered = q
      ? catalog.filter(
          (c) =>
            normalize(c.nombre).includes(q) ||
            (/^\d+$/.test(q) && c.numeroCarta === Number(q)),
        )
      : catalog;
    const byName = (a: Card, b: Card) => a.nombre.localeCompare(b.nombre);
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'numero':
          return (a.numeroCarta || Infinity) - (b.numeroCarta || Infinity) || byName(a, b);
        case 'coste':
          return a.coste - b.coste || byName(a, b);
        case 'fuerza':
          return b.fuerza - a.fuerza || byName(a, b);
        case 'tipo':
          return a.tipo.localeCompare(b.tipo) || byName(a, b);
      }
    });
  }, [catalog, search, sortBy]);

  // Razas: las existentes en el catálogo + las agregadas con el botón "+"
  // en esta sesión → chips seleccionables en el formulario.
  const [customRazas, setCustomRazas] = useState<string[]>([]);
  const [razaInput, setRazaInput] = useState('');
  const razas = useMemo(
    () =>
      [
        ...new Set([
          ...catalog.map((c) => c.raza).filter((r): r is string => !!r),
          ...customRazas,
        ]),
      ].sort((a, b) => a.localeCompare(b)),
    [catalog, customRazas],
  );

  const addRaza = () => {
    const r = razaInput.trim();
    if (!r) return;
    setCustomRazas((prev) => (prev.includes(r) ? prev : [...prev, r]));
    setForm((f) => ({ ...f, raza: r }));
    setRazaInput('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1520] flex items-center justify-center">
        <Loader2 size={32} className="text-yellow-500 animate-spin" />
      </div>
    );
  }

  const inputCls =
    'bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-yellow-500/50 w-full';

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
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white">Modo editor</h1>
          <p className="text-xs text-slate-400">{catalog.length} cartas en el catálogo</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setAbilityOpen(true)}
          className="flex items-center gap-1.5">
          <Sparkles size={13} />
          <span className="hidden sm:inline">Habilidades</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/crear-habilidad')}
          className="flex items-center gap-1.5">
          <Wand2 size={13} />
          <span className="hidden sm:inline">Crear Habilidad</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => batchRef.current?.click()}
          className="flex items-center gap-1.5"
        >
          <Images size={13} />
          <span className="hidden sm:inline">Lote</span>
        </Button>
        <Button variant="primary" size="sm" onClick={openCreate} className="flex items-center gap-1.5">
          <Plus size={13} /> Nueva carta
        </Button>
        <input
          ref={batchRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleBatch}
          className="hidden"
        />
      </header>

      {message && (
        <div className="px-4 py-2 text-xs text-center text-yellow-300 bg-yellow-500/10 border-b border-yellow-500/20">
          {message}
        </div>
      )}

      {/* Toolbar: búsqueda por nombre/número + orden */}
      <div className="flex items-center gap-2 px-3 sm:px-4 pt-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o número…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} !pl-8`}
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className={`${inputCls} !w-auto`}
          title="Ordenar cartas"
        >
          <option value="numero">Por número</option>
          <option value="coste">Por coste</option>
          <option value="fuerza">Por fuerza</option>
          <option value="tipo">Por tipo</option>
        </select>
      </div>

      {/* Catalog grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {visibleCatalog.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-8">
            Ninguna carta coincide con "{search}".
          </p>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
          {visibleCatalog.map((card) => (
            <div key={card.id} className="flex flex-col items-center gap-1.5">
              {/* Nº de la carta en la edición (solo el número), para ver la colección */}
              <div className="text-[10px] font-bold text-slate-400 tracking-wide">
                {card.numeroCarta ? `Nº ${card.numeroCarta}` : '—'}
              </div>
              <div className="relative">
                {/* ⚠️ habilidad sin lógica de juego implementada */}
                {card.logicaPendiente && (
                  <div
                    className="absolute -top-1.5 -left-1.5 z-20 bg-amber-500 text-black text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow border border-amber-300"
                    title="Lógica pendiente: la habilidad de esta carta aún no está programada"
                  >
                    ⚠
                  </div>
                )}
                <CardView card={asCardInPlay(card)} size="sm" onClick={() => openEdit(card)} />
              </div>
              <div className="flex gap-1 w-full">
                <button
                  onClick={() => openEdit(card)}
                  className="flex-1 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-colors"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => deleteCard(card)}
                  className="flex-1 py-1.5 rounded-md bg-slate-800 text-red-400 hover:bg-slate-700 flex items-center justify-center transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card form modal ── */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Editar carta' : 'Nueva carta'}
      >
        <div className="flex flex-col gap-3">
          {/* Image: camera / file + URL */}
          <div className="flex gap-3 items-start">
            <div
              onClick={() => {
                const url = previewUrl ?? (form.imageUrl || null);
                if (url) setViewerUrl(url);
              }}
              className={[
                'w-20 h-28 flex-shrink-0 rounded-lg border border-slate-700 bg-slate-800 bg-cover bg-center flex items-center justify-center',
                previewUrl || form.imageUrl ? 'cursor-pointer hover:brightness-110 transition-all' : '',
              ].join(' ')}
              title={previewUrl || form.imageUrl ? 'Ver imagen en grande' : undefined}
              style={
                previewUrl || form.imageUrl
                  ? { backgroundImage: `url(${previewUrl ?? form.imageUrl})` }
                  : undefined
              }
            >
              {!previewUrl && !form.imageUrl && <Camera size={20} className="text-slate-600" />}
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-1.5"
              >
                <Camera size={13} />
                Tomar / subir foto
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhoto}
                className="hidden"
              />
              {/* Herramientas de edición de la imagen local (antes de subir) */}
              {localImage && (
                <>
                  <div className="flex gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={openCrop}
                      disabled={toolBusy !== null}
                      className="flex-1 flex items-center justify-center gap-1"
                    >
                      <Crop size={12} /> Recortar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRemoveBackground}
                      disabled={toolBusy !== null}
                      className="flex-1 flex items-center justify-center gap-1"
                    >
                      {toolBusy === 'bg' ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Eraser size={12} />
                      )}
                      Quitar fondo
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRotate}
                      disabled={toolBusy !== null}
                      className="flex-1 flex items-center justify-center gap-1"
                    >
                      {toolBusy === 'rotate' ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCw size={12} />
                      )}
                      Rotar
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    La imagen se subirá a {uploadTarget === 'drive' ? 'Google Drive' : 'Cloudinary'} al
                    guardar la carta.
                  </p>
                </>
              )}
              <input
                type="url"
                placeholder="…o URL de imagen"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                className={inputCls}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Destino:</span>
                {(
                  [
                    ['drive', 'Google Drive (15 GB)'],
                    ['cloudinary', 'Cloudinary (1 GB)'],
                  ] as const
                ).map(([target, label]) => (
                  <button
                    key={target}
                    onClick={() => {
                      setUploadTarget(target);
                      localStorage.setItem(UPLOAD_TARGET_KEY, target);
                    }}
                    className={[
                      'px-2 py-1 rounded-full text-[10px] font-medium border transition-all',
                      uploadTarget === target
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <input
            type="text"
            placeholder="Nombre de la carta"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            className={inputCls}
          />

          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
              Tipo
              <select
                value={form.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as CardType;
                  // Al cambiar el tipo, se descartan las habilidades ya
                  // seleccionadas que no aplican al tipo nuevo.
                  setForm((f) => ({
                    ...f,
                    tipo,
                    habilidadesEspeciales: f.habilidadesEspeciales.filter((code) => {
                      const a = abilities.find((x) => x.code === code);
                      return !a || a.tipos.length === 0 || a.tipos.includes(tipo);
                    }),
                  }));
                }}
                className={inputCls}
              >
                {CARD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
              Coste
              <input
                {...numericProps(form.coste, (n) => setForm((f) => ({ ...f, coste: n })))}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
              Fuerza
              <input
                {...numericProps(form.fuerza, (n) => setForm((f) => ({ ...f, fuerza: n })))}
                className={inputCls}
              />
            </label>
          </div>

          {/* Raza (aliados): chips de razas existentes + input para una nueva */}
          {form.tipo === 'aliado' && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Raza</p>
              <div className="flex flex-wrap gap-2 items-center">
                {razas.map((r) => {
                  const active = form.raza === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setForm((f) => ({ ...f, raza: active ? '' : r }))}
                      className={[
                        'px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all',
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500',
                      ].join(' ')}
                    >
                      {r}
                    </button>
                  );
                })}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Nueva raza…"
                    value={razaInput}
                    onChange={(e) => setRazaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addRaza();
                    }}
                    className={`${inputCls} !w-32`}
                  />
                  <button
                    onClick={addRaza}
                    disabled={!razaInput.trim()}
                    title="Agregar raza"
                    className="p-2 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Numeración de la edición: "HC-35/160" → serie HC, nº 35, total 160 */}
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
              Serie
              <input
                type="text"
                placeholder="HC"
                value={form.expansion}
                onChange={(e) => {
                  const serie = e.target.value.toUpperCase();
                  // El total es fijo por edición: se autocompleta si la serie es conocida
                  setForm((f) => ({
                    ...f,
                    expansion: serie,
                    cantidadEdicion: SERIES_TOTALS[serie] ?? f.cantidadEdicion,
                  }));
                }}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
              Nº de carta
              <input
                placeholder="35"
                {...numericProps(form.numeroCarta, (n) => setForm((f) => ({ ...f, numeroCarta: n })))}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
              Total edición
              <input
                placeholder="160"
                {...numericProps(form.cantidadEdicion, (n) => setForm((f) => ({ ...f, cantidadEdicion: n })))}
                className={inputCls}
              />
            </label>
          </div>

          {form.tipo === 'arma' && (
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
              Bonus de fuerza (arma)
              <input
                {...numericProps(form.bonusFuerza ?? 0, (n) => setForm((f) => ({ ...f, bonusFuerza: n })))}
                className={inputCls}
              />
            </label>
          )}

          <textarea
            placeholder="Habilidad de carta (texto personalizado)"
            value={form.habilidad}
            onChange={(e) => setForm((f) => ({ ...f, habilidad: e.target.value }))}
            rows={2}
            className={inputCls}
          />
          <textarea
            placeholder="Historia (flavor)"
            value={form.historia}
            onChange={(e) => setForm((f) => ({ ...f, historia: e.target.value }))}
            rows={2}
            className={inputCls}
          />

          {/* Habilidades especiales (keywords, en la carta van en negrita) y
              habilidades de carta (mecánica propia): segmentos separados,
              ambas se guardan en form.habilidadesEspeciales */}
          {(['especial', 'carta'] as const).map((categoria) => {
            // Solo las habilidades que aplican al tipo de carta seleccionado
            // (tipos vacío = aplica a todos los tipos)
            const items = abilities.filter(
              (a) =>
                a.categoria === categoria &&
                (a.tipos.length === 0 || a.tipos.includes(form.tipo)),
            );
            if (items.length === 0) return null;
            return (
              <div key={categoria}>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                  {categoria === 'especial'
                    ? 'Habilidades especiales (acumulables)'
                    : 'Habilidades con mecánica'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((ability) => {
                    const active = form.habilidadesEspeciales.includes(ability.code);
                    return (
                      <button
                        key={ability.code}
                        onClick={() => toggleAbility(ability.code)}
                        title={ability.descripcion}
                        className={[
                          'px-2.5 py-1.5 rounded-full text-xs border transition-all',
                          categoria === 'especial' ? 'font-bold' : 'font-medium',
                          active
                            ? categoria === 'especial'
                              ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                              : 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500',
                        ].join(' ')}
                      >
                        {ability.nombre}
                        {!ability.implemented && (
                          <span className="ml-1 text-[9px] opacity-60">(sin interacción)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Marcador de estado: la lógica de la habilidad aún no existe */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none bg-slate-800/60 border border-slate-700 rounded-md px-3 py-2">
            <input
              type="checkbox"
              checked={form.logicaPendiente}
              onChange={(e) => setForm((f) => ({ ...f, logicaPendiente: e.target.checked }))}
              className="accent-amber-500"
            />
            <span>
              ⚠️ Lógica pendiente — la habilidad de esta carta aún no está programada
            </span>
          </label>

          <Button
            variant="primary"
            fullWidth
            onClick={saveCard}
            disabled={saving}
            className="flex items-center justify-center gap-2 mt-1"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editingId ? 'Guardar cambios' : 'Crear carta'}
          </Button>
        </div>
      </Modal>

      {/* ── Escáner con marco de recorte (foto individual o lote) ── */}
      {scanQueue && (
        <CardScanModal files={scanQueue} onResult={handleScanResult} onClose={handleScanClose} />
      )}

      {/* ── Visor de imagen a pantalla completa ── */}
      {viewerUrl && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 cursor-zoom-out"
          onClick={() => setViewerUrl(null)}
        >
          <button
            onClick={() => setViewerUrl(null)}
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
          <img
            src={viewerUrl}
            alt="Vista de la carta"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      {/* ── New ability modal ── */}
      <Modal isOpen={abilityOpen} onClose={() => setAbilityOpen(false)} title="Habilidades especiales">
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {abilities.map((a) => (
              <li key={a.code} className="text-sm text-slate-300 flex items-baseline gap-2">
                {/* Convención MYL: las habilidades especiales van en negrita en la carta */}
                <span className={a.categoria === 'especial' ? 'font-bold text-purple-300' : 'text-sky-300'}>
                  {a.nombre}
                </span>
                <span className="text-xs text-slate-500 flex-1">{a.descripcion}</span>
                {!a.implemented && (
                  <span className="text-[9px] text-orange-400/80 border border-orange-500/30 rounded-full px-1.5 whitespace-nowrap">
                    sin interacción
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Nueva habilidad</p>
            <input
              type="text" placeholder="code (ej: vuelo)"
              value={abilityForm.code}
              onChange={(e) => setAbilityForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))}
              className={inputCls}
            />
            <input
              type="text" placeholder="Nombre (ej: Vuelo)"
              value={abilityForm.nombre}
              onChange={(e) => setAbilityForm((f) => ({ ...f, nombre: e.target.value }))}
              className={inputCls}
            />
            <textarea
              placeholder="Descripción de la regla"
              value={abilityForm.descripcion}
              onChange={(e) => setAbilityForm((f) => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              className={inputCls}
            />
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-500">
              Categoría
              <select
                value={abilityForm.categoria}
                onChange={(e) => setAbilityForm((f) => ({ ...f, categoria: e.target.value as AbilityCategory }))}
                className={inputCls}
              >
                <option value="especial">Habilidad especial (en negrita en la carta)</option>
                <option value="carta">Habilidad con mecánica (texto normal)</option>
              </select>
            </label>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                Aplica a (vacío = todos los tipos)
              </p>
              <div className="flex flex-wrap gap-2">
                {CARD_TYPES.map((t) => {
                  const active = abilityForm.tipos.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() =>
                        setAbilityForm((f) => ({
                          ...f,
                          tipos: active ? f.tipos.filter((x) => x !== t) : [...f.tipos, t],
                        }))
                      }
                      className={[
                        'px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all',
                        active
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500',
                      ].join(' ')}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              variant="primary" fullWidth onClick={saveAbility}
              disabled={!abilityForm.code || !abilityForm.nombre}
            >
              Crear habilidad
            </Button>
            <p className="text-[10px] text-slate-600">
              Las habilidades nuevas nacen "sin interacción": su efecto en el juego se programa después.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
