import React from 'react';
import { FileText, Globe } from 'lucide-react';
import { TouchGalDetail } from '../../types';
import { DetailScreenshotStrip } from './DetailScreenshotStrip';
import { DetailPvPanel } from './DetailPvPanel';

interface DetailInfoPanelProps {
  resource: TouchGalDetail;
  onTagClick: (tag: string) => void;
  onImageClick: (url: string) => void;
}

export const DetailInfoPanel: React.FC<DetailInfoPanelProps> = ({
  resource,
  onTagClick,
  onImageClick
}) => {
  const screenshots = resource.screenshots ?? [];
  const pvUrl = resource.pvUrl;
  const companyName = resource.company || 'Unknown';
  const aliases = resource.alias ?? [];
  const metadataRows = [
    { icon: FileText, label: '发售时间', value: resource.releasedDate || 'N/A' },
    { icon: Globe, label: 'VNDB ID', value: resource.vndbId || 'N/A' },
    { icon: Globe, label: 'Bangumi ID', value: resource.bangumiId || 'N/A' },
    { icon: Globe, label: 'Steam ID', value: resource.steamId || 'N/A' }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏介绍</h2>
          <div
            className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium text-lg"
            dangerouslySetInnerHTML={{ __html: resource.introduction || 'No introduction available.' }}
          />
        </section>

        <DetailScreenshotStrip screenshots={screenshots} onImageClick={onImageClick} />

        {pvUrl && (
          <DetailPvPanel pvUrl={pvUrl} />
        )}

        <section className="flex flex-col gap-6 pt-8 border-t border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏标签</h2>
          <div className="flex flex-wrap gap-2">
            {resource.tags?.map((tag: string) => (
              <div
                key={tag}
                className="px-4 py-2 bg-purple-50 border border-purple-100 rounded-full font-bold text-purple-600 text-sm cursor-pointer transition-all hover:bg-purple-100 active:scale-95"
                onClick={() => onTagClick(tag)}
              >
                {tag}
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 pt-8 border-t border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">所属会社</h2>
          <div className="flex flex-wrap gap-2">
            <div className="px-4 py-2 bg-purple-50 border border-purple-100 rounded-full font-bold text-purple-600 text-sm">
              {companyName}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6 pt-8 border-t border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {metadataRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50">
                <div className="flex items-center gap-2 text-slate-400 font-bold text-sm italic">
                  <Icon size={16} />
                  <span>{label}</span>
                </div>
                <span className="font-black text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {aliases.length > 0 && (
          <section className="flex flex-col gap-4 pt-8 border-t border-slate-100">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏别名</h2>
            <ul className="list-disc list-inside text-slate-500 font-medium space-y-1">
              {aliases.map((alias: string, i: number) => <li key={i}>{alias}</li>)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};
