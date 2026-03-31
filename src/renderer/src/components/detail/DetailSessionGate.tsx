import React from 'react';

interface DetailSessionGateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  buttonClassName: string;
  onLogin: () => void;
}

export const DetailSessionGate: React.FC<DetailSessionGateProps> = ({
  icon: Icon,
  title,
  description,
  buttonClassName,
  onLogin
}) => (
  <div className="bg-slate-50 rounded-[2rem] p-12 text-center flex flex-col items-center gap-4 border border-slate-100">
    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
      <Icon size={32} />
    </div>
    <h3 className="text-lg font-black text-slate-800">{title}</h3>
    <p className="text-sm font-bold text-slate-400">{description}</p>
    <button
      onClick={onLogin}
      className={`mt-2 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 ${buttonClassName}`}
    >
      立即登录
    </button>
  </div>
);
