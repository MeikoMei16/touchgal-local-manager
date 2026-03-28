import React, { useState, useEffect } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { User, Lock, ShieldCheck, X, Loader2, RefreshCw } from 'lucide-react';

export const LoginModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { isLoading, error, captchaUrl, fetchCaptcha, login } = useTouchGalStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username, password, captcha);
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
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-field">
            <Lock size={18} />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="captcha-section">
            <div className="input-field captcha-input">
              <ShieldCheck size={18} />
              <input 
                type="text" 
                placeholder="Captcha" 
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                required
              />
            </div>
            <div className="captcha-image-container" onClick={fetchCaptcha}>
              {captchaUrl ? (
                <img src={captchaUrl} alt="captcha" />
              ) : (
                <Loader2 className="animate-spin" />
              )}
              <div className="refresh-overlay"><RefreshCw size={14} /></div>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button className="login-btn" type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : 'Login'}
          </button>
        </form>
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
        .login-btn { margin-top: 12px; padding: 14px; background: var(--md-sys-color-primary); color: white; border: none; border-radius: var(--radius-xl); font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .error-msg { color: #ef4444; font-size: 13px; margin: 0; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
