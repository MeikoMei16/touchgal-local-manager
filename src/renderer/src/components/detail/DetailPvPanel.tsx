import React from 'react';
import { ExternalLink } from 'lucide-react';

interface DetailPvPanelProps {
  pvUrl: string;
}

const toEmbedUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.pathname.replace('/', '');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (parsed.hostname.includes('bilibili.com')) {
      const match = parsed.pathname.match(/\/video\/(BV[\w]+)/i);
      return match?.[1] ? `https://player.bilibili.com/player.html?bvid=${match[1]}&page=1` : null;
    }

    if (parsed.hostname.includes('player.bilibili.com')) {
      return url;
    }

    if (/\.(mp4|webm|ogg|mov|m3u8|flv)(\?.*)?$/i.test(parsed.pathname)) {
      return url;
    }
  } catch {
    return null;
  }

  return null;
};

export const DetailPvPanel: React.FC<DetailPvPanelProps> = ({ pvUrl }) => {
  const embedUrl = toEmbedUrl(pvUrl);
  const isDirectVideo = /\.(mp4|webm|ogg|mov|m3u8|flv)(\?.*)?$/i.test(pvUrl);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">PV鉴赏</h2>
        <a
          href={pvUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700"
        >
          <span>打开原链接</span>
          <ExternalLink size={16} />
        </a>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl">
        {embedUrl ? (
          isDirectVideo ? (
            <video controls src={embedUrl} className="aspect-video h-full w-full" />
          ) : (
            <iframe
              src={embedUrl}
              title="PV Viewer"
              className="aspect-video h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )
        ) : (
          <div className="flex aspect-video items-center justify-center p-8 text-center">
            <div className="flex max-w-md flex-col items-center gap-3 text-slate-300">
              <p className="text-lg font-black text-white">当前 PV 链接无法直接嵌入</p>
              <p className="text-sm font-medium text-slate-400 break-all">{pvUrl}</p>
              <a
                href={pvUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-900 hover:bg-slate-100"
              >
                <span>前往查看</span>
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
