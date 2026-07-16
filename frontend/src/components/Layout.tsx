import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home,
  Database, Activity, FileText, Settings, 
  Menu, X, Maximize2, Minimize2, Network, Sparkles, Monitor, Store, Play,
  Sun, Moon,
} from 'lucide-react';
import logoOS from '../assets/logoOS.png';
import { useAppDispatch } from '../hooks';

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1366;
  });
  const [density, setDensity] = useState<'normal' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'normal';
    return localStorage.getItem('density') as 'normal' | 'compact' ?? (window.innerWidth < 1366 ? 'compact' : 'normal');
  });

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem('density', density);
  }, [density]);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isHome = pathname === '/';
  const isWorkflow = pathname.startsWith('/workflow');
  const isCanvas = pathname.startsWith('/canvas');
  const isAnalyzer = pathname.startsWith('/analyzer');
  const isMarketplace = pathname.startsWith('/marketplace');

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/', active: isHome },
    { label: 'Analyse Guidée', icon: Play, path: '/workflow', active: isWorkflow },
    { label: 'Canvas', icon: Network, path: '/canvas', active: isCanvas },
    { label: 'Analyse Auto', icon: Sparkles, path: '/analyzer', active: isAnalyzer },
    { label: 'Marketplace', icon: Store, path: '/marketplace', active: isMarketplace },
  ];

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 flex overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-surface-950" />
      </div>

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out border-r border-white/5 bg-surface-950/80 backdrop-blur-xl ${
          isSidebarOpen ? 'translate-x-0 w-56 xl:w-60' : '-translate-x-full lg:translate-x-0 lg:w-16'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="h-14 flex items-center px-4 gap-3 border-b border-white/5">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src={logoOS} alt="OpenStats" className="w-7 h-7 object-contain group-hover:scale-110 transition-transform duration-500" />
              {isSidebarOpen && (
                <div className="animate-fade-in whitespace-nowrap">
                  <h1 className="text-sm font-black text-surface-50 tracking-tighter leading-none">
                    OpenStats
                  </h1>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto no-scrollbar">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                title={!isSidebarOpen ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group ${
                  item.active 
                    ? 'bg-accent-500/15 text-accent-300 border border-accent-500/25' 
                    : 'text-default hover:text-strong hover:bg-white/5 border border-transparent'
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${item.active ? 'text-accent-400' : 'group-hover:scale-110 transition-transform'}`} />
                {isSidebarOpen && <span className="text-[13px] font-semibold tracking-wide">{item.label}</span>}
              </Link>
            ))}

            <div className="pt-5 pb-2">
              <div className={`px-3 mb-2 text-[9px] font-black text-surface-600 uppercase tracking-[0.3em] ${!isSidebarOpen && 'hidden'}`}>
                Local
              </div>
              <Link to="/settings" title={!isSidebarOpen ? 'Paramètres' : undefined} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-white/5 transition-all group">
                <Settings className="w-4 h-4 shrink-0 group-hover:rotate-45 transition-transform" />
                {isSidebarOpen && <span className="text-[13px] font-semibold">Paramètres</span>}
              </Link>
            </div>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-white/5">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full p-2 rounded-lg bg-white/5 hover:bg-white/10 text-surface-400 transition-all flex items-center justify-center"
            >
              {isSidebarOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="h-14 border-b border-white/5 bg-surface-950/40 backdrop-blur-md px-4 md:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-surface-300"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDensity(d => d === 'normal' ? 'compact' : 'normal')}
              className="p-1.5 text-muted hover:text-accent-400 transition-colors rounded-lg hover:bg-white/5"
              title={`Densité: ${density === 'normal' ? 'normale' : 'compacte'}`}
            >
              {density === 'compact' ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="p-1.5 text-muted hover:text-accent-400 transition-colors rounded-lg hover:bg-white/5"
              title={theme === 'dark' ? 'Passer au theme clair' : 'Passer au theme sombre'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              to="/docs"
              className="p-1.5 text-muted hover:text-accent-400 transition-colors rounded-lg hover:bg-white/5"
              title="Documentation"
            >
              <FileText className="w-4 h-4" />
            </Link>
            <Link 
              to="/settings" 
              className="p-1.5 text-muted hover:text-accent-400 transition-colors rounded-lg hover:bg-white/5" 
              title="Paramètres du logiciel"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Mode local</span>
            </div>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto no-scrollbar py-3 md:py-5">
          <div className="container-app">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
