/**
 * Card scanner: detects the physical card edges in a photo (CamScanner-style),
 * crops it and fixes the perspective so only the card is uploaded.
 *
 * Uses OpenCV.js loaded lazily from CDN (~8 MB, only the first time a photo
 * is uploaded in the editor — the game bundle is not affected).
 */

// 4.x redirige a la última 4.13+ publicada; las URLs de versión exacta dan 404.
const OPENCV_URL = 'https://docs.opencv.org/4.x/opencv.js';

/** MYL cards are portrait; the scan output gets rotated if it comes out landscape. */
const MIN_CARD_AREA_RATIO = 0.2; // below this the contour is noise → fallback
const MAX_CARD_AREA_RATIO = 0.95; // above this the photo is already cropped → no-op
const MAX_DETECT_DIMENSION = 1200; // downscaled copy used only for edge detection

// OpenCV.js has no official types; the module is accessed through window.cv.
/* eslint-disable @typescript-eslint/no-explicit-any */
type CvModule = any;
type CvMat = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let opencvPromise: Promise<CvModule> | null = null;

const LOAD_TIMEOUT_MS = 60_000;

function loadOpenCv(): Promise<CvModule> {
  if (opencvPromise) return opencvPromise;
  opencvPromise = new Promise((resolve, reject) => {
    const win = window as unknown as { cv?: CvModule };

    // Nunca dejar la UI colgada: si OpenCV no inicializa en 60 s, fallar y
    // permitir reintentar en la siguiente subida.
    const timeout = setTimeout(() => {
      opencvPromise = null;
      console.error('[cardScanner] timeout inicializando OpenCV');
      reject(new Error('OpenCV tardó demasiado en inicializar'));
    }, LOAD_TIMEOUT_MS);

    const settle = (mod: CvModule) => {
      clearTimeout(timeout);
      // El módulo Emscripten expone un `then` que se resuelve consigo mismo;
      // si se deja, resolve(mod) entra en desenvolvimiento infinito de
      // thenables y la promesa nunca se cumple. Se elimina antes de resolver.
      if (mod && typeof mod.then === 'function') {
        try {
          delete mod.then;
        } catch {
          /* módulo sellado: seguir igualmente */
        }
      }
      win.cv = mod;
      console.info('[cardScanner] OpenCV listo');
      resolve(mod);
    };
    const waitForRuntime = (mod: CvModule) => {
      // Recent opencv.js builds expose `cv` as a thenable; older ones use
      // onRuntimeInitialized. Handle both.
      if (typeof mod?.then === 'function') {
        console.info('[cardScanner] OpenCV es thenable, esperando runtime…');
        mod.then(settle);
      } else if (mod?.Mat) {
        settle(mod);
      } else {
        console.info('[cardScanner] esperando onRuntimeInitialized…');
        mod.onRuntimeInitialized = () => settle(mod);
      }
    };
    if (win.cv) return waitForRuntime(win.cv);

    console.info('[cardScanner] descargando OpenCV…');
    const script = document.createElement('script');
    script.src = OPENCV_URL;
    script.async = true;
    script.onload = () => {
      console.info('[cardScanner] script cargado, inicializando…');
      if (win.cv) waitForRuntime(win.cv);
      else {
        clearTimeout(timeout);
        opencvPromise = null;
        reject(new Error('OpenCV no se inicializó'));
      }
    };
    script.onerror = () => {
      clearTimeout(timeout);
      opencvPromise = null; // allow retrying on the next upload
      console.error('[cardScanner] error descargando OpenCV');
      reject(new Error('No se pudo cargar OpenCV (¿sin conexión?)'));
    };
    document.head.appendChild(script);
  });
  return opencvPromise;
}

export interface Point {
  x: number;
  y: number;
}

/** Detection result: corners (tl, tr, br, bl) in source-image coordinates. */
export interface DetectedCard {
  corners: Point[];
  imageWidth: number;
  imageHeight: number;
}

/** Order 4 corners as top-left, top-right, bottom-right, bottom-left. */
function orderCorners(pts: Point[]): Point[] {
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const topLeft = bySum[0];
  const bottomRight = bySum[3];
  const byDiff = [...pts].sort((a, b) => a.y - a.x - (b.y - b.x));
  const topRight = byDiff[0];
  const bottomLeft = byDiff[3];
  return [topLeft, topRight, bottomRight, bottomLeft];
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Find the card's 4 corners in the image, or null if no plausible
 * quadrilateral is detected (photo already cropped, edge not visible…).
 * Coordinates are in the source image space.
 *
 * Strategy: several edge-detection passes (different Canny thresholds +
 * Otsu binarization). In each pass, prefer an exact convex quadrilateral;
 * if none appears, fall back to the min-area rotated rectangle of the
 * largest contour — robust for rounded corners, foil glare and low contrast.
 */
function findCardCorners(cv: CvModule, src: CvMat): Point[] | null {
  const scale = Math.min(1, MAX_DETECT_DIMENSION / Math.max(src.cols, src.rows));
  const small = new cv.Mat();
  cv.resize(src, small, new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale)));

  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  const imgArea = small.cols * small.rows;

  let bestQuad: Point[] | null = null;
  let bestQuadArea = 0;
  let bestRect: Point[] | null = null;
  let bestRectArea = 0;

  const scanPass = () => {
    // Close small gaps so the card outline forms a single contour.
    cv.dilate(edges, edges, kernel);
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area < imgArea * MIN_CARD_AREA_RATIO || area > imgArea * MAX_CARD_AREA_RATIO) {
        contour.delete();
        continue;
      }
      // Cuadrilátero exacto (borde recto bien definido)
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * cv.arcLength(contour, true), true);
      if (approx.rows === 4 && cv.isContourConvex(approx) && area > bestQuadArea) {
        const pts: Point[] = [];
        for (let j = 0; j < 4; j++) {
          pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
        }
        bestQuad = pts;
        bestQuadArea = area;
      }
      // Fallback: rectángulo rotado de área mínima del contorno mayor
      if (area > bestRectArea) {
        const rect = cv.minAreaRect(contour);
        const rectArea = rect.size.width * rect.size.height;
        // El rect debe ajustarse razonablemente al contorno (no ruido disperso)
        if (rectArea > 0 && area / rectArea > 0.75 && rectArea < imgArea * MAX_CARD_AREA_RATIO) {
          const vertices = cv.RotatedRect.points(rect) as Point[];
          bestRect = vertices.map((p) => ({ x: p.x, y: p.y }));
          bestRectArea = area;
        }
      }
      approx.delete();
      contour.delete();
    }
    contours.delete();
    hierarchy.delete();
  };

  try {
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);

    // Pasadas con distinta sensibilidad; nos quedamos con el mejor resultado.
    cv.Canny(gray, edges, 50, 150);
    scanPass();
    cv.Canny(gray, edges, 20, 80);
    scanPass();
    cv.threshold(gray, edges, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    scanPass();

    const best = bestQuad ?? bestRect;
    if (!best) return null;
    // Map back to full-resolution coordinates.
    return orderCorners(best).map((p) => ({ x: p.x / scale, y: p.y / scale }));
  } finally {
    small.delete();
    gray.delete();
    edges.delete();
    kernel.delete();
  }
}

async function blobToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no soportado');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/**
 * Detect the card in a photo. Returns the 4 corners (tl, tr, br, bl) in
 * source-image coordinates — the "frame" to preview before cropping — or
 * null when no plausible card border is found.
 */
export async function detectCard(file: Blob): Promise<DetectedCard | null> {
  const cv = await loadOpenCv();
  const srcCanvas = await blobToCanvas(file);
  const src = cv.imread(srcCanvas);
  try {
    const corners = findCardCorners(cv, src);
    console.info('[cardScanner] detección:', corners ? 'carta encontrada' : 'sin contorno');
    if (!corners) return null;
    return { corners, imageWidth: srcCanvas.width, imageHeight: srcCanvas.height };
  } finally {
    src.delete();
  }
}

/**
 * Remove the background: everything outside the detected card contour is
 * painted white, without warping the photo. Returns null when no card
 * border is found.
 */
export async function removeCardBackground(file: Blob): Promise<Blob | null> {
  const detected = await detectCard(file);
  if (!detected) return null;

  const srcCanvas = await blobToCanvas(file);
  const out = document.createElement('canvas');
  out.width = srcCanvas.width;
  out.height = srcCanvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas no soportado');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.beginPath();
  const [first, ...rest] = detected.corners;
  ctx.moveTo(first.x, first.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(srcCanvas, 0, 0);

  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))),
      'image/jpeg',
      0.92,
    );
  });
}

/**
 * Crop + fix perspective using the given corners (from detectCard).
 * Returns the processed JPEG blob (portrait-oriented).
 */
export async function extractCard(file: Blob, corners: Point[]): Promise<Blob> {
  const cv = await loadOpenCv();
  const srcCanvas = await blobToCanvas(file);
  const src = cv.imread(srcCanvas);
  let warped: CvMat | null = null;
  try {
    // Las esquinas pueden venir ajustadas a mano: se reordenan por seguridad.
    const [tl, tr, br, bl] = orderCorners(corners);
    // Output size from the real edge lengths so the card ratio is preserved.
    const outWidth = Math.round((dist(tl, tr) + dist(bl, br)) / 2);
    const outHeight = Math.round((dist(tl, bl) + dist(tr, br)) / 2);
    if (outWidth < 50 || outHeight < 50) throw new Error('El recorte es demasiado pequeño');

    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [tl, tr, br, bl].flatMap((p) => [p.x, p.y]));
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0, outWidth, 0, outWidth, outHeight, 0, outHeight,
    ]);
    const transform = cv.getPerspectiveTransform(srcPts, dstPts);
    warped = new cv.Mat();
    cv.warpPerspective(src, warped, transform, new cv.Size(outWidth, outHeight));
    srcPts.delete();
    dstPts.delete();
    transform.delete();

    const outCanvas = document.createElement('canvas');
    cv.imshow(outCanvas, warped);

    // MYL cards are portrait: rotate 90° if the scan came out landscape.
    let finalCanvas = outCanvas;
    if (outCanvas.width > outCanvas.height) {
      const rotated = document.createElement('canvas');
      rotated.width = outCanvas.height;
      rotated.height = outCanvas.width;
      const ctx = rotated.getContext('2d');
      if (!ctx) throw new Error('Canvas no soportado');
      ctx.translate(rotated.width / 2, rotated.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(outCanvas, -outCanvas.width / 2, -outCanvas.height / 2);
      finalCanvas = rotated;
    }

    return await new Promise<Blob>((resolve, reject) => {
      finalCanvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))),
        'image/jpeg',
        0.92,
      );
    });
  } finally {
    src.delete();
    warped?.delete();
  }
}
