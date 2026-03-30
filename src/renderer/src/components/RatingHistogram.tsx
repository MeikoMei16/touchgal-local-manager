import React from 'react';

export type RatingSummary = {
  average: number;
  count: number;
  histogram?: { score: number; count: number }[];
  recommend?: {
    strong_no: number;
    no: number;
    neutral: number;
    yes: number;
    strong_yes: number;
  };
};

export const RatingHistogram: React.FC<{ ratingSummary: RatingSummary; compact?: boolean }> = ({ ratingSummary, compact = false }) => {
  const histogramByScore = new Map((ratingSummary.histogram ?? []).map((item) => [item.score, item.count]));
  const sorted = Array.from({ length: 10 }, (_, index) => {
    const score = index + 1;
    return { score, count: histogramByScore.get(score) ?? 0 };
  });
  const maxCount = Math.max(...sorted.map(h => h.count), 1);

  const barColor = (score: number) => {
    if (score >= 9) return 'bg-emerald-500';
    if (score >= 7) return 'bg-blue-500';
    if (score >= 5) return 'bg-amber-400';
    if (score >= 3) return 'bg-orange-400';
    return 'bg-rose-500';
  };

  const recBars = [
    { key: 'strong_no', label: '强烈不推荐' },
    { key: 'no', label: '不推荐' },
    { key: 'neutral', label: '中立' },
    { key: 'yes', label: '推荐' },
    { key: 'strong_yes', label: '强烈推荐' }
  ] as const;

  const rec = ratingSummary.recommend;
  const guideSteps = 4;
  const guideValues = Array.from({ length: guideSteps + 1 }, (_, index) =>
    Math.round((maxCount * (guideSteps - index)) / guideSteps)
  );
  const recommendPills = rec
    ? recBars.map((bar) => ({
        ...bar,
        value: rec[bar.key],
        tone:
          bar.key === 'strong_no'
            ? 'bg-rose-100 text-rose-500'
            : bar.key === 'no'
              ? 'bg-amber-100 text-amber-600'
              : bar.key === 'neutral'
                ? 'bg-slate-100 text-slate-500'
                : bar.key === 'yes'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-violet-100 text-violet-600'
      }))
    : [];

  return (
    <div className={`bg-white border border-slate-100 flex flex-col ${compact ? 'rounded-[1.25rem] p-5 gap-4 shadow-lg shadow-slate-200/50' : 'rounded-[2rem] p-8 gap-5 shadow-sm'}`}>
      <div className="flex items-end gap-3">
        <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-black text-slate-900 tracking-tight`}>评分分布图</h2>
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-slate-400`}>共 {ratingSummary.count.toLocaleString()} 人评分</span>
      </div>

      <div className={`grid grid-cols-[32px_1fr] ${compact ? 'gap-3' : 'gap-4'}`}>
        <div className={`relative ${compact ? 'h-56' : 'h-64'}`}>
          {guideValues.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className={`absolute -translate-y-1/2 font-bold text-slate-400 ${compact ? 'text-[11px]' : 'text-xs'}`}
              style={{ top: `${(index / guideSteps) * 100}%` }}
            >
              {value}
            </span>
          ))}
        </div>
        <div className={`relative ${compact ? 'h-56' : 'h-64'}`}>
          {guideValues.map((_, index) => (
            <div
              key={index}
              className="absolute left-0 right-0 border-t border-dashed border-slate-200"
              style={{ top: `${(index / guideSteps) * 100}%` }}
            />
          ))}
          <div className={`absolute inset-x-0 bottom-0 grid h-full grid-cols-10 ${compact ? 'gap-1.5' : 'gap-2'} px-1`}>
            {sorted.map((item) => (
              <div key={item.score} className={`flex h-full flex-col items-center justify-end ${compact ? 'gap-1.5' : 'gap-2'}`}>
                <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-bold text-slate-500`}>{item.count}</div>
                <div className="flex h-full w-full items-end justify-center">
                  <div
                    className={`${barColor(item.score)} w-full ${compact ? 'max-w-[14px]' : 'max-w-[22px]'} rounded-t-[8px] transition-all duration-700`}
                    style={{ height: `${Math.max((item.count / maxCount) * 100, item.count > 0 ? 8 : 0)}%` }}
                  />
                </div>
                <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-bold text-slate-400`}>{item.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {recommendPills.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className={`${compact ? 'text-xs' : 'text-xs'} font-black text-slate-400 uppercase tracking-widest mb-1`}>推荐倾向</div>
          <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
            {recommendPills.map((pill) => (
              <span
                key={pill.key}
                className={`rounded-2xl ${compact ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm'} font-black ${pill.tone}`}
              >
                {pill.label} {pill.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
