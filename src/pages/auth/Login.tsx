import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Languages
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { loginUser } from '../../services/authService';

export const Login: React.FC = () => {
  const { setCurrentUserDirect } = useAuth();
  const { success, error } = useToast();
  const { language, setLanguage } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setAuthError(language === 'te' ? 'దయచేసి ఈమెయిల్ నమోదు చేయండి' : 'Please enter an email address');
      return;
    }
    if (!password) {
      setAuthError(language === 'te' ? 'దయచేసి పాస్‌వర్డ్ నమోదు చేయండి' : 'Please enter a password');
      return;
    }

    setAuthError(null);
    setLoading(true);

    try {
      const profile = await loginUser(email, password);
      setCurrentUserDirect(profile);
      success(
        language === 'te'
          ? `స్వాగతం, ${profile.fullName}! (${profile.storeName || 'Admin'})`
          : `Welcome back, ${profile.fullName}!`
      );
    } catch (err: any) {
      console.error('Login submit error:', err);
      setAuthError(err.message || 'Login failed. Please check credentials or network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-md w-full space-y-5">
        
        {/* Language Switcher Pill */}
        <div className="flex items-center justify-between bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <Languages className="w-4 h-4 text-indigo-600" />
            <span>భాష / Language:</span>
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                language === 'en' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('te')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                language === 'te' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              తెలుగు
            </button>
            <button
              type="button"
              onClick={() => setLanguage('dual')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                language === 'dual' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dual
            </button>
          </div>
        </div>

        {/* Brand Banner Card */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-600/20 text-white">
            <Building2 className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {language === 'te'
                ? 'రారాజు మల్టీ-స్టోర్ పీఓఎస్'
                : language === 'dual'
                ? 'RARAJU POS / రారాజు పీఓఎస్'
                : 'RARAJU POS & INVENTORY'}
            </h1>
            <p className="text-xs text-indigo-600 font-bold tracking-wide mt-0.5">
              {language === 'te'
                ? 'సెంట్రలైజ్డ్ బిజినెస్ & బిల్లింగ్ మేనేజ్‌మెంట్ సిస్టమ్'
                : 'Centralized Multi-Store Billing & Management System'}
            </p>
          </div>
        </div>

        {/* Clean White Login Box */}
        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {language === 'te' ? 'ఈమెయిల్ లేదా యూజర్‌నేమ్' : 'Email Address / Username'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@raraju.com or store@raraju.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 font-mono"
                />
              </div>
            </div>

            {/* Password Field with View Eye Icon */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'te' ? 'పాస్‌వర్డ్' : 'Password'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-bold focus:outline-none"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>{language === 'te' ? 'దాచు' : 'Hide'}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>{language === 'te' ? 'చూడు' : 'Show password'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 font-mono text-sm tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 font-semibold animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'te' ? 'లాగిన్ అవుతోంది...' : 'Signing in...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {language === 'te'
                      ? 'సిస్టమ్‌లోకి ప్రవేశించండి (Login)'
                      : 'Sign In to Management System'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
