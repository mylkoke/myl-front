import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Crop, Loader2, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { detectCard, extractCard } from '@/utils/cardScanner';
import type { DetectedCard } from '@/utils/cardScanner';

const PREVIEW_MAX = 420; // px, lado mayor de la vista previa

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
 * Vista previa estilo CamScanner: muestra la foto con el marco verde del
 * recorte detectado y deja decidir por botón — recortar, usar la original
 * o (en lote) omitir la foto.
 */
export function CardScanModal({ files, onResult, onClose }: CardScanModalProps) {
  const [index, setIndex] = useState(0);
  const [detection, setDetection] = useState<DetectedCard | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const file = files[index] as File | undefined;
  const isBatch = files.length > 1;

  // Detecta el contorno y pinta foto + marco en el canvas.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;

    (async () => {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, PREVIEW_MAX / Math.max(bitmap.width, bitmap.height));
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      let det: DetectedCard | null = null;
      try {
        det = await detectCard(file);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el escáner');
        }
      }
      if (cancelled) return;
      setDetection(det);
      setDetecting(false);

      // Marco de referencia del recorte (verde, esquinas marcadas)
      if (det) {
        const pts = det.corners.map((p) => ({ x: p.x * scale, y: p.y * scale }));
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#4ade80';
        for (const p of pts) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
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

  const advance = useCallback(() => {
    if (index + 1 < files.length) {
      // Reset del estado de detección para la siguiente foto de la cola.
      setIndex(index + 1);
      setDetecting(true);
      setDetection(null);
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
        const blob =
          mode === 'crop' && detection ? await extractCard(file, detection.corners) : file;
        await onResult(blob, file);
        advance();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error procesando la imagen');
      } finally {
        setProcessing(false);
      }
    },
    [file, detection, onResult, advance],
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
          <canvas ref={canvasRef} className="max-w-full h-auto" />
        </div>

        {detecting && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Detectando el borde de la carta…
          </p>
        )}
        {!detecting && !detection && !error && (
          <p className="text-xs text-orange-300">
            No se detectó el borde de la carta; puedes subirla tal cual.
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <Button
            variant="primary"
            fullWidth
            disabled={detecting || processing || !detection}
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
