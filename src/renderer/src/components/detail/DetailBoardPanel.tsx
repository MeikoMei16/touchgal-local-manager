import React from 'react';
import { CommentSection } from '../CommentSection';
import { BlurredSection } from '../BlurredSection';

interface DetailBoardPanelProps {
  isLoggedIn: boolean;
  sessionError: 'SESSION_EXPIRED' | null;
  legacyUnavailable: boolean;
  comments: any[];
  isLoading: boolean;
}

export const DetailBoardPanel: React.FC<DetailBoardPanelProps> = ({
  isLoggedIn,
  sessionError,
  legacyUnavailable,
  comments,
  isLoading
}) => (
  <div className="flex flex-col gap-6">
    <BlurredSection
      isLoggedIn={isLoggedIn || legacyUnavailable}
      forceLocked={sessionError === 'SESSION_EXPIRED'}
      title="讨论内容"
      description="登录后即可查看和参与社区讨论"
      buttonLabel="登录查看"
    >
      <CommentSection
        comments={comments}
        isLoading={isLoading}
        emptyLabel={legacyUnavailable ? '旧站讨论数据暂不可用' : undefined}
      />
    </BlurredSection>
  </div>
);
