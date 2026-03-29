import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SortOption {
  label: string;
  value: string;
}

interface SortDropdownProps {
  value: string;
  options: SortOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({ value, options, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative group" ref={containerRef}>
      <button 
        className="flex items-center gap-2 px-4 rounded-full border-none h-11 bg-slate-100 cursor-pointer transition-all font-bold text-slate-500 min-w-[140px] justify-between text-[13.5px] hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed group"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown size={16} className={`transition-transform duration-300 text-slate-400 group-hover:text-slate-600 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 z-[1000] min-w-[180px] bg-white rounded-2xl shadow-2xl border border-slate-100 p-1.5 animate-in slide-in-from-top-2 fade-in duration-300">
          {options.map((option) => (
            <div 
              key={option.value}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-sm font-bold transition-all ${
                option.value === value 
                  ? 'bg-slate-100 text-slate-900 font-black' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={16} className="text-primary" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
