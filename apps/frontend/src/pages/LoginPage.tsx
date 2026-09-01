import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Lock, Mail, Loader2, ShieldCheck, Sun, Moon } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (!err.response) {
        setError('Impossible de contacter le serveur.');
      } else if (err.response.status === 401) {
        setError(err.response?.data?.detail || 'Adresse e-mail ou mot de passe incorrect.');
      } else if (err.response.status === 422) {
        const details = err.response?.data?.detail;
        if (Array.isArray(details)) {
          setError(details.map((d: any) => d.msg).join(', '));
        } else {
          setError('Données de formulaire non valides.');
        }
      } else {
        setError(
          err.response?.data?.detail ||
            err.response?.data?.error?.message ||
            'Une erreur est survenue lors de la connexion.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col items-center justify-center p-4 transition-colors duration-200 relative overflow-hidden">
      {/* Background Accent Glows */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-pesage-blue/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-pesage-orange/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Right Theme Toggle Switch */}
      <div className="absolute top-4 right-4 z-20">
        <div className="flex items-center p-1 rounded-xl bg-app-surface border border-app-border shadow-xs text-xs font-semibold">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all ${
              theme === 'light'
                ? 'bg-app-surface-subtle text-pesage-blue shadow-xs font-bold border border-app-border'
                : 'text-app-text-muted hover:text-app-text'
            }`}
            title="Mode Clair"
          >
            <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-pesage-orange' : ''}`} />
            <span>Clair</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all ${
              theme === 'dark'
                ? 'bg-pesage-blue text-white shadow-xs font-bold'
                : 'text-app-text-muted hover:text-app-text'
            }`}
            title="Mode Sombre"
          >
            <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-pesage-orange' : ''}`} />
            <span>Sombre</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Pesage 2000 Logo Header */}
        <div className="text-center space-y-3">
          <div className="inline-block p-3 rounded-2xl bg-white shadow-md border border-slate-200 mx-auto transition-transform hover:scale-105">
            <img
              src="/branding/pesage-2000-logo.png"
              alt="Pesage 2000 Logo"
              className="h-12 w-auto object-contain mx-auto"
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-app-text uppercase">
              PESAGE 2000
            </h1>
            <p className="text-xs font-bold text-pesage-orange tracking-wider uppercase">
              Gestion Commerciale ERP
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-app-surface p-8 rounded-3xl border border-app-border shadow-xl space-y-6">
          <div className="space-y-1 text-center">
            <h2 className="text-lg font-bold text-app-text">Connexion à votre espace</h2>
            <p className="text-xs text-app-text-muted">Accès sécurisé à la plateforme ERP Pesage 2000</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-app-text block">Adresse e-mail *</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-app-text-muted" />
                <input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-app-surface-subtle border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue focus:ring-2 focus:ring-pesage-blue/20 transition-all placeholder:text-app-text-muted"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-app-text block">Mot de passe *</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-app-text-muted" />
                <input
                  type="password"
                  required
                  placeholder="CHANGE_THIS_PASSWORD"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-app-surface-subtle border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue focus:ring-2 focus:ring-pesage-blue/20 transition-all placeholder:text-app-text-muted"
                />
              </div>
            </div>

            {/* Quick Demo Credentials Assistant */}
            <div className="p-3 rounded-xl bg-pesage-blue/5 border border-pesage-blue/15 text-[11px] space-y-1 text-app-text-secondary">
              <p className="font-bold text-pesage-blue dark:text-pesage-blue-light">Compte Administrateur système :</p>
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span>E-mail: <strong>admin@example.com</strong></span>
                <span>Pswd: <strong>CHANGE_THIS_PASSWORD</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@example.com');
                  setPassword('CHANGE_THIS_PASSWORD');
                }}
                className="text-[10px] text-pesage-orange hover:underline font-semibold block mt-1"
              >
                Remplir automatiquement les identifiants
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-bold text-xs transition-all shadow-md shadow-pesage-blue/25 flex items-center justify-center space-x-2 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Se connecter</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-app-text-muted font-semibold">
          Pesage 2000 &copy; 2026. Solution de Gestion Commerciale.
        </p>
      </div>
    </div>
  );
};

