export function Separator() {
  return (
    <div className="flex items-center gap-3 px-4 py-1 select-none">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
      <div className="text-yellow-500/60 text-xs font-bold tracking-widest uppercase">
        Mitos & Leyendas
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
    </div>
  );
}
