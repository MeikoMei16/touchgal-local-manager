import React, { useState, useEffect } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { User, Lock, ShieldCheck, X, Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { CaptchaChallenge } from './CaptchaChallenge';

export const LoginModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { isLoading, error, captchaUrl, captchaChallenge, fetchCaptcha, login, user } = useTouchGalStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [isChallengeOpen, setIsChallengeOpen] = useState(false);

  useEffect(() => {
    // Check if we already have a challenge or URL
    if (isChallengeOpen && !captchaChallenge) {
      setIsChallengeOpen(false);
    }
  }, [captchaChallenge, isChallengeOpen]);

  // Close modal on successful login
  useEffect(() => {
    if (user) {
      onClose();
    }
  }, [user, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // First, fetch captcha to see if it's a challenge or legacy
    await fetchCaptcha();
    
    // The fetchCaptcha call will update store.captchaChallenge or store.captchaUrl
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
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content login-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Login to TouchGal</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </header>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-field">
            <User size={18} />
            <input 
              type="text" 
              placeholder="Username or Email" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-field">
            <Lock size={18} />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button 
              type="button" 
              className="eye-btn" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Legacy Captcha Section (only if challenge is not active and we have a legacy URL) */}
          {!captchaChallenge && captchaUrl && (
            <div className="captcha-section">
              <div className="input-field captcha-input">
                <ShieldCheck size={18} />
                <input 
                  type="text" 
                  placeholder="Verification Code" 
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  required
                />
              </div>
              <div className="captcha-image-container" onClick={fetchCaptcha}>
                <img src={captchaUrl} alt="captcha" />
                <div className="refresh-overlay"><RefreshCw size={14} /></div>
              </div>
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}

          <button className="login-btn" type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : (captchaUrl ? 'Login' : 'Next')}
          </button>
        </form>

        {isChallengeOpen && captchaChallenge && (
          <CaptchaChallenge 
            onSuccess={handleChallengeSuccess} 
            onCancel={() => setIsChallengeOpen(false)} 
          />
        )}
      </div>

      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .modal-content { background: var(--md-sys-color-surface); width: 100%; max-width: 400px; padding: 32px; border-radius: var(--radius-xl); box-shadow: 0 12px 48px rgba(0,0,0,0.3); position: relative; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .modal-header h2 { margin: 0; font-size: 20px; }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .input-field { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--md-sys-color-surface-variant); border-radius: var(--radius-md); border: 1px solid transparent; transition: all 0.2s; }
        .input-field:focus-within { border-color: var(--md-sys-color-primary); background: var(--md-sys-color-surface); }
        .input-field input { border: none; background: transparent; outline: none; flex: 1; color: var(--md-sys-color-on-surface); }
        .captcha-section { display: flex; gap: 12px; align-items: stretch; }
        .captcha-input { flex: 1; }
        .captcha-image-container { width: 100px; border-radius: var(--radius-md); overflow: hidden; position: relative; cursor: pointer; background: #eee; display: flex; align-items: center; justify-content: center; }
        .captcha-image-container img { width: 100%; height: 100%; object-fit: cover; }
        .refresh-overlay { position: absolute; top: 0; right: 0; padding: 2px; background: rgba(0,0,0,0.3); color: white; display: none; }
        .captcha-image-container:hover .refresh-overlay { display: block; }
        .login-btn { margin-top: 12px; padding: 14px; background: #0369a1; color: white; border: none; border-radius: 40px; font-weight: 700; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
        .login-btn:hover { background: #075985; transform: translateY(-1px); }
        .login-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .eye-btn { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; }
        .eye-btn:hover { color: #64748b; }
        .error-msg { color: #ef4444; font-size: 13px; margin: 0; font-weight: 600; text-align: center; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
