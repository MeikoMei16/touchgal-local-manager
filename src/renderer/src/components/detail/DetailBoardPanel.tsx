import React from 'react';
import { MessageSquare } from 'lucide-react';
import { CommentSection } from '../CommentSection';
import { DetailSessionGate } from './DetailSessionGate';

interface DetailBoardPanelProps {
  sessionError: 'SESSION_EXPIRED' | null;
  comments: any[];
  isLoading: boolean;
  onLogin: () => void;
}

export const DetailBoardPanel: React.FC<DetailBoardPanelProps> = ({
  sessionError,
  comments,
  isLoading,
  onLogin
}) => (
  <div className="flex flex-col gap-6">
    {sessionError === 'SESSION_EXPIRED' ? (
      <DetailSessionGate
        icon={MessageSquare}
        title="讨论内容暂不可见"
        description="登录后即可查看和参与社区讨论"
        buttonClassName="bg-rose-500 shadow-rose-200 hover:bg-rose-600"
        onLogin={onLogin}
      />
    ) : (
      <CommentSection comments={comments} isLoading={isLoading} />
    )}
  </div>
);
