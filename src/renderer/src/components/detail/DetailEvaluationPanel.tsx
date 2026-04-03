import React from 'react';
import { EvaluationSection } from '../EvaluationSection';
import { BlurredSection } from '../BlurredSection';

interface DetailEvaluationPanelProps {
  sessionError: 'SESSION_EXPIRED' | null;
  ratings: any[];
  isLoading: boolean;
  isLoggedIn: boolean;
}

export const DetailEvaluationPanel: React.FC<DetailEvaluationPanelProps> = ({
  sessionError,
  ratings,
  isLoading,
  isLoggedIn
}) => (
  <div className="flex flex-col gap-6">
    <BlurredSection
      isLoggedIn={isLoggedIn}
      forceLocked={sessionError === 'SESSION_EXPIRED'}
      title="用户评价"
      description="登录后解锁详细的评分分布和用户评价"
      buttonLabel="登录查看"
    >
      <EvaluationSection ratings={ratings} isLoading={isLoading} />
    </BlurredSection>
  </div>
);
