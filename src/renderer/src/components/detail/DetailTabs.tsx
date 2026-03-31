import React from 'react';
import { Globe, Info as InfoIcon, MessageSquare, Star } from 'lucide-react';

export type DetailTabType = 'info' | 'links' | 'board' | 'evaluation';

const tabs = [
  { id: 'info', label: '游戏信息', icon: InfoIcon },
  { id: 'links', label: '资源链接', icon: Globe },
  { id: 'board', label: '讨论版', icon: MessageSquare },
  { id: 'evaluation', label: '游戏评价', icon: Star }
] as const;

interface DetailTabsProps {
  activeTab: DetailTabType;
  onChange: (tab: DetailTabType) => void;
}

export const DetailTabs: React.FC<DetailTabsProps> = ({ activeTab, onChange }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1 flex">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === tab.id ? 'bg-slate-50 text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'}`}
      >
        <tab.icon size={18} />
        <span>{tab.label}</span>
      </button>
    ))}
  </div>
);
