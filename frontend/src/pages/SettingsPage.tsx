import { Activity, Bell, Lock, Palette, User } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <PageHeader 
        title="Paramètres" 
        description="Gérez vos préférences, votre profil et les configurations de l'application."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          <nav className="flex flex-col gap-1">
            <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 text-primary font-medium transition-colors text-left">
              <User className="w-5 h-5" />
              Profil
            </button>
            <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors text-left">
              <Palette className="w-5 h-5" />
              Apparence
            </button>
            <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors text-left">
              <Bell className="w-5 h-5" />
              Notifications
            </button>
            <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors text-left">
              <Lock className="w-5 h-5" />
              Sécurité
            </button>
            <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors text-left">
              <Activity className="w-5 h-5" />
              API & Intégrations
            </button>
          </nav>
        </div>

        <div className="md:col-span-3 space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <User className="w-6 h-6 text-primary" />
                Profil Utilisateur
              </h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Prénom</label>
                    <input 
                      type="text" 
                      defaultValue="OpenStats"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Nom</label>
                    <input 
                      type="text" 
                      defaultValue="User"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Email</label>
                  <input 
                    type="email" 
                    defaultValue="contact@openstats.io"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <button className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg font-medium transition-colors">
                    Enregistrer les modifications
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-red-400">
                <Lock className="w-6 h-6" />
                Zone Dangereuse
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Ces actions sont irréversibles. Soyez sûr de ce que vous faites.
              </p>
              <button className="border border-red-500/50 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Supprimer le compte
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
