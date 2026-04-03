import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useTouchGalStore';
import { User, Lock, ShieldCheck, X, Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { CaptchaChallenge } from './CaptchaChallenge';

export const LoginModal: React.FC = () => {
  const { isLoading, error, captchaUrl, captchaChallenge, fetchCaptcha, login, user, setIsLoginOpen, clearAuthUi } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [isChallengeOpen, setIsChallengeOpen] = useState(false);

  const closeModal = () => {
    clearAuthUi();
    setCaptcha('');
    setIsChallengeOpen(false);
    setIsLoginOpen(false);
  };

  useEffect(() => {
    // Check if we already have a challenge or URL
    if (isChallengeOpen && !captchaChallenge) {
      setIsChallengeOpen(false);
    }
  }, [captchaChallenge, isChallengeOpen]);

  // Close modal on successful login
  useEffect(() => {
    if (user) {
      closeModal();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    if (captchaUrl && captcha) {
      // Legacy image captcha flow
      await login(username, password, captcha);
      setCaptcha('');
    } else if (captchaChallenge) {
      setIsChallengeOpen(true);
    } else if (!captchaChallenge && !captchaUrl) {
      // No captcha yet — fetch one (either challenge or legacy)
      await fetchCaptcha();
      setCaptcha('');
    }
    // If captchaChallenge is set, the useEffect will open the challenge panel
  };

  // This effect handles jumping to challenge if it's returned
  useEffect(() => {
    if (captchaChallenge) {
      setIsChallengeOpen(true);
    }
  }, [captchaChallenge]);

  const handleChallengeSuccess = async (code: string) => {
    setIsChallengeOpen(false);
    await login(username, password, code);
    // If login failed, captchaChallenge will be refreshed by the store.
    // The useEffect below will re-open the challenge window automatically.
  };

  const openRegisterPage = () => {
    window.open('https://www.touchgal.top/register', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[2000] animate-in fade-in duration-300" onClick={closeModal}>
      <div className="bg-white w-full max-w-sm p-10 rounded-[32px] shadow-2xl relative animate-in zoom-in-95 ease-out-back duration-500" onClick={(e) => e.stopPropagation()}>
        <header className="flex justify-between items-center mb-8">
          <h2 className="m-0 text-2xl font-black text-slate-900 tracking-tight">Login to TouchGal</h2>
          <button className="bg-slate-100 text-slate-500 border-none rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-all hover:bg-slate-200 hover:text-slate-800" onClick={closeModal}>
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl transition-all focus-within:bg-white focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5 shadow-inner group">
            <User size={18} className="text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Username or Email" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-none bg-transparent outline-none flex-1 font-bold text-slate-800 placeholder:text-slate-400"
              required
            />
          </div>

          <div className="flex items-center gap-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl transition-all focus-within:bg-white focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5 shadow-inner group">
            <Lock size={18} className="text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-none bg-transparent outline-none flex-1 font-bold text-slate-800 placeholder:text-slate-400"
              required
            />
            <button 
              type="button" 
              className="bg-none border-none text-slate-400 cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-slate-600" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Legacy Captcha Section (only if challenge is not active and we have a legacy URL) */}
          {!captchaChallenge && captchaUrl && (
            <div className="flex gap-3 items-stretch animate-in slide-in-from-top-4 duration-300">
              <div className="flex-1 flex items-center gap-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl transition-all focus-within:bg-white focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5 shadow-inner group">
                <ShieldCheck size={18} className="text-slate-400 group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="Code" 
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  className="border-none bg-transparent outline-none flex-1 font-bold text-slate-800 placeholder:text-slate-400 min-w-0"
                  required
                />
              </div>
              <div className="w-[110px] bg-slate-100 rounded-2xl overflow-hidden relative cursor-pointer border border-slate-200 flex items-center justify-center group shadow-xs" onClick={fetchCaptcha}>
                <img src={captchaUrl} alt="captcha" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <RefreshCw size={18} className="animate-spin-slow" />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm font-bold m-0 text-center whitespace-pre-line">{error}</p>}

          <button className="mt-4 p-4.5 bg-primary text-on-primary border-none rounded-full font-black text-base cursor-pointer flex items-center justify-center gap-2 transition-all hover:bg-primary/95 hover:shadow-xl active:scale-[0.97] shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none" type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : (captchaUrl ? 'Login' : 'Next')}
          </button>

          <button
            type="button"
            className="border-none bg-transparent text-sm font-bold text-primary cursor-pointer transition-colors hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={openRegisterPage}
            disabled={isLoading}
          >
            没有账户？注册
          </button>
        </form>

        {isChallengeOpen && captchaChallenge && (
          <CaptchaChallenge 
            onSuccess={handleChallengeSuccess} 
            onCancel={() => {
              clearAuthUi();
              setCaptcha('');
              setIsChallengeOpen(false);
            }} 
          />
        )}
      </div>
    </div>
  );
};
