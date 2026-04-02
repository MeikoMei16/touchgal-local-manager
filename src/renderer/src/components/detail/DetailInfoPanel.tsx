import React from 'react';
import { Calendar, Clock3, ExternalLink, RefreshCw } from 'lucide-react';
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
  const formatDate = (value: string | null | undefined) => {
    if (!value) return null;
    const directMatch = value.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (directMatch) return directMatch[0];
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const metadataRows = [
    { icon: Clock3, label: '发布时间', value: formatDate(resource.created) },
    { icon: Calendar, label: '发售时间', value: resource.releasedDate || null },
    { icon: RefreshCw, label: '资源更新时间', value: formatDate(resource.resourceUpdateTime) }
  ].filter((item) => item.value);
  const externalRows = [
    resource.vndbId
      ? { label: 'VNDB ID', href: `https://vndb.org/${resource.vndbId}`, value: resource.vndbId }
      : null,
    resource.bangumiId
      ? { label: 'Bangumi', href: `https://bgm.tv/subject/${resource.bangumiId}`, value: String(resource.bangumiId) }
      : null,
    resource.steamId
      ? { label: 'Steam', href: `https://store.steampowered.com/app/${resource.steamId}`, value: resource.steamId }
      : null
  ].filter((item): item is { label: string; href: string; value: string } => Boolean(item));

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

        {(metadataRows.length > 0 || externalRows.length > 0) && (
          <section className="flex flex-col gap-6 pt-8 border-t border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {metadataRows.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <Icon size={16} className="text-slate-400" />
                  <span>
                    {label}: {value}
                  </span>
                </div>
              ))}
              {externalRows.map(({ label, href, value }) => (
                <div key={label} className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <ExternalLink size={16} className="text-slate-400" />
                  <span>
                    {label}:{' '}
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-blue-600 transition-colors hover:text-blue-700 hover:underline"
                    >
                      {value}
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

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
