import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="ui-panel px-8 py-7 text-center max-w-sm space-y-4">
        <div className="flex items-center justify-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <h1 className="text-2xl font-bold ui-t ui-num">404</h1>
        </div>
        <p className="text-xs ui-t-muted">Cette page n'existe pas.</p>
        <Link to="/" className="ui-btn ui-btn-primary inline-flex items-center gap-2 text-xs">
          <Home className="w-3.5 h-3.5" />
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
