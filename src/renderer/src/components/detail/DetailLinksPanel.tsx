import React from 'react';
import { Globe } from 'lucide-react';

export const DetailLinksPanel: React.FC = () => (
  <div className="bg-white rounded-[2rem] p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center gap-4">
    <Globe size={64} className="text-slate-200" />
    <h2 className="text-xl font-black text-slate-800">资源链接</h2>
    <p className="text-slate-500 font-medium">官方购买建议于官网进行，资源链接请查看讨论版。</p>
  </div>
);
