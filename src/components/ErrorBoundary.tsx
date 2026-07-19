import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Captura errores de render en el árbol de React y muestra una pantalla de
 * recuperación con el detalle del error, en vez de dejar la pantalla en negro
 * (antes, cualquier excepción de render desmontaba toda la app sin rastro).
 * También registra el error en la consola para diagnóstico.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Queda en la consola del navegador para diagnosticar el crash real.
    console.error('[ErrorBoundary] Crash de render:', error, info.componentStack);
    this.setState({ info: info.componentStack ?? null });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900 border border-red-500/40 rounded-2xl p-5 shadow-2xl">
          <h1 className="text-lg font-bold text-red-300 mb-1">Algo salió mal</h1>
          <p className="text-sm text-slate-300 mb-3">
            La partida encontró un error inesperado. Puedes recargar para continuar. Copia este
            detalle si quieres reportarlo:
          </p>
          <pre className="text-[11px] leading-snug text-red-200 bg-black/40 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
            {error.message}
            {info ? `\n${info}` : ''}
          </pre>
          <button
            onClick={this.handleReload}
            className="mt-4 w-full py-3 rounded-lg font-bold text-sm bg-yellow-500 hover:bg-yellow-400 text-black transition-colors"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
