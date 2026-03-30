import React from 'react';
import { MessageSquare, ThumbsUp, Reply, MoreHorizontal } from 'lucide-react';

interface Comment {
  id: number;
  content: string;
  userName: string;
  userAvatar: string | null;
  createdAt: string;
}

interface CommentSectionProps {
  comments: Comment[];
  isLoading: boolean;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ comments, isLoading }) => {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '刚刚';
      
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return '今天';
      if (days < 30) return `${days}天前`;
      if (days < 365) return `${Math.floor(days / 30)}个月前`;
      return `${Math.floor(days / 365)}年前`;
    } catch {
      return '未知时间';
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-xl font-black text-slate-800 border-l-4 border-primary pl-4 flex items-center gap-2">
        <MessageSquare size={22} className="text-primary" />
        <span>讨论交流 ({comments.length})</span>
      </h2>
      
      {isLoading && comments.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 font-bold border border-slate-100">
          暂无讨论内容
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                    {comment.userAvatar ? (
                      <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-black text-xs uppercase">
                        {(comment.userName || 'Anonymous').substring(0, 2)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-black text-slate-900 text-sm">{comment.userName || 'Anonymous'}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(comment.createdAt)}</div>
                  </div>
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-full text-slate-300 transition-colors">
                  <MoreHorizontal size={18} />
                </button>
              </div>

              <div 
                className="text-slate-700 text-sm font-medium leading-relaxed prose prose-sm max-w-none prose-slate prose-img:rounded-xl prose-img:border prose-img:border-slate-100 prose-a:text-primary"
                dangerouslySetInnerHTML={{ __html: comment.content }}
              />

              <div className="flex items-center gap-2 pt-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-black text-slate-500 hover:bg-slate-50 transition-colors">
                  <ThumbsUp size={12} />
                  <span>赞</span>
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-black text-slate-500 hover:bg-slate-50 transition-colors">
                  <Reply size={12} />
                  <span>回复</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
