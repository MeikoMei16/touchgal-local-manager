import React, { useState } from 'react';
import { Home as HomeIcon, Search, Library as LibraryIcon, Settings, Heart as HeartIcon } from 'lucide-react';
import { Home } from './components/Home';
import { Library } from './components/Library';
import { DetailOverlay } from './components/DetailOverlay';
import { LoginModal } from './components/LoginModal';
import ProfileView from './components/ProfileView';
import SidebarProfile from './components/SidebarProfile';
import { useTouchGalStore } from './store/useTouchGalStore';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const { isLoginOpen, setIsLoginOpen } = useTouchGalStore();

  const navItems = [
    { id: 'home', icon: <HomeIcon size={24} />, label: 'Home' },
    { id: 'search', icon: <Search size={24} />, label: 'Search' },
    { id: 'library', icon: <LibraryIcon size={24} />, label: 'Library' },
    { id: 'favorites', icon: <HeartIcon size={24} />, label: 'Favorites' },
  ];

  return (
    <div className="app-container">
      <nav className="nav-rail">
        <div className="app-logo">
          <div className="logo-circle" />
        </div>
        
        <div className="nav-items-container">
          {navItems.map((item) => (
            <div 
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="icon-wrapper">
                {item.icon}
              </div>
              <span className="label">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="nav-footer">
          <SidebarProfile 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
          />
          <div className="nav-item">
            <div className="icon-wrapper">
              <Settings size={24} />
            </div>
            <span className="label">Settings</span>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <header className="top-bar">
          <h2 className="title">{navItems.find(i => i.id === activeTab)?.label}</h2>
          <div className="top-bar-actions">
            {/* Action buttons moved to local components */}
          </div>
        </header>

        <section className="scroll-area" tabIndex={0}>
          {activeTab === 'home' && <Home />}
          {activeTab === 'search' && <Home />}
          {activeTab === 'library' && <Library />}
          {activeTab === 'favorites' && <Home />}
          {activeTab === 'profile' && <ProfileView />}
        </section>
      </main>

      <DetailOverlay />
      {isLoginOpen && <LoginModal onClose={() => setIsLoginOpen(false)} />}

      <style>{`
        .app-container { display: flex; height: 100vh; background-color: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); }
        .nav-rail { width: 72px; background-color: var(--md-sys-color-surface-container-low); display: flex; flex-direction: column; align-items: center; padding: 16px 0; border-right: 1px solid var(--md-sys-color-outline-variant); }
        .app-logo { margin-bottom: 32px; }
        .logo-circle { width: 48px; height: 48px; border-radius: 16px; background: linear-gradient(135deg, #0369a1, #0ea5e9); box-shadow: 0 4px 12px rgba(3, 105, 161, 0.2); }
        
        .nav-items-container { flex: 1; display: flex; flex-direction: column; gap: 16px; width: 100%; }
        .nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; color: var(--md-sys-color-on-surface-variant); transition: all 0.2s; width: 100%; }
        .icon-wrapper { padding: 4px 20px; border-radius: 20px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .nav-item:hover .icon-wrapper { background-color: var(--md-sys-color-surface-variant); }
        .nav-item.active .icon-wrapper { background-color: #e0f2fe; color: #0369a1; }
        .nav-item.active { color: var(--md-sys-color-on-surface); font-weight: 700; }
        .nav-item .label { font-size: 11px; font-weight: 600; text-align: center; }
        
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .top-bar { height: 56px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--md-sys-color-outline-variant); background: rgba(255,255,255,0.8); backdrop-filter: blur(8px); }
        .title { font-size: 18px; font-weight: 800; margin: 0; color: #1e293b; }
        
        .scroll-area { flex: 1; overflow-y: auto; padding: 0; background: #f8fafc; outline: none; }
        .nav-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid var(--md-sys-color-outline-variant); width: 100%; }
        .placeholder { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 18px; color: #64748b; font-weight: 600; }
      `}</style>
    </div>
  );
};

export default App;
