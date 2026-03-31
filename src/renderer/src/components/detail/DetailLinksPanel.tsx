import React from 'react';
import {
  Download,
  ExternalLink,
  Globe,
  HardDrive,
  Heart,
  Languages,
  MoreHorizontal,
  Package,
} from 'lucide-react';
import { TouchGalDetail, TouchGalDownload } from '../../types';

interface DetailLinksPanelProps {
  resource: TouchGalDetail;
}

const SECTION_LABELS: Record<string, string> = {
  galgame: 'PC游戏',
  patch: '补丁资源',
  emulator: '模拟器资源',
  android: '手机游戏',
};

const STORAGE_LABELS: Record<string, string> = {
  touchgal: 'TouchGal 官方',
  s3: 'TouchGal 官方',
  onedrive: 'OneDrive',
  user: '社区资源',
};

type ResourceBucket = 'galgame' | 'patch';
const KUN_PATCH_WEBSITE_URL = 'https://www.moyu.moe/';
const KUN_PATCH_WEBSITE_API = 'https://www.moyu.moe/api/hikari';

const getLinks = (download: TouchGalDownload) =>
  (download.content ?? download.url ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getAccessCode = (download: TouchGalDownload) => download.code || null;
const getPassword = (download: TouchGalDownload) => download.password || null;

const getDisplayName = (download: TouchGalDownload) => {
  const explicitName = download.name.trim();
  if (explicitName) return explicitName;

  const section = download.section ? SECTION_LABELS[download.section] ?? download.section : null;
  const type = download.type[0] ?? null;
  const platform = download.platform[0] ?? null;
  return [section, type, platform].filter(Boolean).join(' ') || '下载资源';
};

const formatRelative = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (diff >= year) return `${Math.floor(diff / year)} 年前`;
  if (diff >= month) return `${Math.floor(diff / month)} 个月前`;
  if (diff >= day) return `${Math.floor(diff / day)} 天前`;
  if (diff >= hour) return `${Math.floor(diff / hour)} 小时前`;
  if (diff >= minute) return `${Math.floor(diff / minute)} 分钟前`;
  return '刚刚';
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const isOfficial = (download: TouchGalDownload) =>
  (download.user?.role ?? 0) > 2 || download.storage === 'touchgal' || download.storage === 's3';

const toBucket = (download: TouchGalDownload): ResourceBucket =>
  download.section === 'patch' ? 'patch' : 'galgame';

const ResourceCard: React.FC<{ download: TouchGalDownload }> = ({ download }) => {
  const links = getLinks(download);
  const accessCode = getAccessCode(download);
  const password = getPassword(download);
  const displayName = getDisplayName(download);
  const created = formatRelative(download.created);

  return (
    <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {download.section && (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-700">
                {SECTION_LABELS[download.section] ?? download.section}
              </span>
            )}
            {(download.type ?? []).map((type) => (
              <span key={type} className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                {type}
              </span>
            ))}
            {(download.language ?? []).map((language) => (
              <span
                key={language}
                className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700"
              >
                <Languages size={12} />
                {language}
              </span>
            ))}
            {(download.platform ?? []).map((platform) => (
              <span key={platform} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                {platform}
              </span>
            ))}
            {accessCode && (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-700">
                提取码 {accessCode}
              </span>
            )}
            {password && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
                解压码 {password}
              </span>
            )}
          </div>

          <div className="flex items-start gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
              {download.user?.avatar ? (
                <img src={download.user.avatar} alt={download.user.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-black text-slate-500">
                  {(download.user?.name ?? STORAGE_LABELS[download.storage ?? ''] ?? 'R').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[1.05rem] font-black text-slate-900">{displayName}</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">
                {download.user?.name ?? (isOfficial(download) ? 'TouchGal 官方' : '社区用户')}
              </div>
              <div className="text-xs font-bold text-slate-400">
                {[created, download.user?.patchCount != null ? `已发布资源 ${download.user.patchCount} 个` : null]
                  .filter(Boolean)
                  .join(' • ')}
              </div>
            </div>
          </div>

          {download.note ? (
            <div className="text-[15px] font-medium leading-8 text-slate-700 whitespace-pre-wrap">{download.note}</div>
          ) : null}

          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {link}
              </a>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-500">
            {download.storage && (
              <span className="inline-flex items-center gap-1.5">
                <HardDrive size={14} />
                {STORAGE_LABELS[download.storage] ?? download.storage}
              </span>
            )}
            {download.size && (
              <span className="inline-flex items-center gap-1.5">
                <Package size={14} />
                {download.size}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <button className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <MoreHorizontal size={18} />
          </button>
          <div className="mt-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-black text-slate-700">
              <Heart size={16} />
              {download.likeCount ?? 0}
            </span>
            {links[0] && (
              <a
                href={links[0]}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700"
              >
                <Download size={18} />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

const GroupCard: React.FC<{
  title: string;
  description: string;
  avatarSrc: string;
  resources: TouchGalDownload[];
  resourceUpdateTime?: string | null;
}> = ({ title, description, avatarSrc, resources, resourceUpdateTime }) => (
  <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
      <div className="h-12 w-12 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
        <img src={avatarSrc} alt={title} className="h-full w-full object-cover" />
      </div>
      <div>
        <div className="text-xl font-black text-slate-900">{title}</div>
        <div className="text-sm font-medium text-slate-500">{description}</div>
        {resourceUpdateTime && (
          <div className="mt-1 text-xs font-bold text-slate-400">
            资源更新时间 {resourceUpdateTime}
          </div>
        )}
      </div>
    </div>

    <div className="mt-4 space-y-4">
      {resources.map((download) => (
        <ResourceCard key={`${download.id}-${download.content ?? download.url}`} download={download} />
      ))}
    </div>
  </section>
);

export const DetailLinksPanel: React.FC<DetailLinksPanelProps> = ({ resource }) => {
  const [selectedBucket, setSelectedBucket] = React.useState<ResourceBucket>('galgame');
  const downloads = Array.isArray(resource.downloads)
    ? resource.downloads.filter((item) => getLinks(item).length > 0)
    : [];

  if (downloads.length === 0) {
    return (
      <div className="bg-white rounded-[2rem] p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center gap-4">
        <Globe size={64} className="text-slate-200" />
        <h2 className="text-xl font-black text-slate-800">资源链接</h2>
        <p className="text-slate-500 font-medium">当前条目还没有可用的下载直链。</p>
      </div>
    );
  }

  const bucketed = downloads.filter((download) => toBucket(download) === selectedBucket);
  const official = bucketed.filter(isOfficial);
  const community = bucketed.filter((download) => !isOfficial(download));
  const galgameCount = downloads.filter((download) => toBucket(download) === 'galgame').length;
  const patchCount = downloads.filter((download) => toBucket(download) === 'patch').length;
  const resourceUpdatedAt = formatDate(resource.resourceUpdateTime ?? null);
  const kunPatchLink = resource.vndbId ? `${KUN_PATCH_WEBSITE_API}?vndb_id=${resource.vndbId}` : KUN_PATCH_WEBSITE_URL;

  return (
    <div className="flex flex-col gap-6">
      <div className="inline-flex w-fit rounded-2xl bg-slate-100 p-1 shadow-inner">
        <button
          className={`rounded-xl px-5 py-2.5 text-sm font-black transition-colors ${
            selectedBucket === 'galgame' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setSelectedBucket('galgame')}
        >
          Galgame 资源
        </button>
        <button
          className={`rounded-xl px-5 py-2.5 text-sm font-black transition-colors ${
            selectedBucket === 'patch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setSelectedBucket('patch')}
        >
          Galgame 补丁
        </button>
      </div>

      {selectedBucket === 'patch' && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                <img
                  src="https://api.dicebear.com/7.x/icons/svg?seed=kun-patch"
                  alt="鲲 Galgame 补丁"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900">鲲 Galgame 补丁</div>
                <div className="text-sm font-medium text-slate-500">这是外部补丁站入口，不计入当前 TouchGal 资源列表。</div>
                {resource.vndbId && (
                  <div className="mt-1 text-xs font-bold text-slate-400">VNDB ID: {resource.vndbId}</div>
                )}
              </div>
            </div>
            <a
              href={kunPatchLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800"
            >
              <span>打开外部链接</span>
              <ExternalLink size={16} />
            </a>
          </div>
        </section>
      )}

      {official.length > 0 && (
        <GroupCard
          title={selectedBucket === 'patch' ? 'TouchGal 官方补丁资源' : 'TouchGal 官方（推荐下载）'}
          description={
            selectedBucket === 'patch'
              ? '来自 TouchGal 的官方补丁资源'
              : 'TouchGal 官方提供的 Galgame 下载资源'
          }
          avatarSrc={selectedBucket === 'patch' ? 'https://api.dicebear.com/7.x/icons/svg?seed=kun-patch' : '/favicon.ico'}
          resources={official}
          resourceUpdateTime={resourceUpdatedAt}
        />
      )}

      {community.length > 0 && (
        <GroupCard
          title="TouchGal 社区下载资源"
          description="来自 TouchGal 用户自行发布的下载资源"
          avatarSrc="https://api.dicebear.com/7.x/bottts/svg?seed=touchgal-community"
          resources={community}
          resourceUpdateTime={resourceUpdatedAt}
        />
      )}

      {official.length === 0 && community.length === 0 && (
        <div className="bg-white rounded-[2rem] p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center gap-4">
          <Globe size={64} className="text-slate-200" />
          <h2 className="text-xl font-black text-slate-800">
            {selectedBucket === 'patch' ? 'Galgame 补丁' : 'Galgame 资源'}
          </h2>
          <p className="text-slate-500 font-medium">
            当前分类下还没有可用内容。总计：资源 {galgameCount} 条，补丁 {patchCount} 条。
          </p>
        </div>
      )}
    </div>
  );
};
