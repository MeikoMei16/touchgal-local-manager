import React from 'react';
import { CommentSection } from '../CommentSection';
import { BlurredSection } from '../BlurredSection';

interface DetailBoardPanelProps {
  isLoggedIn: boolean;
  sessionError: 'SESSION_EXPIRED' | null;
  comments: any[];
  isLoading: boolean;
}

export const DetailBoardPanel: React.FC<DetailBoardPanelProps> = ({
  isLoggedIn,
  sessionError,
  comments,
  isLoading
}) => (
  <div className="flex flex-col gap-6">
    <BlurredSection
      isLoggedIn={isLoggedIn}
      forceLocked={sessionError === 'SESSION_EXPIRED'}
      title="讨论内容"
      description="登录后即可查看和参与社区讨论"
      buttonLabel="登录查看"
    >
      <CommentSection comments={comments} isLoading={isLoading} />
    </BlurredSection>
  </div>
);
