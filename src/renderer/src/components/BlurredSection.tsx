import React, { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../store/useTouchGalStore';

interface BlurredSectionProps {
  isLoggedIn: boolean;
  title: string;
  children: ReactNode;
}

export const BlurredSection: React.FC<BlurredSectionProps> = ({ isLoggedIn, title, children }) => {
  const setIsLoginOpen = useAuthStore((state) => state.setIsLoginOpen);

  if (isLoggedIn) return <section className="w-full">{children}</section>;

  return (
    <section className="relative w-full">
      <div className="blur-md pointer-events-none select-none opacity-40">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl p-8 text-center transition-all hover:bg-white/50">
        <div className="p-4 bg-blue-50 text-blue-600 rounded-full shadow-inner">
          <Lock size={32} strokeWidth={2.5} />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-xl text-slate-800">
            {title}已锁定
          </h3>
          <p className="text-slate-500 text-sm max-w-[200px]">
            请登录您的账号以解锁完整内容
          </p>
        </div>
        <button
          onClick={() => setIsLoginOpen(true)}
          className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          立即登录
        </button>
      </div>
    </section>
  );
};
