import { useEffect, useState } from 'react';

function isPortraitMobile() {
  return window.innerHeight > window.innerWidth && window.innerWidth < 1024;
}

export function PortraitGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Intentar bloquear la orientación a landscape (funciona en PWA Android).
    // `lock` no está en los tipos de TS (API experimental): cast defensivo.
    const orientation = (typeof screen !== 'undefined' ? screen.orientation : undefined) as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;
    orientation?.lock?.('landscape').catch(() => {});

    const check = () => setShow(isPortraitMobile());
    check();

    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: '#080f18' }}
    >
      {/* Ícono de rotación animado */}
      <div
        className="text-yellow-400"
        style={{
          fontSize: 72,
          animation: 'rotateIcon 2s ease-in-out infinite',
        }}
      >
        ⟳
      </div>

      <div className="text-center px-8">
        <p className="text-white font-black text-2xl mb-2">Gira tu dispositivo</p>
        <p className="text-slate-400 text-sm leading-relaxed">
          Mitos y Leyendas se juega en modo horizontal (landscape)
        </p>
      </div>

      {/* Barra decorativa */}
      <div className="flex gap-2 mt-2">
        <div className="w-16 h-1 rounded-full bg-yellow-500/60" />
        <div className="w-4 h-1 rounded-full bg-yellow-500/30" />
        <div className="w-2 h-1 rounded-full bg-yellow-500/20" />
      </div>

      <style>{`
        @keyframes rotateIcon {
          0%   { transform: rotate(0deg) scale(1); }
          40%  { transform: rotate(-90deg) scale(1.15); }
          60%  { transform: rotate(-90deg) scale(1.15); }
          100% { transform: rotate(0deg) scale(1); }
        }
      `}</style>
    </div>
  );
}
