import React, { useState } from 'react';
import { Download as DownloadIcon, Home as HomeIcon, Search, Library as LibraryIcon, Settings, Heart as HeartIcon, User as UserIcon, BadgeInfo } from 'lucide-react';
import { Home } from './components/Home';
import { Library } from './components/Library';
import { DetailOverlay } from './components/DetailOverlay';
import { LoginModal } from './components/LoginModal';
import { SearchView } from './components/SearchView';
import { FavoritesView } from './components/FavoritesView';
import ProfileView from './components/ProfileView';
import SettingsView from './components/SettingsView';
import DownloadsView from './components/DownloadsView';
import AboutView from './components/AboutView';
import AppToastViewport from './components/AppToastViewport';
import { useAuthStore } from './store/useTouchGalStore';
import type { DownloadQueueTask } from './types/electron';

const APP_NAV_STORAGE_KEY = 'touchgal-active-nav-tab';
const APP_NAV_IDS = ['home', 'search', 'library', 'downloads', 'favorites', 'profile', 'settings', 'about'] as const;
type AppNavTab = typeof APP_NAV_IDS[number];

const normalizeAppNavTab = (value: unknown): AppNavTab =>
  typeof value === 'string' && APP_NAV_IDS.includes(value as AppNavTab)
    ? (value as AppNavTab)
    : 'home';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppNavTab>(() => {
    if (typeof window === 'undefined') return 'home';
    return normalizeAppNavTab(window.localStorage.getItem(APP_NAV_STORAGE_KEY));
  });
  const [downloadTasks, setDownloadTasks] = useState<DownloadQueueTask[]>([]);
  const { isLoginOpen, restoreSession } = useAuthStore();

  const navItems: Array<{ id: AppNavTab; icon: React.ReactNode; label: string }> = [
    { id: 'home', icon: <HomeIcon size={24} />, label: '首页' },
    { id: 'search', icon: <Search size={24} />, label: '搜索' },
    { id: 'library', icon: <LibraryIcon size={24} />, label: '库' },
    { id: 'downloads', icon: <DownloadIcon size={24} />, label: '下载' },
    { id: 'favorites', icon: <HeartIcon size={24} />, label: '收藏夹' },
    { id: 'profile', icon: <UserIcon size={24} />, label: '我的' },
  ];

  React.useEffect(() => {
    window.localStorage.setItem(APP_NAV_STORAGE_KEY, activeTab);
  }, [activeTab]);

  React.useEffect(() => {
    const handleNav = () => setActiveTab('profile');
    window.addEventListener('nav-to-profile', handleNav);
    return () => window.removeEventListener('nav-to-profile', handleNav);
  }, []);

  React.useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  React.useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      try {
        const queue = await window.api.getDownloadQueue();
        if (!cancelled) {
          setDownloadTasks(queue);
        }
      } catch {
        if (!cancelled) {
          setDownloadTasks([]);
        }
      }
    };

    void loadQueue();
    const unsubscribe = window.api.onDownloadQueueUpdated((queue) => {
      setDownloadTasks(queue);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const inProgressDownloadCount = downloadTasks.filter(
    (task) => task.status !== 'done' && task.status !== 'error'
  ).length;

  const activeLabel = activeTab === 'settings'
    ? '设置'
    : activeTab === 'about'
      ? '关于'
      : navItems.find((item) => item.id === activeTab)?.label ?? '首页';

  return (
    <div className="flex h-screen bg-surface text-on-surface">
      <nav className="w-20 bg-surface border-r border-surface-variant flex flex-col items-center pt-10 gap-3">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-[#0369a1] to-[#0ea5e9] shadow-lg shadow-primary/20" />
        </div>
        
        <div className="flex-1 flex flex-col gap-4 w-full items-center">
          {navItems.map((item) => (
            <div 
              key={item.id}
              className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-200 group w-14 h-14 rounded-2xl ${activeTab === item.id ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container'}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="relative flex items-center justify-center">
                {item.icon}
                {item.id === 'downloads' && inProgressDownloadCount > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white shadow-sm">
                    {inProgressDownloadCount > 99 ? '99+' : inProgressDownloadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-5 border-t border-outline-variant w-full flex flex-col items-center gap-3 pb-3">
          <div
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer w-14 h-14 rounded-2xl transition-all ${
              activeTab === 'settings'
                ? 'bg-primary-container text-on-primary-container font-bold'
                : 'text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container'
            }`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={22} />
            <span className="text-[10px] font-medium">设置</span>
          </div>
          <div
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer w-14 h-14 rounded-2xl transition-all ${
              activeTab === 'about'
                ? 'bg-primary-container text-on-primary-container font-bold'
                : 'text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container'
            }`}
            onClick={() => setActiveTab('about')}
          >
            <BadgeInfo size={22} />
            <span className="text-[10px] font-medium">关于</span>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 px-6 flex items-center justify-between border-b border-outline-variant bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">{activeLabel}</h2>
          <div className="top-bar-actions">
            {/* UserMenu moved back to Home.tsx action bar */}
          </div>
        </header>

        <section
          className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50/50 outline-hidden"
          data-app-scroll-container="true"
          tabIndex={0}
        >
          {activeTab === 'home' && <Home />}
          {activeTab === 'search' && <SearchView />}
          {activeTab === 'library' && <Library />}
          {activeTab === 'downloads' && <DownloadsView />}
          {activeTab === 'favorites' && <FavoritesView />}
          {activeTab === 'profile' && <ProfileView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'about' && <AboutView />}
        </section>
      </main>

      <DetailOverlay />
      <AppToastViewport />
      {isLoginOpen && <LoginModal />}
    </div>
  );
};

export default App;
