import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
        <AlertCircle className="w-9 h-9 text-red-400" />
      </div>
      <h1 className="text-4xl font-bold text-surface-50 mb-2">404</h1>
      <p className="text-surface-400 mb-8">Cette page n'existe pas</p>
      <Link to="/" className="btn-primary flex items-center gap-2">
        <Home className="w-4 h-4" />
        Retour à l'accueil
      </Link>
    </div>
  );
}
