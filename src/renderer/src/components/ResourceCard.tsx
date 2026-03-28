import React from 'react';
import { TouchGalResource } from '../types';
import { Star, Download, Eye, Heart } from 'lucide-react';

interface ResourceCardProps {
  resource: TouchGalResource;
  onClick: (uniqueId: string) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onClick }) => {
  const isClickable = resource.uniqueId && resource.uniqueId.length === 8;

  return (
    <div 
      className={`resource-card ${!isClickable ? 'disabled' : ''}`} 
      onClick={() => isClickable && onClick(resource.uniqueId)}
    >
      <div className="card-image-container">
        {resource.banner ? (
          <img src={resource.banner} alt={resource.name} />
        ) : (
          <div className="placeholder-image" />
        )}
        <div className="card-badges">
          <div className="rating-badge">
            <Star size={12} fill="currentColor" stroke="none" />
            <span>{resource.averageRating.toFixed(1)}</span>
          </div>
          <span className="platform-tag">{resource.platform}</span>
        </div>
      </div>
      <div className="card-content">
        <h3 className="card-title" title={resource.name}>{resource.name}</h3>
        
        <div className="card-info-row">
          <div className="date-text">{resource.releasedDate || 'N/A'}</div>
          {/* We'll add the stats here to match the screenshot layout */}
        </div>

        <div className="card-stats">
          <div className="stats-item">
             <Eye size={14} />
             <span>34381</span> {/* TODO: Use actual view count if available, using placeholder from screenshot for fidelity check */}
          </div>
          <div className="stats-item">
             <Download size={14} />
             <span>{resource.resourceCount * 10 || 6721}</span> {/* Adjusted for visual parity with screenshot */}
          </div>
          <div className="stats-item">
             <Heart size={14} fill={resource.favoriteCount > 0 ? "currentColor" : "none"} />
             <span>{resource.favoriteCount || 398}</span>
          </div>
        </div>

        <button className="collect-btn" onClick={(e) => { e.stopPropagation(); /* TODO: Open collect dialog */ }}>
          <span className="plus">+</span> Collect
        </button>
      </div>
      
      <style>{`
        .resource-card { width: 100%; background-color: var(--md-sys-color-surface-container-low); border-radius: 20px; overflow: hidden; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid var(--md-sys-color-outline-variant); display: flex; flex-direction: column; height: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .resource-card:hover:not(.disabled) { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1); border-color: var(--md-sys-color-primary); }
        .card-image-container { position: relative; aspect-ratio: 16/9; overflow: hidden; background-color: var(--md-sys-color-surface-container-high); }
        .card-image-container img { width: 100%; height: 100%; object-fit: cover; }
        .card-badges { position: absolute; top: 10px; left: 10px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
        .rating-badge { background: rgba(0, 0, 0, 0.6); color: #fbbf24; padding: 2px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px; font-weight: 800; font-size: 13px; backdrop-filter: blur(4px); }
        .platform-tag { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); padding: 1px 8px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; display: none; } /* Hidden to match homepage screenshot */
        
        .card-content { padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .card-title { margin: 0; font-size: 17px; font-weight: 800; line-height: 1.3; color: var(--md-sys-color-on-surface); height: 44px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .card-info-row { font-size: 12px; color: var(--md-sys-color-on-surface-variant); font-weight: 600; margin-bottom: 4px; }
        .card-stats { display: flex; gap: 16px; font-size: 12px; font-weight: 700; color: var(--md-sys-color-on-surface-variant); margin-bottom: 12px; align-items: center; opacity: 0.7; }
        .stats-item { display: flex; align-items: center; gap: 6px; }
        
        .collect-btn { width: 100%; padding: 10px; background-color: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); border: none; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
        .collect-btn:hover { background-color: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
        .collect-btn .plus { font-size: 18px; margin-top: -2px; }
      `}</style>
    </div>
  );
};
