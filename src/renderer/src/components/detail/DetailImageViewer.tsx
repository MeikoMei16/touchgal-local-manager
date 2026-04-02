import React from 'react';
import { X } from 'lucide-react';
import type { DetailSecondaryClickAction } from '../../store/uiStoreTypes';

interface DetailImageViewerProps {
  url: string;
  onDismiss: () => void;
  secondaryClickAction?: DetailSecondaryClickAction;
}

export const DetailImageViewer: React.FC<DetailImageViewerProps> = ({
  url,
  onDismiss,
  secondaryClickAction = 'back'
}) => (
  <div
    className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center animate-in fade-in duration-200"
    onClick={onDismiss}
    onContextMenu={(event) => {
      if (secondaryClickAction !== 'back') return;
      event.preventDefault();
      onDismiss();
    }}
  >
    <div className="max-w-[95%] max-h-[95%] relative group" onClick={(e) => e.stopPropagation()}>
      <img src={url} alt="Screenshot Full" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10" />
      <button
        className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white border-none rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-all backdrop-blur-md"
        onClick={onDismiss}
      >
        <X size={24} />
      </button>
    </div>
  </div>
);
