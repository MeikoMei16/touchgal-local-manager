import React, { useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { X, Globe, Bookmark } from 'lucide-react';
import { BlurredSection } from './BlurredSection';

const ImageViewer: React.FC<{ url: string; onDismiss: () => void }> = ({ url, onDismiss }) => (
  <div className="image-viewer-overlay" onClick={onDismiss}>
    <div className="image-viewer-content" onClick={e => e.stopPropagation()}>
      <img src={url} alt="Screenshot Full" />
      <button className="viewer-close" onClick={onDismiss}><X size={24} /></button>
    </div>
  </div>
);

export const DetailOverlay: React.FC = () => {
  const { selectedResource, clearSelected, user, addTagFilter } = useTouchGalStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!selectedResource) return null;

  const { ratingSummary } = selectedResource;
  const isLoggedIn = !!user;

  const handleTagClick = (tag: string) => {
    addTagFilter(tag);
    clearSelected();
  };

  return (
    <div className="detail-overlay" onClick={clearSelected}>
      <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button className="close-btn" onClick={clearSelected}><X size={24} /></button>
        </div>
        
        <div className="sheet-scroll-area">
          {/* Top Info Section */}
          <div className="top-banner-section">
             {selectedResource.banner && <img src={selectedResource.banner} alt={selectedResource.name} className="main-banner" />}
             <div className="banner-overlay">
                <div className="overlay-rating">⭐ {selectedResource.averageRating.toFixed(1)}</div>
             </div>
          </div>

          <div className="sheet-padding-content">
            <h1 className="detail-title">{selectedResource.name}</h1>
            
            <button className="collect-main-btn">
              <Bookmark size={20} fill="currentColor" />
              <span>Collect / 收藏到...</span>
            </button>

            {/* Screenshots */}
            {selectedResource.screenshots && selectedResource.screenshots.length > 0 && (
              <section className="detail-section">
                <h2 className="detail-section-title">Screenshots / 游戏截图</h2>
                <div className="horizontal-gallery">
                  {selectedResource.screenshots.map((url, i) => (
                    <div key={i} className="gallery-item-box" onClick={() => setSelectedImage(url)}>
                      <img src={url} alt={`Screenshot ${i}`} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* PV Player */}
            {selectedResource.pvUrl && (
              <section className="detail-section">
                <h2 className="detail-section-title">Promotion Video / PV鉴赏</h2>
                <div className="pv-wrapper">
                   <video controls src={selectedResource.pvUrl} poster={selectedResource.banner || ''} />
                </div>
              </section>
            )}

            {/* Official Website */}
             <button className="outline-action-btn">
                <Globe size={18} />
                <span>Official Website / 官网链接</span>
             </button>

            {/* Introduction */}
            <section className="detail-section">
              <h2 className="detail-section-title">游戏介绍</h2>
              <div 
                className="intro-text-content" 
                dangerouslySetInnerHTML={{ __html: selectedResource.introduction || "No introduction available." }} 
              />
            </section>

            {/* Login Required Info */}
            <BlurredSection isLoggedIn={isLoggedIn} title="详细发布信息">
              <section className="detail-section">
                <h2 className="detail-section-title">登录后信息</h2>
                <div className="info-grid-list">
                    <div className="info-item-row">
                      <span className="label">发布者</span>
                      <span className="value">Palentum</span>
                    </div>
                    <div className="info-item-row">
                      <span className="label">云端收藏</span>
                      <span className="value">未收藏</span>
                    </div>
                    <div className="info-item-row">
                      <span className="label">内容限制</span>
                      <span className="value">{selectedResource.contentLimit || 'sfw'}</span>
                    </div>
                </div>
              </section>
            </BlurredSection>

            {/* Rating Stats - The big blue boxes */}
            <BlurredSection isLoggedIn={isLoggedIn} title="评分详情">
              {ratingSummary && (
                <section className="detail-section rating-stats-container">
                  <div className="dual-score-grid">
                    <div className="score-main-box">
                      <div className="score-val">{ratingSummary.average.toFixed(1)}</div>
                      <div className="score-sub">综合评分</div>
                    </div>
                    <div className="score-main-box">
                      <div className="score-val">{ratingSummary.count}</div>
                      <div className="score-sub">评价人数</div>
                    </div>
                  </div>
                  
                  <div className="stat-chips-row">
                    <div className="stat-pills">收藏 {selectedResource.favoriteCount || 0}</div>
                    <div className="stat-pills">满分 10 分</div>
                  </div>

                  {/* Recommend Bar */}
                  <div className="recommend-area">
                    <h3 className="sub-section-header">推荐倾向</h3>
                    <div className="multi-color-bar">
                      {Object.entries(ratingSummary.recommend).map(([key, val]) => {
                        const colors = { strong_yes: '#10b981', yes: '#34d399', neutral: '#94a3b8', no: '#facc15', strong_no: '#ef4444' };
                        const color = (colors as any)[key] || '#cbd5e1';
                        const percentage = (val / (ratingSummary.count || 1)) * 100;
                        return val > 0 ? (
                          <div key={key} className="bar-segment" style={{ width: `${percentage}%`, backgroundColor: color }} />
                        ) : null;
                      })}
                    </div>
                    <div className="recommend-chips">
                       {Object.entries(ratingSummary.recommend).map(([key, val]) => {
                          const colors = { strong_yes: '#10b981', yes: '#22c55e', neutral: '#64748b', no: '#f59e0b', strong_no: '#ef4444' };
                          const dotColor = (colors as any)[key] || '#94a3b8';
                          const labels = { strong_yes: '强推', yes: '推荐', neutral: '一般', no: '不推', strong_no: '强力不推' };
                          if (val === 0) return null;
                          return (
                            <div key={key} className="rec-pill">
                              <span className="dot" style={{ backgroundColor: dotColor }} />
                              <span>{(labels as any)[key]} {val}</span>
                            </div>
                          );
                       })}
                    </div>
                  </div>

                  {/* Histogram */}
                  <div className="histogram-area">
                    <h3 className="sub-section-header">分数分布</h3>
                    <div className="hist-grid">
                      {ratingSummary.histogram.map((h) => {
                        const max = Math.max(...ratingSummary.histogram.map(i => i.count), 1);
                        const height = (h.count / max) * 100;
                        return (
                          <div key={h.score} className="hist-column">
                            <span className="hist-count-top">{h.count || 0}</span>
                            <div className="hist-bar-track">
                               <div className="hist-bar-fill" style={{ height: `${height}%` }} />
                            </div>
                            <span className="hist-score-bottom">{h.score}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}
            </BlurredSection>

            {/* Extra Metadata */}
            <section className="detail-section meta-list-section">
               <div className="meta-row">
                  <span className="meta-label">Company / 所属会社</span>
                  <span className="meta-value">{selectedResource.company || 'Unknown'}</span>
               </div>
               <div className="meta-row">
                  <span className="meta-label">Released / 发售时间</span>
                  <span className="meta-value">{selectedResource.releasedDate || 'N/A'}</span>
               </div>
               <div className="meta-row">
                  <span className="meta-label">VNDB ID</span>
                  <span className="meta-value link">{selectedResource.vndbId || 'N/A'}</span>
               </div>
               <div className="meta-row">
                  <span className="meta-label">Bangumi</span>
                  <span className="meta-value link">{selectedResource.bangumiId || 'N/A'}</span>
               </div>
               <div className="meta-row">
                  <span className="meta-label">DLsite / Steam Code</span>
                  <span className="meta-value">{selectedResource.steamId ? `STEAM:${selectedResource.steamId}` : 'N/A'}</span>
               </div>
               
               <div className="aliases-box">
                  <h3 className="alias-title">Aliases / 别名</h3>
                  <div className="alias-list">
                     {selectedResource.alias?.map((a, i) => <div key={i} className="alias-item">{a}</div>)}
                  </div>
               </div>

               <div className="tags-pill-area">
                  <h3 className="alias-title">Tags / 游戏标签 (点击过滤)</h3>
                  <div className="tag-grid-pills">
                     {selectedResource.tags?.map(t => (
                       <div 
                         key={t} 
                         className="tag-pill-rect cursor-pointer hover:bg-slate-200 transition-colors"
                         onClick={() => handleTagClick(t)}
                       >
                         {t}
                       </div>
                     ))}
                  </div>
               </div>
            </section>
          </div>
        </div>
      </div>

      {selectedImage && <ImageViewer url={selectedImage} onDismiss={() => setSelectedImage(null)} />}

      <style>{`
        .detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; justify-content: center; backdrop-filter: blur(4px); }
        .detail-sheet { background: #fff; width: 100%; max-width: 800px; height: 100%; display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s cubic-bezier(0, 1, 0, 1); }
        .sheet-header { height: 60px; display: flex; align-items: center; padding: 0 20px; position: absolute; z-index: 10; }
        .close-btn { background: rgba(255,255,255,0.8); border: none; border: 1px solid #ddd; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        .sheet-scroll-area { flex: 1; overflow-y: auto; overflow-x: hidden; scroll-behavior: smooth; }
        .top-banner-section { width: 100%; aspect-ratio: 21/9; position: relative; background: #eee; }
        .main-banner { width: 100%; height: 100%; object-fit: cover; }
        .banner-overlay { position: absolute; top: 16px; left: 16px; }
        .overlay-rating { background: rgba(0,0,0,0.6); color: #fff; padding: 4px 12px; border-radius: 8px; font-weight: 800; font-size: 16px; }
        
        .sheet-padding-content { padding: 24px; display: flex; flex-direction: column; gap: 24px; }
        .detail-title { margin: 0; font-size: 28px; font-weight: 800; color: #1e293b; line-height: 1.2; }
        
        .collect-main-btn { width: 100%; background: #00708b; color: #fff; border: none; border-radius: 12px; padding: 16px; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: opacity 0.2s; }
        .collect-main-btn:hover { opacity: 0.9; }
        
        .detail-section-title { font-size: 20px; font-weight: 800; color: #1e293b; margin-bottom: 12px; }
        .horizontal-gallery { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; }
        .gallery-item-box { flex: 0 0 280px; aspect-ratio: 16/9; border-radius: 12px; overflow: hidden; background: #eee; cursor: pointer; border: 1px solid #ddd; }
        .gallery-item-box img { width: 100%; height: 100%; object-fit: cover; }
        
        .pv-wrapper { border-radius: 12px; overflow: hidden; background: #000; aspect-ratio: 16/9; position: relative; }
        .pv-wrapper video { width: 100%; height: 100%; }
        
        .outline-action-btn { background: transparent; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px; font-weight: 700; color: #1e293b; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
        .intro-text-content { line-height: 1.7; color: #334155; font-size: 16px; }
        
        .info-grid-list { display: flex; flex-direction: column; gap: 12px; }
        .info-item-row { display: flex; justify-content: space-between; align-items: center; font-size: 16px; }
        .info-item-row .label { color: #64748b; font-weight: 600; }
        .info-item-row .value { color: #1e293b; font-weight: 700; }
        
        /* Rating Stats */
        .dual-score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .score-main-box { background: #e0f2fe; padding: 24px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; }
        .score-val { font-size: 36px; font-weight: 900; color: #0369a1; }
        .score-sub { font-size: 14px; font-weight: 700; color: #0369a1; opacity: 0.8; }
        
        .stat-chips-row { display: flex; gap: 8px; margin-top: 12px; }
        .stat-pills { padding: 8px 16px; border-radius: 12px; border: 1.5px solid #cbd5e1; font-weight: 700; color: #475569; font-size: 14px; }
        
        .sub-section-header { font-size: 18px; font-weight: 800; margin: 24px 0 12px; color: #1e293b; }
        .multi-color-bar { height: 16px; width: 100%; border-radius: 8px; overflow: hidden; display: flex; background: #eee; }
        .bar-segment { height: 100%; }
        .recommend-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .rec-pill { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-weight: 700; color: #475569; font-size: 14px; }
        .rec-pill .dot { width: 10px; height: 10px; border-radius: 50%; }
        
        .hist-grid { display: flex; align-items: flex-end; justify-content: space-between; height: 140px; padding: 0 10px; }
        .hist-column { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .hist-count-top { font-size: 11px; font-weight: 800; color: #64748b; }
        .hist-bar-track { width: 40%; height: 100px; background: #f1f5f9; border-radius: 6px; display: flex; align-items: flex-end; position: relative; }
        .hist-bar-fill { width: 100%; background: #bae6fd; border-radius: 6px; min-height: 2px; }
        .hist-score-bottom { font-size: 13px; font-weight: 800; color: #1e293b; }
        
        /* Meta List */
        .meta-list-section { border-top: 1px solid #e2e8f0; padding-top: 24px; display: flex; flex-direction: column; gap: 16px; }
        .meta-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .meta-label { font-size: 16px; font-weight: 600; color: #64748b; flex: 1; }
        .meta-value { font-size: 16px; font-weight: 700; color: #1e293b; flex: 1.5; text-align: right; }
        .meta-value.link { color: #0369a1; }
        
        .aliases-box, .tags-pill-area { margin-top: 16px; }
        .alias-title { font-size: 18px; font-weight: 800; color: #00708b; margin-bottom: 12px; }
        .alias-list { display: flex; flex-direction: column; gap: 4px; color: #475569; font-size: 15px; font-weight: 600; }
        .tag-grid-pills { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag-pill-rect { padding: 10px 16px; background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-weight: 700; color: #475569; }
        
        .image-viewer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 2000; display: flex; align-items: center; justify-content: center; }
        .image-viewer-content { max-width: 90%; max-height: 90%; position: relative; }
        .image-viewer-content img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; }
        .viewer-close { position: absolute; top: -50px; right: 0; background: #fff; border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
};
