import React from 'react';
import { TouchGalResource } from '../types';
import { Star, Download, MessageSquare, Calendar, Heart } from 'lucide-react';

interface ResourceCardProps {
  resource: TouchGalResource;
  onClick: (uniqueId: string) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onClick }) => {
  return (
    <div className="resource-card" onClick={() => onClick(resource.uniqueId)}>
      <div className="card-image-container">
        {resource.banner ? (
          <img src={resource.banner} alt={resource.name} />
        ) : (
          <div className="placeholder-image" />
        )}
        <div className="card-overlay">
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

        <div className="card-meta">
          <div className="rating">
            <Star size={14} fill="currentColor" stroke="none" />
            <span>{resource.averageRating.toFixed(1)}</span>
          </div>
          <div className="stats">
            <Download size={14} />
            <span>{resource.resourceCount}</span>
            <MessageSquare size={14} />
            <span>{resource.commentCount}</span>
          </div>
        </div>
        <div className="tags-container">
          {resource.tags?.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="tag">{tag}</span>
          ))}
        </div>
      </div>
      
      <style>{`
        .resource-card { width: 100%; background-color: var(--md-sys-color-surface); border-radius: var(--radius-lg); overflow: hidden; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid var(--md-sys-color-surface-variant); }
        .resource-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1); border-color: var(--md-sys-color-primary); }
        .card-image-container { position: relative; aspect-ratio: 16/9; overflow: hidden; background-color: var(--md-sys-color-surface-variant); }
        .card-image-container img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
        .card-info-row { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; margin-bottom: 8px; font-size: 11px; color: var(--md-sys-color-on-surface-variant); opacity: 0.8; }
        .info-item { display: flex; align-items: center; gap: 4px; }
        .info-item.favorite { color: #f43f5e; opacity: 1; font-weight: 500; }
        .card-title { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.4; height: 42px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .card-meta { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
        .rating { display: flex; align-items: center; gap: 4px; color: #f59e0b; }
        .stats { display: flex; align-items: center; gap: 8px; }
        .tags-container { display: flex; flex-wrap: wrap; gap: 4px; }
        .tag { padding: 2px 6px; background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); border-radius: var(--radius-xs); font-size: 10px; font-weight: 500; }
      `}</style>
    </div>
  );
};
