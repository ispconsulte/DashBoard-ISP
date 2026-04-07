import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional fallback UI — defaults to the built-in error card */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary that catches render-time errors in its children
 * and shows a friendly message instead of breaking the whole page.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] CRASH:", error?.message ?? error);
    console.error("[ErrorBoundary] Stack:", error?.stack);
    console.error("[ErrorBoundary] Component:", info.componentStack);
  }

  private isChunkLoadError(error: Error | null) {
    if (!error) return false;
    const message = error.message ?? "";
    return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message);
  }

  handleRetry = () => {
    if (this.isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/[0.06] p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">
              Algo deu errado neste módulo
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              Um erro inesperado ocorreu. O restante da aplicação continua funcionando normalmente.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-foreground/70 transition hover:bg-white/[0.08] hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
