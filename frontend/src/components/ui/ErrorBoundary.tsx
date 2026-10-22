import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Custom fallback. Receives error & reset() */
  fallback?: (err: Error, reset: () => void) => ReactNode;
  /** Optional logger (Sentry, etc.) */
  onError?: (err: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Prevents white-screen on render errors.
 * Wrap routes/sections to scope the fallback.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="container-app py-12 flex flex-col items-center justify-center min-h-[60vh]"
      >
        <div
          className="card-raised max-w-lg w-full text-center animate-fade-in-up"
          style={{ borderColor: 'rgba(239,68,68,0.3)' }}
        >
          <div
            className="mx-auto mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full"
            style={{ background: 'rgba(239,68,68,0.12)' }}
          >
            <AlertTriangle className="w-6 h-6" style={{ color: '#fca5a5' }} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold mb-2">Oups, quelque chose s'est mal passé</h2>
          <p className="text-sm text-muted mb-4 break-words">
            {error.message || 'Une erreur inattendue est survenue dans cette section.'}
          </p>
          {import.meta.env.DEV && error.stack && (
            <details className="text-left mb-4">
              <summary className="text-xs text-faint cursor-pointer hover:text-default">
                Détails techniques
              </summary>
              <pre className="text-[10px] text-faint whitespace-pre-wrap mt-2 max-h-48 overflow-auto p-2 rounded bg-black/30">
                {error.stack}
              </pre>
            </details>
          )}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button type="button" onClick={this.reset} className="btn-primary focus-ring">
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Réessayer
            </button>
            <a href="/" className="btn-secondary focus-ring">
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
              Accueil
            </a>
          </div>
        </div>
      </div>
    );
  }
}
