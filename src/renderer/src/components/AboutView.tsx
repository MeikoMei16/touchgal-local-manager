import React from 'react';
import { BadgeInfo, ExternalLink, Heart, ShieldAlert, Sparkles } from 'lucide-react';

const cardClassName =
  'rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm';

const linkClassName =
  'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700';

const AboutView: React.FC = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <section className="overflow-hidden rounded-[2.4rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),linear-gradient(135deg,_#ffffff_0%,_#f7fbff_45%,_#eef7ff_100%)] p-8 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700 shadow-sm">
              <Sparkles size={14} />
              About This Project
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">关于 TouchGal Local Manager</h1>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-600">
              这是一个围绕 TouchGal 浏览、下载、解压、入库与本地管理流程而做的桌面客户端。
              它的目标不是替代原站，而是把本地使用体验做顺手，把“找到资源之后”的整条桌面工作流补完整。
            </p>
          </div>

          <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-[1.8rem] bg-white text-sky-700 shadow-sm">
            <BadgeInfo size={34} />
          </div>
        </div>
      </section>

      <section className={cardClassName}>
        <div className="flex items-center gap-3 text-slate-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <Heart size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-black">致谢与链接</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">感谢原站，也感谢一路上提供灵感、反馈和动力的人。</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            className={linkClassName}
            href="https://www.touchgal.top/"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={15} />
            原站：TouchGal
          </a>
          <a
            className={linkClassName}
            href="https://github.com/MeikoMei16/touchgal-local-manager"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={15} />
            项目仓库
          </a>
        </div>

        <div className="mt-5 space-y-3 text-sm font-medium leading-7 text-slate-600">
          <p>Made with love by <span className="font-black text-slate-900">Meiko Mei</span>.</p>
          <p>
            原始数据、资源索引、站点生态与相关归属均应以
            <a
              className="mx-1 font-black text-sky-700 underline decoration-sky-200 underline-offset-4"
              href="https://www.touchgal.top/"
              rel="noreferrer"
              target="_blank"
            >
              TouchGal 原站
            </a>
            为准。请支持原作者、支持原站。
          </p>
        </div>
      </section>

      <section className={cardClassName}>
        <div className="flex items-center gap-3 text-slate-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-black">免责声明</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">该页强调归属、用途边界与项目立场。</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-black text-slate-900">开源且免费</div>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
              本项目为开源且免费的第三方桌面工具，不售卖、不内置付费墙，不主张将其包装为商业闭源产品。
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-black text-slate-900">归属权说明</div>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
              游戏资源、站点内容、接口数据、名称与相关权利均归原权利人及原站生态所有，本项目仅提供本地管理与桌面交互层。
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-black text-slate-900">非官方项目</div>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
              本项目不是 TouchGal 官方客户端，也不代表原站立场；若原站接口、结构或政策变化，本项目行为也可能随之调整。
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-black text-slate-900">请优先支持原站</div>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
              如果你认可这个生态，请优先支持原站作者与维护者。本项目存在的前提，是原站先把内容与服务建立起来。
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-emerald-200 bg-linear-to-r from-emerald-50 via-white to-cyan-50 p-6 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Special Thanks</div>
        <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">本项目由 Linux.do 激励实现，成为可能。</div>
        <div className="mt-4 space-y-2 text-sm font-medium leading-7 text-slate-600">
          <p>学 AI，上 L 站！</p>
          <p>真诚、友善、团结、专业，共建你我引以为荣之社区。</p>
        </div>
      </section>
    </div>
  );
};

export default AboutView;
