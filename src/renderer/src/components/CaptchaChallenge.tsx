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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[3000] animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-[400px] p-8 rounded-[32px] shadow-2xl relative animate-in zoom-in-95 duration-500 border border-white/20">
        <header className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h3 className="m-0 text-xl font-black text-slate-900 tracking-tight">人机验证 / Verification</h3>
            <p className="m-0 text-sm font-bold text-slate-500">请选择下面所有的 <strong className="text-primary font-black">白毛 女孩子</strong></p>
          </div>
          <button className="text-slate-400 border-none bg-none cursor-pointer p-2 rounded-full transition-all hover:bg-slate-100 hover:text-slate-800" onClick={onCancel}>
            <X size={20} />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {captchaChallenge.images.map((image) => (
            <div 
              key={image.id} 
              className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-4 transition-all duration-300 hover:scale-[1.02] active:scale-95 group shadow-sm ${
                selectedIds.has(image.id) ? 'border-primary shadow-lg scale-95' : 'border-transparent'
              }`}
              onClick={() => toggleSelection(image.id)}
            >
              <img src={image.data} alt="challenge" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              {selectedIds.has(image.id) && (
                <div className="absolute inset-0 bg-primary/40 flex items-center justify-center animate-in zoom-in-50 duration-200 backdrop-blur-[2px]">
                  <CheckCircle2 size={40} className="text-white drop-shadow-lg" />
                </div>
              )}
            </div>
          ))}
        </div>

        {localError && <p className="text-red-500 text-sm font-black text-center mb-6 animate-bounce">{localError}</p>}

        <footer className="flex justify-between items-center bg-slate-50 -mx-8 -mb-8 p-6 rounded-b-[32px] border-t border-slate-100">
          <button className="flex items-center gap-2 text-slate-500 font-bold text-sm bg-transparent border-none cursor-pointer p-2.5 rounded-xl transition-all hover:bg-white hover:text-primary active:scale-90 shadow-xs" onClick={() => { fetchCaptcha(); setSelectedIds(new Set()); }} disabled={isLoading}>
            <RotateCcw size={18} className={isLoading ? 'animate-spin' : ''} />
            <span>刷新</span>
          </button>
          
          <div className="flex gap-4 items-center">
            <button className="text-sm font-black text-slate-400 bg-none border-none cursor-pointer hover:text-slate-600 transition-colors" onClick={onCancel}>取消</button>
            <button 
              className="px-8 py-3 bg-primary text-on-primary border-none rounded-2xl font-black text-sm cursor-pointer transition-all hover:bg-primary/95 hover:shadow-lg active:scale-[0.98] shadow-md shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none" 
              onClick={handleVerify} 
              disabled={isLoading || selectedIds.size === 0}
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : '确定'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
