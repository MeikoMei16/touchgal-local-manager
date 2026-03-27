import React, { useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { X, Download, Star, Globe, MessageCircle, Monitor, Eye, HardDrive, ShieldCheck } from 'lucide-react';

const ImageViewer: React.FC<{ url: string; onDismiss: () => void }> = ({ url, onDismiss }) => (
  <div className="image-viewer-overlay" onClick={onDismiss}>
    <div className="image-viewer-content" onClick={e => e.stopPropagation()}>
      <img src={url} alt="Screenshot Full" />
      <button className="viewer-close" onClick={onDismiss}><X size={24} /></button>
    </div>
  </div>
);

export const DetailOverlay: React.FC = () => {
  const { selectedResource, clearSelected } = useTouchGalStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!selectedResource) return null;

  const { ratingSummary } = selectedResource;

  return (
    <div className="detail-overlay" onClick={clearSelected}>
      <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button className="close-btn" onClick={clearSelected}><X size={24} /></button>
        </div>
        
        <div className="sheet-scroll-area">
          {/* Hero Section */}
          <div className="hero-section">
            <div className="hero-banner">
              {selectedResource.banner && <img src={selectedResource.banner} alt={selectedResource.name} />}
              <div className="hero-rating-badge">
                <Star size={14} fill="currentColor" />
                <span>{selectedResource.averageRating.toFixed(1)}</span>
              </div>
              <div className="hero-gradient" />
            </div>
            <div className="hero-content">
              <h1>{selectedResource.name}</h1>
              <button className="collect-btn">
                <MessageCircle size={18} />
                <span>Collect / 收藏到...</span>
              </button>
            </div>
          </div>

          <div className="detail-main-content">
            {/* Screenshots Gallery */}
            {selectedResource.screenshots && selectedResource.screenshots.length > 0 && (
              <section className="detail-section">
                <h2 className="section-title">Screenshots / 游戏截图</h2>
                <div className="horizontal-gallery">
                  {selectedResource.screenshots.map((url, i) => (
                    <div key={i} className="gallery-item" onClick={() => setSelectedImage(url)}>
                      <img src={url} alt={`Screenshot ${i}`} loading="lazy" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* PV Player */}
            {selectedResource.pvUrl && (
              <section className="detail-section">
                <h2 className="section-title">Promotion Video / PV鉴赏</h2>
                <div className="pv-container">
                   <video controls src={selectedResource.pvUrl} poster={selectedResource.banner || ''}>
                      Your browser does not support the video tag.
                   </video>
                </div>
              </section>
            )}

            {/* Action Buttons */}
            <div className="action-row">
              <button className="outline-btn wide">
                <Globe size={18} />
                <span>Official Website / 官网链接</span>
              </button>
            </div>

            {/* Description */}
            <section className="detail-section">
              <h2 className="section-title">Description / 游戏介绍</h2>
              <div 
                className="introduction-html" 
                dangerouslySetInnerHTML={{ __html: selectedResource.introduction || "No introduction available." }} 
              />
            </section>

            {/* Stats Section */}
            {ratingSummary && (
              <section className="detail-section stats-card">
                <h2 className="section-title">Rating Stats / 评分统计</h2>
                <div className="stats-header-grid">
                  <div className="stats-box highlight">
                    <div className="stats-value">{ratingSummary.average.toFixed(1)}</div>
                    <div className="stats-label">综合评分</div>
                  </div>
                  <div className="stats-box">
                    <div className="stats-value">{ratingSummary.count}</div>
                    <div className="stats-label">评价人数</div>
                  </div>
                </div>
                
                <div className="stats-chips">
                  <div className="stat-chip">收藏 {selectedResource.favoriteCount}</div>
                  <div className="stat-chip">满分 10 分</div>
                </div>

                {/* Recommend Trend */}
                <div className="recommend-trend">
                  <div className="trend-label">推荐倾向</div>
                  <div className="trend-bar">
                    {Object.entries(ratingSummary.recommend).map(([key, val]) => {
                      const colors = { strong_yes: '#10b981', yes: '#34d399', neutral: '#94a3b8', no: '#fbbf24', strong_no: '#ef4444' };
                      const color = (colors as any)[key] || '#ccc';
                      const percentage = (val / ratingSummary.count) * 100;
                      return percentage > 0 ? (
                        <div key={key} className="trend-segment" style={{ width: `${percentage}%`, backgroundColor: color }} title={`${key}: ${val}`} />
                      ) : null;
                    })}
                  </div>
                  <div className="trend-legend">
                    {Object.entries(ratingSummary.recommend).map(([key, val]) => (
                      <div key={key} className="legend-item">
                        <span className="dot" style={{ backgroundColor: (({ strong_yes: '#10b981', yes: '#34d399', neutral: '#94a3b8', no: '#fbbf24', strong_no: '#ef4444' } as any)[key]) }} />
                        <span>{key.replace('_', ' ')} {val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Histogram */}
                <div className="score-histogram">
                  <div className="trend-label">分数分布</div>
                  <div className="histogram-bars">
                    {ratingSummary.histogram.map((h) => {
                      const max = Math.max(...ratingSummary.histogram.map(i => i.count), 1);
                      const height = (h.count / max) * 100;
                      return (
                        <div key={h.score} className="hist-col">
                          <div className="hist-val">{h.count}</div>
                          <div className="hist-bar-container">
                             <div className="hist-bar" style={{ height: `${height}%` }} />
                          </div>
                          <div className="hist-label">{h.score}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Metadata Grid */}
            <section className="detail-section">
              <div className="metadata-grid">
                <div className="meta-item"><span className="meta-label">Company / 所属会社</span><span className="meta-value">{selectedResource.company || 'Unknown'}</span></div>
                <div className="meta-item"><span className="meta-label">Released / 发售时间</span><span className="meta-value">{selectedResource.releasedDate || 'Unknown'}</span></div>
                {selectedResource.vndbId && <div className="meta-item"><span className="meta-label">VNDB ID</span><span className="meta-value">{selectedResource.vndbId}</span></div>}
                {selectedResource.bangumiId && <div className="meta-item"><span className="meta-label">Bangumi</span><span className="meta-value">{selectedResource.bangumiId}</span></div>}
                {selectedResource.steamId && <div className="meta-item"><span className="meta-label">Steam ID</span><span className="meta-value">{selectedResource.steamId}</span></div>}
                {selectedResource.contentLimit && <div className="meta-item"><span className="meta-label">Content Limit</span><span className="meta-value">{selectedResource.contentLimit}</span></div>}
              </div>
            </section>

            {/* Tags */}
            <section className="detail-section">
              <h2 className="section-title">Tags / 游戏标签</h2>
              <div className="tags-flex">
                {selectedResource.tags?.map((tag) => (
                  <span key={tag} className="tag-pill">{tag}</span>
                ))}
              </div>
            </section>

            {/* Downloads */}
            <section className="detail-section">
              <h2 className="section-title">Downloads / 资源下载</h2>
              <div className="downloads-container">
                {selectedResource.downloads && selectedResource.downloads.length > 0 ? (
                  selectedResource.downloads.map((dl) => (
                    <div key={dl.id} className="download-card">
                      <div className="dl-card-header">
                        <Monitor size={16} className="dl-icon" />
                        <span className="dl-card-title">{dl.name}</span>
                      </div>
                      <div className="dl-card-meta">
                        <span><HardDrive size={12} style={{ display: 'inline', marginRight: '4px' }} />Size: {dl.size || 'Unknown'}</span>
                        <span><ShieldCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />Platform: {dl.platform.join(', ')}</span>
                      </div>
                      <div className="dl-card-codes">
                        {dl.code && <div className="code-badge">Code: {dl.code}</div>}
                        {dl.password && <div className="code-badge">Password: {dl.password}</div>}
                      </div>
                      <button className="download-action-btn" onClick={() => dl.url && window.open(dl.url, '_blank')}>
                        <Download size={18} />
                        Download Link
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No download resources found.</div>
                )}
              </div>
            </section>

            {/* Footer Stats */}
            <div className="detail-footer-stats">
              <div className="footer-stat-item"><Eye size={14} /> <span>{selectedResource.resourceCount} Views</span></div>
              <div className="footer-stat-item"><Download size={14} /> <span>{selectedResource.favoriteCount} Downloads</span></div>
            </div>
          </div>
        </div>
      </div>

      {selectedImage && <ImageViewer url={selectedImage} onDismiss={() => setSelectedImage(null)} />}

      <style>{`
        .detail-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.3s ease; }
        .detail-sheet { background: var(--md-sys-color-surface-container-lowest); width: 100%; max-width: 640px; height: 92vh; border-radius: 32px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 32px 64px rgba(0, 0, 0, 0.5); position: relative; animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255, 255, 255, 0.1); }
        .close-btn { position: absolute; top: 16px; left: 16px; width: 44px; height: 44px; border-radius: 22px; background: rgba(0, 0, 0, 0.4); color: white; border: none; z-index: 10; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: all 0.2s; }
        .close-btn:hover { background: rgba(0, 0, 0, 0.6); transform: scale(1.05); }
        
        .sheet-scroll-area { flex: 1; overflow-y: auto; scrollbar-width: none; }
        .sheet-scroll-area::-webkit-scrollbar { display: none; }
        
        .hero-section { position: relative; width: 100%; aspect-ratio: 16/9; }
        .hero-banner { width: 100%; height: 100%; position: relative; }
        .hero-banner img { width: 100%; height: 100%; object-fit: cover; }
        .hero-rating-badge { position: absolute; top: 16px; right: 16px; background: rgba(0, 0, 0, 0.7); color: #fbbf24; padding: 6px 14px; border-radius: 12px; display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 16px; backdrop-filter: blur(12px); border: 1px solid rgba(251, 191, 36, 0.3); }
        .hero-gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, var(--md-sys-color-surface-container-lowest)); }
        .hero-content { position: absolute; bottom: 0; left: 0; right: 0; padding: 32px; background: linear-gradient(to top, var(--md-sys-color-surface-container-lowest), transparent); }
        .hero-content h1 { margin: 0; font-size: 28px; color: var(--md-sys-color-on-surface); font-weight: 900; line-height: 1.2; text-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); }
        
        .collect-btn { margin-top: 20px; width: 100%; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); border: none; padding: 14px; border-radius: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s; box-shadow: 0 8px 16px rgba(var(--md-sys-color-primary-rgb), 0.3); }
        .collect-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(var(--md-sys-color-primary-rgb), 0.4); filter: brightness(1.1); }
        
        .detail-main-content { padding: 0 32px 48px 32px; display: flex; flex-direction: column; gap: 32px; }
        
        .horizontal-gallery { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory; scrollbar-width: none; }
        .horizontal-gallery::-webkit-scrollbar { display: none; }
        .gallery-item { flex: 0 0 280px; height: 160px; border-radius: 16px; overflow: hidden; scroll-snap-align: start; cursor: zoom-in; border: 2px solid transparent; transition: all 0.2s; }
        .gallery-item:hover { border-color: var(--md-sys-color-primary); }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; }
        
        .pv-container { width: 100%; aspect-ratio: 16/9; border-radius: 20px; overflow: hidden; background: #000; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); }
        .pv-container video { width: 100%; height: 100%; }
        
        .action-row { width: 100%; }
        .outline-btn { width: 100%; background: transparent; border: 2px solid var(--md-sys-color-outline-variant); color: var(--md-sys-color-primary); padding: 12px; border-radius: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .outline-btn:hover { background: var(--md-sys-color-primary-container); border-color: var(--md-sys-color-primary); }
        
        .section-title { font-size: 18px; font-weight: 800; margin: 0 0 16px 0; color: var(--md-sys-color-on-surface); display: flex; align-items: center; gap: 8px; }
        .introduction-html { font-size: 15px; line-height: 1.8; color: var(--md-sys-color-on-surface-variant); }
        .introduction-html h2 { font-size: 18px; color: var(--md-sys-color-on-surface); margin: 24px 0 12px 0; }
        .introduction-html p { margin-bottom: 16px; }
        
        .stats-card { background: var(--md-sys-color-surface-container); border-radius: 24px; padding: 24px; border: 1px solid var(--md-sys-color-outline-variant); }
        .stats-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .stats-box { padding: 20px; border-radius: 20px; background: var(--md-sys-color-surface-container-highest); text-align: center; }
        .stats-box.highlight { background: var(--md-sys-color-primary-container); }
        .stats-box.highlight .stats-value { color: var(--md-sys-color-on-primary-container); }
        .stats-value { font-size: 32px; font-weight: 900; color: var(--md-sys-color-on-surface); }
        .stats-label { font-size: 12px; color: var(--md-sys-color-on-surface-variant); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
        .stats-chips { display: flex; gap: 10px; margin-bottom: 24px; }
        .stat-chip { padding: 6px 14px; background: var(--md-sys-color-surface-container-high); border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--md-sys-color-on-surface-variant); }
        
        .recommend-trend { margin-bottom: 28px; }
        .trend-label { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--md-sys-color-on-surface); }
        .trend-bar { height: 16px; width: 100%; background: var(--md-sys-color-surface-container-highest); border-radius: 8px; display: flex; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
        .trend-segment { height: 100%; transition: width 0.3s ease; }
        .trend-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--md-sys-color-on-surface-variant); }
        .legend-item .dot { width: 8px; height: 8px; border-radius: 4px; }
        
        .score-histogram { margin-top: 12px; }
        .histogram-bars { display: flex; align-items: flex-end; justify-content: space-between; height: 120px; gap: 4px; padding-top: 20px; }
        .hist-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .hist-val { font-size: 10px; font-weight: 700; color: var(--md-sys-color-primary); }
        .hist-bar-container { width: 100%; flex: 1; display: flex; align-items: flex-end; justify-content: center; }
        .hist-bar { width: 80%; background: var(--md-sys-color-primary-container); border-radius: 4px 4px 2px 2px; min-height: 2px; transition: height 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .hist-col:hover .hist-bar { background: var(--md-sys-color-primary); }
        .hist-label { font-size: 10px; font-weight: 600; color: var(--md-sys-color-on-surface-variant); }
        
        .metadata-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .meta-item { display: flex; justify-content: space-between; font-size: 14px; padding-bottom: 8px; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
        .meta-label { color: var(--md-sys-color-on-surface-variant); font-weight: 500; }
        .meta-value { font-weight: 700; color: var(--md-sys-color-on-surface); text-align: right; }
        
        .tags-flex { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag-pill { background: var(--md-sys-color-surface-container-highest); padding: 6px 14px; border-radius: 12px; font-size: 13px; color: var(--md-sys-color-primary); font-weight: 600; border: 1px solid var(--md-sys-color-outline-variant); transition: all 0.2s; cursor: default; }
        .tag-pill:hover { background: var(--md-sys-color-primary-container); }
        
        .download-card { background: var(--md-sys-color-surface-container-high); border-radius: 24px; padding: 24px; margin-bottom: 16px; border: 1px solid var(--md-sys-color-outline-variant); transition: all 0.2s; }
        .download-card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1); border-color: var(--md-sys-color-primary); }
        .dl-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .dl-icon { color: var(--md-sys-color-primary); }
        .dl-card-title { font-weight: 800; font-size: 16px; color: var(--md-sys-color-on-surface); }
        .dl-card-meta { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px; }
        .dl-card-codes { display: flex; gap: 10px; margin-bottom: 16px; }
        .code-badge { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; }
        .download-action-btn { width: 100%; background: var(--md-sys-color-on-surface); color: var(--md-sys-color-surface); border: none; padding: 12px; border-radius: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: all 0.2s; }
        .download-action-btn:hover { opacity: 0.9; transform: scale(0.98); }
        
        .detail-footer-stats { display: flex; justify-content: center; gap: 32px; padding: 24px; opacity: 0.5; font-size: 13px; font-weight: 600; }
        .footer-stat-item { display: flex; align-items: center; gap: 6px; }
        
        /* Image Viewer Overlay */
        .image-viewer-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.95); z-index: 2000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease; cursor: zoom-out; }
        .image-viewer-content { position: relative; max-width: 90vw; max-height: 90vh; }
        .image-viewer-content img { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; }
        .viewer-close { position: absolute; top: -48px; right: 0; background: white; border: none; width: 40px; height: 40px; border-radius: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};
