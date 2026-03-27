import React, { useState } from 'react';
import { Home as HomeIcon, Search, Library as LibraryIcon, User, Settings, Info } from 'lucide-react';
import { Home } from './components/Home';
import { Library } from './components/Library';
import { DetailOverlay } from './components/DetailOverlay';
import { LoginModal } from './components/LoginModal';
import { useTouchGalStore } from './store/useTouchGalStore';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const { user, logout } = useTouchGalStore();

  const navItems = [
    { id: 'home', icon: <HomeIcon size={24} />, label: 'Home' },
    { id: 'search', icon: <Search size={24} />, label: 'Search' },
    { id: 'library', icon: <LibraryIcon size={24} />, label: 'Library' },
    { id: 'profile', icon: <User size={24} />, label: 'Profile' },
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
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="nav-footer">
          <div className="nav-item">
            <Settings size={24} />
            <span>Settings</span>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <header className="top-bar">
          <h2 className="title">{navItems.find(i => i.id === activeTab)?.label}</h2>
          <div className="top-bar-actions">
            {user ? (
              <div className="user-profile-mini" onClick={logout}>
                <span>{user.name || 'User'}</span>
              </div>
            ) : (
              <button className="primary-btn sm" onClick={() => setIsLoginOpen(true)}>
                Sign In
              </button>
            )}
            <button className="icon-btn">
              <Info size={20} />
            </button>
          </div>
        </header>

        <section className="scroll-area">
          {activeTab === 'home' && <Home />}
          {activeTab === 'search' && <Home />}
          {activeTab === 'library' && <Library />}
          {activeTab === 'profile' && <div className="placeholder">Profile view coming soon...</div>}
        </section>
      </main>

      <DetailOverlay />
      {isLoginOpen && <LoginModal onClose={() => setIsLoginOpen(false)} />}

      <style>{`
        .app-logo { margin-bottom: 24px; }
        .logo-circle { width: 42px; height: 42px; border-radius: 21px; background: linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-secondary)); box-shadow: 0 4px 12px rgba(0, 100, 147, 0.3); }
        .nav-items-container { flex: 1; display: flex; flex-direction: column; gap: 12px; }
        .nav-footer { margin-top: auto; margin-bottom: 24px; }
        .top-bar-actions { display: flex; align-items: center; gap: 12px; }
        .user-profile-mini { padding: 4px 12px; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); border-radius: var(--radius-xl); cursor: pointer; font-weight: 600; font-size: 14px; }
        .primary-btn.sm { padding: 6px 16px; font-size: 13px; }
        .icon-btn { width: 40px; height: 40px; border-radius: 20px; border: none; background: transparent; color: var(--md-sys-color-on-surface-variant); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; }
        .icon-btn:hover { background-color: var(--md-sys-color-surface-variant); }
        .placeholder { display: flex; align-items: center; justify-content: center; height: 300px; color: var(--md-sys-color-on-surface-variant); font-style: italic; }
      `}</style>
    </div>
  );
};

export default App;
