import React from 'react';
import { TouchGalResource } from '../types';
import { Star, Download, Eye, Heart, MessageSquare } from 'lucide-react';

interface ResourceCardProps {
  resource: TouchGalResource;
  onClick: (uniqueId: string) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onClick }) => {
  const isClickable = resource.uniqueId && resource.uniqueId.length === 8;

  // Format large numbers with defensive checks
  const formatStat = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'm';
    if (num >= 1000) {
      // For large numbers (>10k), remove decimals to save critical space
      const val = num / 1000;
      return (val >= 10 ? val.toFixed(0) : val.toFixed(1).replace('.0', '')) + 'k';
    }
    return num.toString();
  };

  return (
    <div 
      className={`resource-card-m3 ${!isClickable ? 'disabled' : ''}`} 
      onClick={() => isClickable && onClick(resource.uniqueId)}
    >
      <div className="card-media">
        {resource.banner ? (
          <img src={resource.banner} alt={resource.name} loading="lazy" />
        ) : (
          <div className="media-placeholder" />
        )}
        <div className="card-scrim-top">
          <div className="badge-rating">
            <Star size={12} fill="currentColor" stroke="none" />
            <span>{(resource.averageRating || 0).toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="card-body">
        <h3 className="title-medium" title={resource.name}>{resource.name}</h3>
        
        <div className="body-small release-date">{resource.releasedDate || '未知时间'}</div>

        <div className="card-stats-row">
          <div className="stat-pill" title="浏览数">
             <Eye size={12} />
             <span>{formatStat(resource.viewCount || (resource as any).view || 0)}</span>
          </div>
          <div className="stat-pill" title="下载数">
             <Download size={12} />
             <span>{formatStat(resource.downloadCount || (resource as any).download || 0)}</span>
          </div>
          <div className="stat-pill" title="收藏数">
             <Heart size={12} fill={resource.favoriteCount > 0 ? "currentColor" : "none"} />
             <span>{formatStat(resource.favoriteCount)}</span>
          </div>
          <div className="stat-pill" title="评论数">
             <MessageSquare size={12} />
             <span>{resource.commentCount}</span>
          </div>
        </div>

        <div className="card-actions">
           <button className="btn-tonal" onClick={(e) => { e.stopPropagation(); }}>
             <span>立即收藏</span>
           </button>
        </div>
      </div>

      <style>{`
        .resource-card-m3 {
          width: 100%;
          background-color: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          cursor: pointer;
          transition: all 400ms cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          height: 100%;
          position: relative;
        }

        .resource-card-m3:hover:not(.disabled) {
          transform: translateY(-6px);
          box-shadow: 0 12px 30px -8px rgba(0, 0, 0, 0.12);
          border-color: #0369a1;
        }

        .card-media {
          position: relative;
          aspect-ratio: 1.618 / 1; /* Golden ratio fallback */
          overflow: hidden;
          background-color: #f1f5f9;
        }

        .card-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .resource-card-m3:hover img {
          transform: scale(1.05);
        }

        .card-scrim-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 12px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%);
          display: flex;
          justify-content: flex-end;
        }

        .badge-rating {
          background: rgba(255, 255, 255, 0.9);
          color: #b45309;
          padding: 2px 10px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 800;
          font-size: 13px;
          backdrop-filter: blur(8px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .card-body {
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .title-medium {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          line-height: 1.4;
          color: #0f172a;
          height: 44px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          letter-spacing: -0.01em;
        }

        .release-date {
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .card-stats-row {
          display: flex;
          flex-wrap: nowrap;
          justify-content: space-between;
          gap: 4px;
          margin-bottom: 16px;
          width: 100%;
        }

        .stat-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          background: #f8fafc;
          padding: 4px 6px;
          border-radius: 8px;
          transition: all 0.2s;
          flex: 1;
          justify-content: center;
          min-width: fit-content;
          white-space: nowrap;
        }

        .stat-pill span {
          display: inline-block;
        }

        .resource-card-m3:hover .stat-pill {
          color: #334155;
        }

        .card-actions {
          margin-top: auto;
        }

        .btn-tonal {
          width: 100%;
          padding: 10px;
          background-color: #f1f5f9;
          color: #0369a1;
          border: none;
          border-radius: 16px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-tonal:hover {
          background-color: #0369a1;
          color: #ffffff;
        }

        .disabled {
          opacity: 0.6;
          cursor: not-allowed;
          filter: grayscale(1);
        }
      `}</style>
    </div>
  );
};
