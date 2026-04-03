import React, { useState } from 'react';
import { useUIStore, useAuthStore } from '../store/useTouchGalStore';
import { X, Loader2 } from 'lucide-react';
import { DetailHeader } from './detail/DetailHeader';
import { DetailTabs, DetailTabType } from './detail/DetailTabs';
import { DetailImageViewer } from './detail/DetailImageViewer';
import { DetailInfoPanel } from './detail/DetailInfoPanel';
import { DetailLinksPanel } from './detail/DetailLinksPanel';
import { DetailBoardPanel } from './detail/DetailBoardPanel';
import { DetailEvaluationPanel } from './detail/DetailEvaluationPanel';
import type { DetailSecondaryClickAction } from '../store/uiStoreTypes';

const shouldIgnoreSecondaryBack = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('a, button, input, textarea, select, option, label, [contenteditable="true"], [data-allow-context-menu="true"]'));
};

export const DetailOverlay: React.FC = () => {
  const {
    selectedResource, clearSelected, addTagFilter, refreshSelectedResourceSocial,
    isDetailLoading, patchComments, patchRatings, detailSecondaryClickAction
  } = useUIStore();
  const { user, sessionError, setIsLoginOpen } = useAuthStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTabType>('info');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const socialRefreshKeyRef = React.useRef<string | null>(null);
  const wasLoggedInRef = React.useRef(false);

  React.useEffect(() => {
    if (selectedResource && scrollRef.current) {
      scrollRef.current.focus();
    }
  }, [selectedResource]);

  React.useEffect(() => {
    const isLoggedIn = !!user;
    const didJustLogin = isLoggedIn && !wasLoggedInRef.current;
    wasLoggedInRef.current = isLoggedIn;

    if (!selectedResource?.uniqueId) {
      socialRefreshKeyRef.current = null;
      return;
    }
    if (!didJustLogin) return;
    if (!selectedResource.id || isDetailLoading || sessionError === 'SESSION_EXPIRED') return;

    const refreshKey = `${selectedResource.uniqueId}:${user.id ?? user.uid ?? 'logged-in'}`;
    if (socialRefreshKeyRef.current === refreshKey) return;

    socialRefreshKeyRef.current = refreshKey;
    void refreshSelectedResourceSocial();
  }, [isDetailLoading, refreshSelectedResourceSocial, selectedResource, sessionError, user]);

  if (!selectedResource) return null;

  const isLoggedIn = !!user;

  const handleTagClick = (tag: string) => {
    addTagFilter(tag);
    clearSelected();
  };

  const handleSecondaryBack = (
    event: React.MouseEvent<HTMLElement>,
    action: () => void,
    { allowInteractiveTarget = true }: { allowInteractiveTarget?: boolean } = {}
  ) => {
    if (detailSecondaryClickAction !== 'back') return;
    if (allowInteractiveTarget && shouldIgnoreSecondaryBack(event.target)) return;
    event.preventDefault();
    action();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex justify-center backdrop-blur-md animate-in fade-in duration-300" onClick={clearSelected}>
      <div
        className="bg-slate-50 w-full max-w-7xl h-full flex flex-col overflow-hidden animate-in slide-in-from-bottom-[100px] ease-out-expo duration-500 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(event) => handleSecondaryBack(event, clearSelected)}
      >
        {isDetailLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs z-[100] flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
            <Loader2 className="animate-spin text-primary" size={48} />
            <span className="text-primary font-black animate-pulse">正在获取详细信息...</span>
          </div>
        )}

        {sessionError === 'SESSION_EXPIRED' && (
          <div className="absolute top-0 left-0 right-0 bg-rose-500 text-white py-2 px-4 z-[200] flex items-center justify-center gap-4 animate-in slide-in-from-top duration-300 shadow-lg">
             <span className="font-bold text-sm">您的登录已失效，部分高级信息（评论、评分）可能无法加载。</span>
             <button
               onClick={() => setIsLoginOpen(true)}
               className="bg-white text-rose-500 px-4 py-1 rounded-full text-xs font-black hover:bg-rose-50 transition-all uppercase"
             >
               立即登录
             </button>
          </div>
        )}

        {/* Close Button */}
        <div className="absolute top-4 right-4 z-50">
          <button
            className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-110 active:scale-95"
            onClick={clearSelected}
          >
            <X size={20} className="text-slate-800" />
          </button>
        </div>

        <div
          ref={scrollRef}
          tabIndex={0}
          className="flex-1 overflow-y-auto scroll-smooth outline-none focus:ring-0 p-4 md:p-8"
        >
          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <DetailHeader resource={selectedResource} onImageClick={setSelectedImage} />
            <DetailTabs activeTab={activeTab} onChange={setActiveTab} />

            {/* Tab Content */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {activeTab === 'info' && (
                <DetailInfoPanel
                  resource={selectedResource}
                  onTagClick={handleTagClick}
                  onImageClick={setSelectedImage}
                />
              )}

              {activeTab === 'links' && <DetailLinksPanel resource={selectedResource} />}

              {activeTab === 'board' && (
                <DetailBoardPanel
                  isLoggedIn={isLoggedIn}
                  sessionError={sessionError}
                  comments={patchComments}
                  isLoading={isDetailLoading}
                />
              )}

              {activeTab === 'evaluation' && (
                <DetailEvaluationPanel
                  sessionError={sessionError}
                  ratings={patchRatings}
                  isLoading={isDetailLoading}
                  isLoggedIn={isLoggedIn}
                />
              )}
            </div>

          </div>
        </div>
      </div>
      {selectedImage && (
        <DetailImageViewer
          url={selectedImage}
          onDismiss={() => setSelectedImage(null)}
          secondaryClickAction={detailSecondaryClickAction as DetailSecondaryClickAction}
        />
      )}
    </div>
  );
};
