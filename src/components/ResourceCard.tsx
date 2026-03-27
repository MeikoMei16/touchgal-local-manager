import React from 'react';
import { TouchGalResource } from '../types';
import { Star, Download, MessageSquare, Calendar, Heart } from 'lucide-react';

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
          {resource.releasedDate && (
            <div className="info-item">
              <Calendar size={12} />
              <span>{resource.releasedDate}</span>
            </div>
          )}
          <div className="info-item favorite">
            <Heart size={12} fill={resource.favoriteCount > 0 ? "currentColor" : "none"} />
            <span>{resource.favoriteCount}</span>
          </div>
        </div>

        <div className="card-stats">
          <div className="stats-item">
             <Download size={14} />
             <span>{resource.resourceCount}</span>
          </div>
          <div className="stats-item">
             <MessageSquare size={14} />
             <span>{resource.commentCount}</span>
          </div>
        </div>
        <div className="tags-container">
          {resource.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      </div>
      
      <style>{`
        .resource-card { width: 100%; background-color: var(--md-sys-color-surface-container-low); border-radius: 24px; overflow: hidden; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1.5px solid var(--md-sys-color-outline-variant); display: flex; flex-direction: column; height: 100%; }
        .resource-card.disabled { cursor: not-allowed; opacity: 0.6; filter: grayscale(0.8); }
        .resource-card:hover:not(.disabled) { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15); border-color: var(--md-sys-color-primary); }
        .card-image-container { position: relative; aspect-ratio: 16/9; overflow: hidden; background-color: var(--md-sys-color-surface-container-high); }
        .card-image-container img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
        .resource-card:hover img { transform: scale(1.05); }
        .card-badges { position: absolute; inset: 0; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.3) 100%); }
        .rating-badge { background: rgba(0, 0, 0, 0.7); color: #fbbf24; padding: 4px 10px; border-radius: 8px; display: flex; align-items: center; gap: 4px; font-weight: 800; font-size: 13px; backdrop-filter: blur(8px); border: 1px solid rgba(251, 191, 36, 0.3); }
        .platform-tag { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); padding: 2px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .card-content { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 12px; }
        .card-title { margin: 0; font-size: 16px; font-weight: 800; line-height: 1.4; color: var(--md-sys-color-on-surface); height: 44px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .card-info-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--md-sys-color-on-surface-variant); font-weight: 600; }
        .info-item { display: flex; align-items: center; gap: 4px; }
        .info-item.favorite { color: #f43f5e; }
        .card-stats { display: flex; gap: 12px; font-size: 12px; font-weight: 700; color: var(--md-sys-color-on-surface-variant); border-top: 1px solid var(--md-sys-color-outline-variant); padding-top: 12px; margin-top: auto; }
        .stats-item { display: flex; align-items: center; gap: 4px; }
        .tags-container { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag { padding: 4px 8px; background-color: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-primary); border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid var(--md-sys-color-outline-variant); }
      `}</style>
    </div>
  );
};
