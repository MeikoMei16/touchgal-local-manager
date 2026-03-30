import React, { useState } from 'react';
import { useAuthStore } from '../store/useTouchGalStore';
import { X, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';

interface CaptchaChallengeProps {
  onSuccess: (code: string) => void;
  onCancel: () => void;
}

export const CaptchaChallenge: React.FC<CaptchaChallengeProps> = ({ onSuccess, onCancel }) => {
  const { captchaChallenge, isLoading, verifyCaptcha, fetchCaptcha } = useAuthStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);

  if (!captchaChallenge) return null;
  console.log('[CaptchaChallenge] Rendering with data:', captchaChallenge);

  const toggleImage = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
    setLocalError(null);
  };

  const handleVerify = async () => {
    if (selectedIds.size === 0) {
      setLocalError('Please select at least one image');
      return;
    }

    const code = await verifyCaptcha(Array.from(selectedIds));
    if (code) {
      onSuccess(code);
    } else {
      setSelectedIds(new Set());
      setLocalError('Incorrect selection, please try again');
    }
  };

  const prompt = captchaChallenge.target || '白毛 女孩子 (White hair girls)';
  const imageCount = captchaChallenge.images.length;
  const gridClass =
    imageCount === 4
      ? 'grid-cols-2'
      : imageCount <= 2
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[3000] animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md p-8 rounded-[40px] shadow-2xl relative animate-in zoom-in-95 ease-out-back duration-500">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h3 className="m-0 text-xl font-black text-slate-900">Security Check</h3>
            <p className="m-0 text-sm text-slate-500 font-bold mt-1">Select all images with: <span className="text-primary underline decoration-2">{prompt}</span></p>
          </div>
          <button className="bg-slate-100 text-slate-500 border-none rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-all hover:bg-slate-200 hover:text-slate-800" onClick={onCancel}>
            <X size={20} />
          </button>
        </header>

        <div className={`grid ${gridClass} gap-2 mb-6`}>
          {captchaChallenge.images.map((img: any) => {
            const isSelected = selectedIds.has(img.id);
            return (
              <div 
                key={img.id}
                className={`relative aspect-square cursor-pointer rounded-2xl overflow-hidden border-4 transition-all duration-300 group ${isSelected ? 'border-primary shadow-lg scale-[0.98]' : 'border-transparent hover:border-slate-200'}`}
                onClick={() => toggleImage(img.id)}
              >
                <img src={img.url} alt="challenge" className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`} />
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center animate-in fade-in zoom-in duration-200">
                    <div className="bg-primary text-white rounded-full p-1 shadow-lg border-2 border-white">
                      <CheckCircle2 size={24} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {localError && <p className="text-red-500 text-sm font-bold mb-4 text-center animate-shake">{localError}</p>}

        <div className="flex gap-3">
          <button 
            className="flex-1 p-4 bg-slate-100 text-slate-600 border-none rounded-2xl font-bold text-sm cursor-pointer transition-all hover:bg-slate-200 flex items-center justify-center gap-2"
            onClick={fetchCaptcha}
            disabled={isLoading}
          >
            <RotateCcw size={18} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button 
            className="flex-[2] p-4 bg-primary text-on-primary border-none rounded-2xl font-black text-sm cursor-pointer transition-all hover:bg-primary/95 hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={handleVerify}
            disabled={isLoading || selectedIds.size === 0}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <span>Verify</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
