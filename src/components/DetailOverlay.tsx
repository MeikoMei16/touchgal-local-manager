import React from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { X, Download, Star, Calendar, Globe } from 'lucide-react';

export const DetailOverlay: React.FC = () => {
  const { selectedResource, clearSelected } = useTouchGalStore();

  if (!selectedResource) return null;

  return (
    <div className="detail-overlay" onClick={clearSelected}>
      <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button className="close-btn" onClick={clearSelected}><X size={24} /></button>
        </div>
        
        <div className="sheet-scroll-area">
          <div className="hero-section">
            <div className="hero-banner">
              {selectedResource.banner && <img src={selectedResource.banner} alt={selectedResource.name} />}
              <div className="hero-gradient" />
            </div>
            <div className="hero-content">
              <h1>{selectedResource.name}</h1>
              <div className="hero-meta">
                <div className="rating-badge"><Star size={18} fill="currentColor" stroke="none" /><span>{selectedResource.averageRating.toFixed(1)}</span></div>
                <span>•</span><span>{selectedResource.platform}</span><span>•</span><span>{selectedResource.language}</span>
              </div>
            </div>
          </div>

          <div className="content-grid">
            <div className="main-info">
              <section><h2>Introduction</h2><div className="introduction-text">{selectedResource.introduction || "No introduction available."}</div></section>
              <section><h2>Downloads</h2><div className="downloads-list">
                {selectedResource.downloads && selectedResource.downloads.length > 0 ? (
                  selectedResource.downloads.map((dl: any) => (
                    <div key={dl.id} className="download-item">
                      <div className="dl-info"><span className="dl-name">{dl.name}</span><span className="dl-size">{dl.size || 'Unknown size'}</span></div>
                      <button className="dl-btn"><Download size={18} />Download</button>
                    </div>
                  ))
                ) : (<p className="empty-msg">No download resources found.</p>)}
              </div></section>
            </div>
            <div className="side-info">
              <div className="info-card"><h3>Metadata</h3><div className="info-row"><Globe size={16} /><span>{selectedResource.company || 'Unknown Publisher'}</span></div><div className="info-row"><Calendar size={16} /><span>{selectedResource.releasedDate || 'Unknown Date'}</span></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
