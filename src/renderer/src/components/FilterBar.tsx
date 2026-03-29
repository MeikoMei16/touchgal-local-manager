import React from 'react';
import { ChevronDown, Calendar, Star, MessageSquare, Users, Laptop } from 'lucide-react';

interface FilterBarProps {
  onFilterChange: (filters: any) => void;
  isLoading?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({ onFilterChange, isLoading }) => {
  const [filters, setFilters] = React.useState({
    selectedPlatform: 'all',
    yearOperator: '>=',
    yearValue: '2020',
    minRatingCount: 10,
    minRatingScore: 0,
    minCommentCount: 0
  });

  const platforms = [
    { label: '全部平台', value: 'all' },
    { label: 'Windows', value: 'windows' },
    { label: 'Android', value: 'android' },
    { label: 'MacOS', value: 'macos' },
    { label: 'iOS', value: 'ios' },
    { label: 'Linux', value: 'linux' }
  ];

  const operators = [
    { label: '等于 (=)', value: '=' },
    { label: '晚于 (>=)', value: '>=' },
    { label: '早于 (<=)', value: '<=' },
    { label: '严格晚于 (>)', value: '>' },
    { label: '严格早于 (<)', value: '<' }
  ];

  const handleChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="advanced-filter-pane-modern">
      <div className="filter-row-top">
         {/* Platform */}
         <div className="filter-pill-box">
          <div className="pill-icon"><Laptop size={16} /></div>
          <span className="pill-label">平台</span>
          <select value={filters.selectedPlatform} onChange={(e) => handleChange('selectedPlatform', e.target.value)} disabled={isLoading}>
             {platforms.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <ChevronDown size={14} className="pill-arrow" />
        </div>

        {/* Year Comparison */}
        <div className="filter-pill-box year-box">
          <div className="pill-icon"><Calendar size={16} /></div>
          <span className="pill-label">发售年份</span>
          <div className="pill-input-group">
            <select value={filters.yearOperator} onChange={(e) => handleChange('yearOperator', e.target.value)} disabled={isLoading}>
               {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input 
              type="number" 
              className="year-input" 
              value={filters.yearValue} 
              onChange={(e) => handleChange('yearValue', e.target.value)} 
              disabled={isLoading}
              min="1980"
              max="2030"
              placeholder="2024"
            />
          </div>
        </div>
      </div>

      <div className="filter-row-bottom">
        {/* Rating Count */}
        <div className="filter-pill-box">
          <div className="pill-icon"><Users size={16} /></div>
          <span className="pill-label">评分人数 ≥</span>
          <input 
            type="number" 
            value={filters.minRatingCount} 
            onChange={(e) => handleChange('minRatingCount', parseInt(e.target.value) || 0)} 
            disabled={isLoading}
            placeholder="10"
          />
        </div>

        {/* Rating Score */}
        <div className="filter-pill-box">
          <div className="pill-icon"><Star size={16} /></div>
          <span className="pill-label">最低评分 ≥</span>
          <input 
            type="number" 
            step="0.1"
            min="0"
            max="10"
            value={filters.minRatingScore} 
            onChange={(e) => handleChange('minRatingScore', parseFloat(e.target.value) || 0)} 
            disabled={isLoading}
            placeholder="0.0"
          />
        </div>

        {/* Comment Count */}
        <div className="filter-pill-box">
          <div className="pill-icon"><MessageSquare size={16} /></div>
          <span className="pill-label">最低评论 ≥</span>
          <input 
            type="number" 
            value={filters.minCommentCount} 
            onChange={(e) => handleChange('minCommentCount', parseInt(e.target.value) || 0)} 
            disabled={isLoading}
            placeholder="0"
          />
        </div>
      </div>

      <style>{`
        .advanced-filter-pane-modern {
          background: #ffffff;
          padding: 24px;
          border-radius: 32px;
          border: 1.5px solid #e2e8f0;
          margin-bottom: 24px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .filter-row-top, .filter-row-bottom {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .filter-pill-box {
          flex: 1;
          min-width: 180px;
          position: relative;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 20px;
          height: 52px;
          display: flex;
          align-items: center;
          padding: 0 16px 0 12px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .filter-pill-box:focus-within {
          border-color: #0369a1;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(3, 105, 161, 0.1);
        }

        .pill-icon {
          color: #64748b;
          margin-right: 10px;
          display: flex;
          align-items: center;
        }

        .pill-label {
          position: absolute;
          top: -9px;
          left: 14px;
          background: #fff;
          padding: 0 6px;
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          pointer-events: none;
        }

        .filter-pill-box select, .filter-pill-box input {
          width: 100%;
          border: none;
          background: transparent;
          outline: none;
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          appearance: none;
          cursor: pointer;
        }

        .pill-input-group {
          display: flex;
          align-items: center;
          width: 100%;
          gap: 8px;
        }

        .pill-input-group select {
          flex: 0 0 90px;
          color: #0369a1;
        }

        .year-input {
          flex: 1;
          border-left: 1px solid #e2e8f0 !important;
          padding-left: 12px !important;
        }

        .year-box {
          flex: 1.5;
        }

        .pill-arrow {
          position: absolute;
          right: 14px;
          pointer-events: none;
          color: #94a3b8;
        }

        input::-webkit-inner-spin-button {
          display: none;
        }

        @media (max-width: 768px) {
          .filter-pill-box { min-width: 100%; }
        }
      `}</style>
    </div>
  );
};
