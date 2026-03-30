import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, Calendar, Star, MessageSquare, Tag, X, Plus, Search
} from 'lucide-react';
import { useUIStore } from '../store/useTouchGalStore';

// Tag library with usage counts sourced from TouchGal
const TAG_LIBRARY: { name: string; count: number }[] = [
  { name: '冒险游戏（ADV）', count: 7258 }, { name: '男性主人公', count: 6570 },
  { name: 'ADV', count: 5734 }, { name: 'Galgame', count: 5383 },
  { name: 'PC', count: 4665 }, { name: 'GAL', count: 3257 },
  { name: '大胸女主角', count: 3284 }, { name: '多分支结局', count: 2855 },
  { name: '高中生女主角', count: 2798 }, { name: 'galgame', count: 2704 },
  { name: '纯爱', count: 2273 }, { name: '巨乳/爆乳', count: 2346 },
  { name: 'AVG', count: 2471 }, { name: '游戏', count: 2439 },
  { name: '主人公露过正脸', count: 2069 }, { name: '全处女主角', count: 1873 },
  { name: 'R18', count: 1931 }, { name: '学生女主角', count: 1857 },
  { name: '拔作', count: 1846 }, { name: '恋爱', count: 1828 },
  { name: '裸体立绘', count: 1735 }, { name: '内射/中出', count: 1462 },
  { name: '黄油', count: 1610 }, { name: '奇幻', count: 1680 },
  { name: '双马尾女主角', count: 1393 }, { name: '主人公的幼驯染女主角', count: 1420 },
  { name: '喜剧', count: 1396 }, { name: '其他人视角', count: 1354 },
  { name: '单女主角', count: 1301 }, { name: '成人女主角', count: 1296 },
  { name: '萝莉女主角', count: 1284 }, { name: '眼镜娘女主角', count: 1165 },
  { name: '巨乳', count: 1159 }, { name: '同居', count: 1115 },
  { name: '羞辱', count: 1078 }, { name: '萝', count: 1049 },
  { name: '后宫', count: 1042 }, { name: '有过性经验的女主角', count: 1009 },
  { name: '学校/学园', count: 1009 }, { name: '制服', count: 1025 },
  { name: '动漫', count: 995 }, { name: '高中', count: 975 },
  { name: '分支剧情', count: 969 }, { name: '成人主人公', count: 954 },
  { name: '学生主人公', count: 947 }, { name: '高中生主人公', count: 906 },
  { name: '怀孕', count: 890 }, { name: '女性主人公', count: 873 },
  { name: '悬疑', count: 860 }, { name: 'STEAM', count: 841 },
  { name: '处女', count: 834 }, { name: '单人', count: 827 },
  { name: '视觉小说', count: 828 }, { name: '主人公可命名', count: 824 },
  { name: '同人', count: 826 }, { name: '妹', count: 824 },
  { name: '坏结局', count: 797 }, { name: '大小姐女主角', count: 815 },
  { name: '傲娇女主角', count: 809 }, { name: '有绝对领域的女主角', count: 787 },
  { name: 'RPG', count: 792 }, { name: '口交', count: 778 },
  { name: '教师女主角', count: 740 }, { name: '选项少', count: 736 },
  { name: '马尾女主角', count: 732 }, { name: '萝莉', count: 733 },
  { name: '沉迷于性的女主角', count: 730 }, { name: '色情内容', count: 728 },
  { name: 'SLG', count: 724 }, { name: '着衣/穿衣', count: 721 },
  { name: '含有 SD CG', count: 713 }, { name: '文本框旁副立绘', count: 712 },
  { name: '贫乳女主角(非萝莉)', count: 714 }, { name: '巨乳女主角', count: 709 },
  { name: '亲吻场景', count: 703 }, { name: '多P/乱交', count: 694 },
  { name: '现代日本', count: 677 }, { name: '有配音的主人公', count: 676 },
  { name: '异种X', count: 682 }, { name: '无色情内容', count: 672 },
  { name: 'NTR', count: 667 }, { name: '触手', count: 661 },
  { name: '娇羞女主角', count: 659 }, { name: '已婚女主角', count: 640 },
  { name: '废萌', count: 642 }, { name: '全年龄', count: 648 },
  { name: '后宫结局', count: 647 }, { name: '冒险', count: 640 },
  { name: '视觉小说(无选项)', count: 640 }, { name: '裸露', count: 631 },
  { name: '地图移动', count: 605 }, { name: '主人公的妹妹女主角', count: 612 },
  { name: '乳交', count: 599 }, { name: '假小子女主角', count: 594 },
  { name: '休闲', count: 592 }, { name: '音乐欣赏', count: 585 },
  { name: '汉化', count: 579 }, { name: '主人公的学妹/后辈女主角', count: 577 },
  { name: '兄控女主角', count: 572 },
];

interface FilterBarProps {
  onFilterChange: (filters: any) => void;
  onSubmit?: (filters: any) => void;
  isLoading?: boolean;
}

type Operator = '=' | '>=' | '<=' | '>' | '<';

export const FilterBar: React.FC<FilterBarProps> = ({ onFilterChange, onSubmit }) => {
  const { addTagFilter, removeTagFilter, advancedFilterDraft } = useUIStore();
  const selectedTags = advancedFilterDraft.selectedTags;

  // --- State ---
  const [yearInput, setYearInput] = useState('');
  const [activeOp, setActiveOp] = useState<Operator>('>=');
  const [isOpMenuOpen, setIsOpMenuOpen] = useState(false);
  const [yearConstraints, setYearConstraints] = useState<Array<{op: string, val: number}>>([]);
  
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<{ name: string; count: number }[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

  // Stats
  const [minRatingScore, setMinRatingScore] = useState(0);
  const [minCommentCount, setMinCommentCount] = useState(0);

  const opMenuRef = useRef<HTMLDivElement>(null);

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
      if (opMenuRef.current && !opMenuRef.current.contains(event.target as Node)) setIsOpMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setYearConstraints(advancedFilterDraft.yearConstraints);
    setMinRatingScore(advancedFilterDraft.minRatingScore);
    setMinCommentCount(advancedFilterDraft.minCommentCount);
  }, [advancedFilterDraft]);

  // Tag search — filter TAG_LIBRARY locally, no API call needed
  useEffect(() => {
    const q = tagSearchInput.trim().toLowerCase();
    if (!q) { setTagSuggestions([]); return; }
    const timer = setTimeout(() => {
      const matches = TAG_LIBRARY
        .filter(t => t.name.toLowerCase().includes(q))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
      setTagSuggestions(matches);
    }, 150);
    return () => clearTimeout(timer);
  }, [tagSearchInput]);

  // --- Helpers ---
  const emitChange = (overrides: any = {}) => {
    return {
      nsfwMode: overrides.nsfwMode ?? (advancedFilterDraft.nsfwMode === 'nsfw' ? 'nsfw' : advancedFilterDraft.nsfwMode === 'all' ? 'all' : 'safe'),
      selectedPlatform: overrides.selectedPlatform ?? advancedFilterDraft.selectedPlatform,
      yearConstraints: overrides.yearConstraints ?? yearConstraints,
      minRatingCount: overrides.minRatingCount ?? advancedFilterDraft.minRatingCount,
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

  const handleAddTag = (tag: string) => {
    if (selectedTags.includes(tag)) return;
    addTagFilter(tag);
    setTagSearchInput('');
    setTagSuggestions([]);
    setIsSuggestionsOpen(false);
    publishChange({ selectedTags: [...selectedTags, tag] });
  };

  return (
    <div
      className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-100/50 mb-8 overflow-visible"
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
          <div className="grid grid-cols-2 gap-4 mt-2">
            {[
              { label: '最低资源评分', icon: <Star size={16} />, val: minRatingScore, key: 'minRatingScore', step: 0.1 },
              { label: '最低评论数量', icon: <MessageSquare size={16} />, val: minCommentCount, key: 'minCommentCount' }
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
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      if (stat.key === 'minRatingScore') setMinRatingScore(val);
                      if (stat.key === 'minCommentCount') setMinCommentCount(val);
                      publishChange({ [stat.key]: val });
                    }}
                    onKeyDown={e => e.key === 'Enter' && submitFilters()}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Tag Management */}
        <div className="flex flex-col bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-200 p-8 min-h-[320px] relative group">
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-blue-600">
              <Tag size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">标签检索</h3>
              <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">Advanced Tag Selection</p>
            </div>
          </div>

          {/* Search input — full width, outside justify-between to avoid layout conflicts */}
          <div className="relative mb-5">
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl shadow-sm focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
              <Search size={18} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="输入标签名称，如「纯爱」「奇幻」..."
                className="flex-1 bg-transparent border-none outline-none font-bold text-sm text-slate-700 placeholder:text-slate-400"
                value={tagSearchInput}
                data-submit-mode="skip"
                onChange={e => { setTagSearchInput(e.target.value); setIsSuggestionsOpen(true); }}
                onFocus={() => setIsSuggestionsOpen(true)}
                onBlur={() => setTimeout(() => setIsSuggestionsOpen(false), 150)}
              />
              {tagSearchInput && (
                <X size={16} className="text-slate-300 hover:text-slate-500 cursor-pointer shrink-0" onClick={() => { setTagSearchInput(''); setTagSuggestions([]); }} />
              )}
            </div>

            {/* Dropdown — positioned relative to the input wrapper, overflow-visible on parent */}
            {isSuggestionsOpen && tagSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl p-1.5 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
                {tagSuggestions.map(tag => (
                  <div
                    key={tag.name}
                    className="px-4 py-2.5 rounded-xl hover:bg-blue-50 cursor-pointer flex items-center justify-between group/tip"
                    onMouseDown={e => { e.preventDefault(); handleAddTag(tag.name); }}
                  >
                    <span className="font-bold text-slate-700 group-hover/tip:text-blue-700">{tag.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] font-bold text-slate-400 group-hover/tip:text-blue-400">{tag.count.toLocaleString()} 个</span>
                      <Plus size={14} className="text-slate-300 group-hover/tip:text-blue-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected tags */}
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
                      <p className="text-xs font-semibold text-slate-400 mt-1">在上方搜索框输入标签名称...</p>
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
            const { resetAdvancedFilterDraft, clearTags } = useUIStore.getState();
            resetAdvancedFilterDraft();
            clearTags();
            setYearConstraints([]);
            setMinRatingScore(0);
            setMinCommentCount(0);
            publishChange({
              yearConstraints: [],
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
