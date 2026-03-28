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
    <div className="custom-sort-container" ref={containerRef}>
      <button 
        className="sort-trigger-pill"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="current-label">{selectedOption.label}</span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="sort-popover">
          {options.map((option) => (
            <div 
              key={option.value}
              className={`sort-option-item ${option.value === value ? 'active' : ''}`}
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={16} />}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .custom-sort-container { position: relative; }
        .sort-trigger-pill { 
          display: flex; align-items: center; gap: 8px; 
          padding: 0 16px; border-radius: 40px; border: none; 
          height: 44px; background: #f1f5f9; cursor: pointer; transition: all 0.2s;
          font-weight: 700; color: #475569; min-width: 130px; justify-content: space-between;
          font-size: 13.5px;
        }
        .sort-trigger-pill:hover:not(:disabled) { background: #e2e8f0; }
        .sort-trigger-pill:disabled { opacity: 0.6; cursor: not-allowed; }
        .chevron { transition: transform 0.2s; color: #64748b; }
        .chevron.open { transform: rotate(180deg); }

        .sort-popover { 
          position: absolute; top: calc(100% + 8px); left: 0; z-index: 1000; 
          min-width: 180px; background: white; border-radius: 16px; 
          box-shadow: 0 12px 32px rgba(0,0,0,0.12); border: 1px solid #f1f5f9; 
          padding: 6px; animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes popIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .sort-option-item { 
          display: flex; align-items: center; justify-content: space-between; 
          padding: 10px 14px; border-radius: 10px; cursor: pointer; 
          font-size: 14px; font-weight: 600; color: #475569; transition: all 0.15s;
        }
        .sort-option-item:hover { background: #f1f5f9; color: #1e293b; }
        .sort-option-item.active { background: #f1f5f9; color: #1e293b; font-weight: 700; }
      `}</style>
    </div>
  );
};
