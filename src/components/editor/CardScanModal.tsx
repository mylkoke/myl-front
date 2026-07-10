import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Crop, Loader2, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { detectCard, extractCard } from '@/utils/cardScanner';
import type { Point } from '@/utils/cardScanner';

const PREVIEW_MAX = 420; // px, lado mayor de la vista previa
const HANDLE_RADIUS = 9; // px en canvas: tamaño del nodo de esquina
const HIT_RADIUS = 22; // px: distancia máxima para "agarrar" un nodo

interface CardScanModalProps {
  /** Cola de fotos a procesar (1 en modo formulario, N en modo lote). */
  files: File[];
  /**
   * Se llama con la imagen final (recortada u original) de cada foto.
   * El modal espera a que resuelva antes de pasar a la siguiente.
   */
  onResult: (blob: Blob, file: File) => Promise<void>;
  onClose: () => void;
}

/**
 * Vista previa estilo CamScanner: la foto se muestra con el marco del recorte
 * detectado y sus 4 esquinas son NODOS ARRASTRABLES (mouse y táctil) para
 * ajustar el recorte a mano cuando la detección no calza. Si no se detecta
 * la carta, se ofrece un marco inicial ajustable.
 */
export function CardScanModal({ files, onResult, onClose }: CardScanModalProps) {
  const [index, setIndex] = useState(0);
  const [corners, setCorners] = useState<Point[] | null>(null); // coords de imagen
  const [autoDetected, setAutoDetected] = useState(true);
  const [detecting, setDetecting] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const scaleRef = useRef(1); // canvas px / imagen px
  const dragIndexRef = useRef<number | null>(null);

  const file = files[index] as File | undefined;
  const isBatch = files.length > 1;

  // Carga la foto, la pinta y detecta el marco inicial.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;

    (async () => {
      const bitmap = await createImageBitmap(file);
      if (cancelled) {
        bitmap.close();
        return;
      }
      bitmapRef.current?.close();
      bitmapRef.current = bitmap;
      const scale = Math.min(1, PREVIEW_MAX / Math.max(bitmap.width, bitmap.height));
      scaleRef.current = scale;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      let detected: Point[] | null = null;
      try {
        detected = (await detectCard(file))?.corners ?? null;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el escáner');
        }
      }
      if (cancelled) return;
      // Sin detección → marco inicial con margen del 6 % para ajustar a mano.
      const w = bitmap.width;
      const h = bitmap.height;
      const inset = Math.round(Math.min(w, h) * 0.06);
      setCorners(
        detected ?? [
          { x: inset, y: inset },
          { x: w - inset, y: inset },
          { x: w - inset, y: h - inset },
          { x: inset, y: h - inset },
        ],
      );
      setAutoDetected(!!detected);
      setDetecting(false);
    })().catch(() => {
      if (!cancelled) {
        setError('No se pudo leer la imagen');
        setDetecting(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Repinta foto + marco + nodos cada vez que las esquinas cambian.
  useEffect(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap || !corners) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pts = corners.map((p) => ({ x: p.x * scaleRef.current, y: p.y * scaleRef.current }));

    // Sombra fuera del marco para ver claramente qué queda dentro
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of [...pts.slice(1)].reverse()) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill('evenodd');
    ctx.restore();

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();

    // Nodos arrastrables
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }, [corners]);

  // ── Arrastre de nodos (Pointer Events: mouse + táctil) ──────────────────
  const canvasPoint = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!corners) return;
    const p = canvasPoint(e);
    const scale = scaleRef.current;
    let closest = -1;
    let best = HIT_RADIUS;
    corners.forEach((c, i) => {
      const d = Math.hypot(c.x * scale - p.x, c.y * scale - p.y);
      if (d < best) {
        best = d;
        closest = i;
      }
    });
    if (closest >= 0) {
      dragIndexRef.current = closest;
      canvasRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const i = dragIndexRef.current;
    if (i === null || !corners) return;
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    const p = canvasPoint(e);
    const scale = scaleRef.current;
    const next = [...corners];
    next[i] = {
      x: Math.min(bitmap.width, Math.max(0, p.x / scale)),
      y: Math.min(bitmap.height, Math.max(0, p.y / scale)),
    };
    setCorners(next);
  };

  const onPointerUp = () => {
    dragIndexRef.current = null;
  };

  const advance = useCallback(() => {
    if (index + 1 < files.length) {
      setIndex(index + 1);
      setCorners(null);
      setAutoDetected(true);
      setDetecting(true);
      setError(null);
    } else {
      onClose();
    }
  }, [index, files.length, onClose]);

  const submit = useCallback(
    async (mode: 'crop' | 'original') => {
      if (!file) return;
      setProcessing(true);
      setError(null);
      try {
        const blob = mode === 'crop' && corners ? await extractCard(file, corners) : file;
        await onResult(blob, file);
        advance();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error procesando la imagen');
      } finally {
        setProcessing(false);
      }
    },
    [file, corners, onResult, advance],
  );

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            Escanear carta{isBatch && ` — ${index + 1} de ${files.length}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-slate-400 truncate">{file.name}</p>

        <div className="flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden min-h-[200px]">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="max-w-full h-auto cursor-crosshair"
            style={{ touchAction: 'none' }}
          />
        </div>

        {detecting ? (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Detectando el borde de la carta…
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            {autoDetected
              ? 'Arrastra los nodos verdes si el marco no calza con la carta.'
              : 'No se detectó el borde automáticamente: ajusta los nodos verdes a las esquinas de la carta.'}
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <Button
            variant="primary"
            fullWidth
            disabled={detecting || processing || !corners}
            onClick={() => submit('crop')}
            className="flex items-center justify-center gap-1.5"
          >
            {processing ? <Loader2 size={13} className="animate-spin" /> : <Crop size={13} />}
            Recortar
          </Button>
          <Button
            variant="secondary"
            fullWidth
            disabled={detecting || processing}
            onClick={() => submit('original')}
            className="flex items-center justify-center gap-1.5"
          >
            <Check size={13} /> Usar original
          </Button>
          {isBatch && (
            <Button
              variant="secondary"
              disabled={processing}
              onClick={advance}
              className="flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <SkipForward size={13} /> Omitir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
