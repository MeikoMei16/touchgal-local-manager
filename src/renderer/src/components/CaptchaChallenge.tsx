import React, { useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { X, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';

interface CaptchaChallengeProps {
  onSuccess: (code: string) => void;
  onCancel: () => void;
}

export const CaptchaChallenge: React.FC<CaptchaChallengeProps> = ({ onSuccess, onCancel }) => {
  const { captchaChallenge, isLoading, verifyCaptcha, fetchCaptcha } = useTouchGalStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);

  if (!captchaChallenge) return null;

  const toggleSelection = (id: string) => {
    setLocalError(null);
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleVerify = async () => {
    setLocalError(null);
    const code = await verifyCaptcha(Array.from(selectedIds));
    if (code) {
      onSuccess(code);
    } else {
      setLocalError('验证失败，请重新选择');
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="captcha-challenge-overlay">
      <div className="captcha-challenge-container">
        <header className="challenge-header">
          <div className="header-text">
            <h3>人机验证</h3>
            <p>请选择下面所有的 <strong>白毛 女孩子</strong></p>
          </div>
          <button className="close-icon-btn" onClick={onCancel}>
            <X size={20} />
          </button>
        </header>

        <div className="challenge-grid">
          {captchaChallenge.images.map((image) => (
            <div 
              key={image.id} 
              className={`challenge-item ${selectedIds.has(image.id) ? 'selected' : ''}`}
              onClick={() => toggleSelection(image.id)}
            >
              <img src={image.data} alt="challenge" />
              {selectedIds.has(image.id) && (
                <div className="selection-overlay">
                  <CheckCircle2 size={32} className="text-white" />
                </div>
              )}
            </div>
          ))}
        </div>

        {localError && <p className="challenge-error-msg">{localError}</p>}

        <footer className="challenge-footer">
          <button className="refresh-btn" onClick={() => { fetchCaptcha(); setSelectedIds(new Set()); }} disabled={isLoading}>
            <RotateCcw size={18} />
            <span>刷新</span>
          </button>
          
          <div className="action-btns">
            <button className="cancel-text-btn" onClick={onCancel}>取消</button>
            <button 
              className="verify-btn" 
              onClick={handleVerify} 
              disabled={isLoading || selectedIds.size === 0}
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : '确定'}
            </button>
          </div>
        </footer>
      </div>

      <style>{`
        .captcha-challenge-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 3000; }
        .captcha-challenge-container { background: white; width: 100%; max-width: 380px; padding: 24px; border-radius: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
        
        .challenge-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .header-text h3 { margin: 0; font-size: 18px; font-weight: 800; color: #1e293b; }
        .header-text p { margin: 4px 0 0 0; font-size: 14px; color: #64748b; }
        .header-text strong { color: #0369a1; }
        
        .close-icon-btn { color: #94a3b8; border: none; background: none; cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.2s; }
        .close-icon-btn:hover { background: #f1f5f9; color: #1e293b; }

        .challenge-grid { display: grid; grid-cols: 2; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .challenge-item { position: relative; aspect-ratio: 1; border-radius: 16px; overflow: hidden; cursor: pointer; border: 3px solid transparent; transition: all 0.2s; }
        .challenge-item img { width: 100%; height: 100%; object-fit: cover; }
        .challenge-item.selected { border-color: #0369a1; transform: scale(0.96); }
        
        .challenge-error-msg { color: #ef4444; font-size: 13px; font-weight: 700; text-align: center; margin-bottom: 16px; animation: shake 0.4s ease-in-out; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-4px); } 40%, 80% { transform: translateX(4px); } }

        .selection-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(3, 105, 161, 0.4); display: flex; align-items: center; justify-content: center; }
        
        .challenge-footer { display: flex; justify-content: space-between; align-items: center; }
        .refresh-btn { display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 13px; font-weight: 700; background: none; border: none; cursor: pointer; padding: 8px; border-radius: 12px; transition: all 0.2s; }
        .refresh-btn:hover { background: #f1f5f9; color: #0369a1; }
        
        .action-btns { display: flex; gap: 12px; align-items: center; }
        .cancel-text-btn { font-size: 14px; font-weight: 700; color: #64748b; background: none; border: none; cursor: pointer; }
        .verify-btn { padding: 10px 24px; background: #0369a1; color: white; border: none; border-radius: 16px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; min-width: 80px; display: flex; justify-content: center; }
        .verify-btn:hover { background: #075985; transform: translateY(-1px); }
        .verify-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
