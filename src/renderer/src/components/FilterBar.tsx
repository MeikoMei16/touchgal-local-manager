import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, Calendar, Star, MessageSquare, Users, 
  Laptop, Shield, ShieldCheck, AlertTriangle, Tag, X, Plus, Search
} from 'lucide-react';
import { useTouchGalStore } from '../store/useTouchGalStore';

interface FilterBarProps {
  onFilterChange: (filters: any) => void;
  onSubmit?: (filters: any) => void;
  isLoading?: boolean;
}

type NsfwMode = 'safe' | 'nsfw' | 'all';
type Operator = '=' | '>=' | '<=' | '>' | '<';

export const FilterBar: React.FC<FilterBarProps> = ({ onFilterChange, onSubmit }) => {
  const { selectedTags, addTagFilter, removeTagFilter, advancedFilterDraft } = useTouchGalStore();

  // --- State ---
  const [nsfwMode, setNsfwMode] = useState<NsfwMode>('safe');
  const [platform, setPlatform] = useState('all');
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const [yearInput, setYearInput] = useState('');
  const [activeOp, setActiveOp] = useState<Operator>('>=');
  const [isOpMenuOpen, setIsOpMenuOpen] = useState(false);
  const [yearConstraints, setYearConstraints] = useState<Array<{op: string, val: number}>>([]);
  
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [isSearchingTags, setIsSearchingTags] = useState(false);
  
  // Stats
  const [minRatingCount, setMinRatingCount] = useState(0);
  const [minRatingScore, setMinRatingScore] = useState(0);
  const [minCommentCount, setMinCommentCount] = useState(0);

  const platformRef = useRef<HTMLDivElement>(null);
  const opMenuRef = useRef<HTMLDivElement>(null);

  // --- Constants ---
  const platforms = [
    { label: '全部平台', value: 'all' },
    { label: 'Windows', value: 'windows' },
    { label: 'Android', value: 'android' },
    { label: 'MacOS', value: 'macos' },
    { label: 'iOS', value: 'ios' },
    { label: 'Linux', value: 'linux' }
  ];

  const operators = [
    { label: '精确等于 (=)', value: '=' },
    { label: '不早于 (>=)', value: '>=' },
    { label: '不晚于 (<=)', value: '<=' },
    { label: '晚于 (>)', value: '>' },
    { label: '早于 (<)', value: '<' }
  ];

  // --- Click Outside ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (platformRef.current && !platformRef.current.contains(event.target as Node)) setIsPlatformOpen(false);
      if (opMenuRef.current && !opMenuRef.current.contains(event.target as Node)) setIsOpMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setNsfwMode(
      advancedFilterDraft.nsfwMode === 'nsfw'
        ? 'nsfw'
        : advancedFilterDraft.nsfwMode === 'all'
          ? 'all'
          : 'safe'
    );
    setPlatform(advancedFilterDraft.selectedPlatform);
    setYearConstraints(advancedFilterDraft.yearConstraints);
    setMinRatingCount(advancedFilterDraft.minRatingCount);
    setMinRatingScore(advancedFilterDraft.minRatingScore);
    setMinCommentCount(advancedFilterDraft.minCommentCount);
  }, [advancedFilterDraft]);

  // --- Helpers ---
  const emitChange = (overrides: any = {}) => {
    return {
      nsfwMode: overrides.nsfwMode ?? nsfwMode,
      selectedPlatform: overrides.selectedPlatform ?? platform,
      yearConstraints: overrides.yearConstraints ?? yearConstraints,
      minRatingCount: overrides.minRatingCount ?? minRatingCount,
      minRatingScore: overrides.minRatingScore ?? minRatingScore,
      minCommentCount: overrides.minCommentCount ?? minCommentCount,
      selectedTags: overrides.selectedTags ?? selectedTags,
      ...overrides
    };
  };

  const publishChange = (overrides: any = {}) => {
    onFilterChange(emitChange(overrides));
  };

  const submitFilters = (overrides: any = {}) => {
    const payload = emitChange(overrides);
    onFilterChange(payload);
    onSubmit?.(payload);
  };

  const handleYearEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && yearInput.trim()) {
      const val = parseInt(yearInput.trim());
      if (!isNaN(val)) {
        const newConstraints = [...yearConstraints, { op: activeOp, val }];
        setYearConstraints(newConstraints);
        setYearInput('');
        publishChange({ yearConstraints: newConstraints });
      }
    }
  };

  const removeYearConstraint = (index: number) => {
    const newConstraints = yearConstraints.filter((_, i) => i !== index);
    setYearConstraints(newConstraints);
    publishChange({ yearConstraints: newConstraints });
  };

  const toggleNsfwMode = () => {
    const modes: NsfwMode[] = ['safe', 'nsfw', 'all'];
    const nextIdx = (modes.indexOf(nsfwMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setNsfwMode(nextMode);
    publishChange({ nsfwMode: nextMode });
  };

  const getNsfwContent = () => {
    switch (nsfwMode) {
      case 'safe': return { icon: <ShieldCheck size={18} />, label: '仅限全年龄', class: 'bg-green-50 border-green-200 text-green-700' };
      case 'nsfw': return { icon: <AlertTriangle size={18} />, label: '仅限 R18', class: 'bg-red-50 border-red-200 text-red-700' };
      case 'all': return { icon: <Shield size={18} />, label: '混合内容', class: 'bg-slate-50 border-slate-200 text-slate-700' };
    }
  };

  useEffect(() => {
    const search = async () => {
      if (!tagSearchInput.trim()) {
        setTagSuggestions([]);
        return;
      }
      setIsSearchingTags(true);
      try {
        const results = await window.api.searchTags(tagSearchInput);
        setTagSuggestions(results.map((t: any) => t.name));
      } catch { /* ignore */ }
      setIsSearchingTags(false);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [tagSearchInput]);

  const handleAddTag = (tag: string) => {
    addTagFilter(tag);
    setTagSearchInput('');
    setTagSuggestions([]);
    publishChange({ selectedTags: selectedTags.includes(tag) ? selectedTags : [...selectedTags, tag] });
  };

  return (
    <div
      className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-100/50 mb-8 overflow-hidden"
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (event.key !== 'Enter') return;
        if (target?.dataset?.submitMode === 'skip') return;
        submitFilters();
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* Left Column: Core Filters */}
        <div className="flex flex-col gap-8">
          
          {/* NSFW & Platform Row */}
          <div className="flex items-center gap-4">
            <button 
              className={`flex items-center gap-3 h-12 px-6 rounded-full border-2 font-bold text-sm transition-all hover:-translate-y-0.5 ${getNsfwContent().class}`}
              onClick={toggleNsfwMode}
            >
              {getNsfwContent().icon}
              <span>{getNsfwContent().label}</span>
            </button>

            <div className="relative flex-1" ref={platformRef}>
              <button 
                className={`flex items-center justify-between w-full h-12 px-6 rounded-full border-2 border-slate-200 bg-white font-bold text-slate-600 transition-all hover:border-slate-400 ${platform !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700' : ''}`}
                onClick={() => setIsPlatformOpen(!isPlatformOpen)}
              >
                <div className="flex items-center gap-3">
                  <Laptop size={18} />
                  <span>{platforms.find(p => p.value === platform)?.label}</span>
                </div>
                <ChevronDown size={16} className={`transition-transform duration-300 ${isPlatformOpen ? 'rotate-180' : ''}`} />
              </button>
              {isPlatformOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 p-2 bg-white border border-slate-200 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2">
                  {platforms.map(p => (
                    <div 
                      key={p.value} 
                      className={`px-4 py-2.5 rounded-xl cursor-pointer text-sm font-semibold transition-colors ${platform === p.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      onClick={() => { setPlatform(p.value); setIsPlatformOpen(false); publishChange({ selectedPlatform: p.value }); }}
                    >
                      {p.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Year Section */}
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2 px-1">
                <Calendar size={18} className="text-slate-400" />
                <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest">发行年份筛选</span>
             </div>
             <div className="flex bg-slate-50 border-2 border-slate-200 rounded-full p-1 focus-within:border-blue-500 transition-all">
                <div className="relative" ref={opMenuRef}>
                   <button 
                      className="flex items-center justify-center gap-2 h-10 min-w-[110px] bg-white border border-slate-200 rounded-full font-bold text-sm text-blue-700 shadow-sm hover:bg-white hover:border-blue-300 transition-all"
                      onClick={() => setIsOpMenuOpen(!isOpMenuOpen)}
                   >
                      <span>{operators.find(o => o.value === activeOp)?.label}</span>
                      <ChevronDown size={14} />
                   </button>
                   {isOpMenuOpen && (
                      <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-50 min-w-[140px]">
                        {operators.map(op => (
                          <div 
                            key={op.value} 
                            className={`px-4 py-2 rounded-lg cursor-pointer font-bold text-xs transition-colors ${activeOp === op.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            onClick={() => { setActiveOp(op.value as Operator); setIsOpMenuOpen(false); }}
                          >
                            {op.label}
                          </div>
                        ))}
                      </div>
                   )}
                </div>
                <input 
                  type="text" 
                  placeholder="输入年份并按回车..." 
                  className="flex-1 bg-transparent px-4 font-bold text-slate-700 placeholder:text-slate-400 outline-none"
                  value={yearInput}
                  data-submit-mode="skip"
                  onChange={e => setYearInput(e.target.value)}
                  onKeyDown={handleYearEnter}
                />
             </div>
              <div className="flex flex-wrap gap-2 min-h-[32px] px-1 mt-1">
                {yearConstraints.length > 0 ? (
                  yearConstraints.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 border border-blue-200 rounded-lg text-xs font-black text-blue-800 shadow-sm animate-in zoom-in-95">
                      <span className="opacity-60">{operators.find(o => o.value === c.op)?.label.split(' ')[0]}</span>
                      <span>{c.val}</span>
                      <X size={14} className="cursor-pointer hover:text-red-600 ml-1" onClick={() => removeYearConstraint(i)} />
                    </div>
                  ))
                ) : (
                  <span className="text-xs font-semibold text-slate-400 italic">尚未添加年份约束条件...</span>
                )}
             </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-3 gap-4 mt-2">
            {[
              { label: '最低评分人数', icon: <Users size={16} />, val: minRatingCount, set: setMinRatingCount },
              { label: '最低资源评分', icon: <Star size={16} />, val: minRatingScore, set: setMinRatingScore, step: 0.1 },
              { label: '最低评论数量', icon: <MessageSquare size={16} />, val: minCommentCount, set: setMinCommentCount }
            ].map((stat, idx) => (
              <div key={idx} className="relative group">
                <div className="flex items-center justify-center gap-2 h-14 bg-slate-50 border-2 border-slate-200 rounded-3xl transition-all group-focus-within:border-blue-500 group-focus-within:bg-white">
                  <span className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter group-focus-within:text-blue-600">{stat.label}</span>
                  <div className="text-slate-400 group-focus-within:text-blue-500">{stat.icon}</div>
                  <input 
                    type="number"
                    step={stat.step || 1}
                    className="w-16 bg-transparent text-center font-black text-slate-700 outline-none"
                    value={stat.val}
                    onChange={e => stat.set(parseFloat(e.target.value) || 0)}
                    onKeyDown={e => e.key === 'Enter' && submitFilters()}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Tag Management Area (The 50% whitespace usage) */}
        <div className="flex flex-col bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-200 p-8 min-h-[320px] relative overflow-hidden group">
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-blue-600">
                <Tag size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">标签检索</h3>
                <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">Advanced Tag Selection</p>
              </div>
            </div>
            
            <div className={`flex items-center gap-2 px-4 py-2.5 bg-white border-2 rounded-2xl transition-all shadow-sm ${tagSearchInput ? 'border-blue-400 ring-4 ring-blue-50 w-full' : 'border-slate-200 w-48 hover:border-slate-400'}`}>
               <div className={isSearchingTags ? 'animate-spin' : ''}>
                  <Search size={18} className="text-slate-400" />
               </div>
               <input 
                 type="text" 
                 placeholder="寻找并添加标签..." 
                 className="bg-transparent border-none outline-none font-bold text-sm text-slate-700 placeholder:text-slate-400 w-full"
                 value={tagSearchInput}
                 data-submit-mode="skip"
                 onChange={e => setTagSearchInput(e.target.value)}
                 onBlur={() => setTimeout(() => setTagSuggestions([]), 200)}
               />
               {tagSuggestions.length > 0 && (
                  <div className="absolute top-20 left-8 right-8 z-[60] bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                     {tagSuggestions.map(tag => (
                        <div 
                          key={tag} 
                          className="px-4 py-3 rounded-xl hover:bg-blue-50 cursor-pointer flex items-center justify-between group/tip"
                          onClick={() => handleAddTag(tag)}
                        >
                           <span className="font-bold text-slate-600 group-hover/tip:text-blue-700">{tag}</span>
                           <Plus size={16} className="text-slate-300 group-hover/tip:text-blue-500" />
                        </div>
                     ))}
                  </div>
               )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-start">
             {selectedTags.length > 0 ? (
                <div className="flex flex-wrap content-start gap-3 w-full">
                   {selectedTags.map(tag => (
                      <div key={tag} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-2">
                         <span className="text-sm font-bold text-slate-700">{tag}</span>
                         <X 
                          size={16} 
                          className="text-slate-400 cursor-pointer hover:text-red-500" 
                          onClick={() => {
                            removeTagFilter(tag);
                            publishChange({ selectedTags: selectedTags.filter(t => t !== tag) });
                          }} 
                        />
                      </div>
                   ))}
                </div>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center opacity-40 group-hover:opacity-100 transition-opacity">
                   <div className="w-20 h-20 bg-white rounded-[32px] border border-slate-200 flex items-center justify-center text-slate-300 shadow-sm">
                      <Tag size={40} />
                   </div>
                   <div className="max-w-[240px]">
                      <p className="text-sm font-extrabold text-slate-500">此区域用于管理您关注的标签内容</p>
                      <p className="text-xs font-semibold text-slate-400 mt-1">输入上方搜索框开始添加过滤标签...</p>
                   </div>
                </div>
             )}
          </div>
          
          {/* Subtle Background Pattern */}
          <div className="absolute -bottom-10 -right-10 opacity-[0.03] select-none pointer-events-none group-hover:opacity-[0.06] transition-opacity">
             <Tag size={240} />
          </div>
        </div>

      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          className="px-5 py-3 rounded-full border-2 border-slate-200 bg-white text-slate-500 font-bold text-sm cursor-pointer transition-all hover:bg-slate-50 hover:border-slate-300"
          onClick={() => {
            const { resetAdvancedFilterDraft, clearTags } = useTouchGalStore.getState();
            resetAdvancedFilterDraft();
            clearTags();
            // Local state sync
            setNsfwMode('safe');
            setPlatform('all');
            setYearConstraints([]);
            setMinRatingCount(0);
            setMinRatingScore(0);
            setMinCommentCount(0);
            publishChange({
              nsfwMode: 'safe',
              selectedPlatform: 'all',
              yearConstraints: [],
              minRatingCount: 0,
              minRatingScore: 0,
              minCommentCount: 0,
              selectedTags: []
            });
          }}
        >
          重置条件
        </button>
        <button
          className="px-8 py-3 rounded-full border-none bg-primary text-white font-bold text-sm cursor-pointer transition-all hover:bg-primary/90 shadow-md transform active:scale-95"
          onClick={() => submitFilters()}
        >
          应用筛选
        </button>
      </div>
    </div>
  );
};
