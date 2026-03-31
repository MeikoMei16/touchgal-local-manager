import React from 'react';
import { Star } from 'lucide-react';
import { EvaluationSection } from '../EvaluationSection';
import { BlurredSection } from '../BlurredSection';
import { DetailSessionGate } from './DetailSessionGate';

interface DetailEvaluationPanelProps {
  sessionError: 'SESSION_EXPIRED' | null;
  ratings: any[];
  isLoading: boolean;
  isLoggedIn: boolean;
  onLogin: () => void;
}

export const DetailEvaluationPanel: React.FC<DetailEvaluationPanelProps> = ({
  sessionError,
  ratings,
  isLoading,
  isLoggedIn,
  onLogin
}) => (
  <div className="flex flex-col gap-6">
    {sessionError === 'SESSION_EXPIRED' ? (
      <DetailSessionGate
        icon={Star}
        title="评分详情已隐藏"
        description="登录后解锁详细的评分分布和用户评价"
        buttonClassName="bg-amber-500 shadow-amber-200 hover:bg-amber-600"
        onLogin={onLogin}
      />
    ) : (
      <BlurredSection isLoggedIn={isLoggedIn} title="用户评价">
        <EvaluationSection ratings={ratings} isLoading={isLoading} />
      </BlurredSection>
    )}
  </div>
);
