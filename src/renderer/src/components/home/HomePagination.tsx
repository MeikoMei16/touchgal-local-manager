import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HomePaginationProps {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  jumpPage: string;
  onJumpPageChange: (value: string) => void;
  onJumpPageCommit: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onJumpPageReset: () => void;
  onGoToPage: (page: number) => void;
}

export const HomePagination: React.FC<HomePaginationProps> = ({
  currentPage,
  totalPages,
  isLoading,
  jumpPage,
  onJumpPageChange,
  onJumpPageCommit,
  onJumpPageReset,
  onGoToPage
}) => (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 ml-10">
    <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xl p-1.5 rounded-full shadow-2xl border border-outline-variant">
      <button
        className="w-11 h-11 rounded-full border-none bg-surface-container text-on-surface-variant flex items-center justify-center cursor-pointer transition-all hover:bg-secondary-container disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={currentPage === 1 || isLoading}
        onClick={() => onGoToPage(currentPage - 1)}
      >
        <ChevronLeft size={24} />
      </button>

      <div className="bg-white border-1.5 border-outline-variant px-4 py-1.5 rounded-full font-extrabold text-[15px] text-primary flex items-center gap-2 shadow-inner">
        <input
          type="text"
          className="w-9 border-none bg-surface-container-low rounded-md py-0.5 text-center font-black text-[15px] text-primary outline-hidden focus:bg-primary-container focus:ring-1 focus:ring-primary"
          value={jumpPage}
          onChange={(event) => onJumpPageChange(event.target.value)}
          onKeyDown={onJumpPageCommit}
          onBlur={onJumpPageReset}
        />
        <span className="text-on-surface-variant/60 text-sm">/ {totalPages || 1}</span>
      </div>

      <button
        className={`w-11 h-11 rounded-full border-none flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed ${currentPage === totalPages ? 'bg-surface-container text-on-surface-variant' : 'bg-primary text-on-primary shadow-lg hover:bg-primary/90'}`}
        disabled={currentPage === totalPages || isLoading}
        onClick={() => onGoToPage(currentPage + 1)}
      >
        <ChevronRight size={24} />
      </button>
    </div>
  </div>
);
