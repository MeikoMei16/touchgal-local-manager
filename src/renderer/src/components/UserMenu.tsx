import React, { useState, useRef, useEffect } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { User, LogOut, UserCircle } from 'lucide-react';

export const UserMenu: React.FC = () => {
  const { user, logout, setIsLoginOpen } = useTouchGalStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button 
        className="icon-pill" 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 18px', borderRadius: '40px', border: 'none', background: '#e2e8f0', color: '#1e293b', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', height: '44px' }}
        onClick={() => setIsLoginOpen(true)}
      >
        <User size={18} />
        <span style={{ whiteSpace: 'nowrap' }}>登录</span>
      </button>
    );
  }

  return (
    <div className="user-menu-pill-wrapper" ref={menuRef} style={{ position: 'relative' }}>
      <button 
        className={`user-info-pill-home ${isMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 4px 4px 20px', background: '#e2e8f0', border: 'none', borderRadius: '40px', transition: 'all 0.2s', height: '44px', cursor: 'pointer' }}
      >
        <span className="username-home" style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
        
        <img 
          src={user.avatar || 'https://via.placeholder.com/32'} 
          alt={user.name} 
          className="user-avatar-pill"
          style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }}
        />
      </button>

      {isMenuOpen && (
        <div className="dropdown-menu-home animate-in fade-in zoom-in-95 duration-200" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '200px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '6px', zIndex: 1000, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
          <button 
             className="menu-item-home"
             onClick={() => {
                // Navigate to profile
                const navEvent = new CustomEvent('nav-to-profile');
                window.dispatchEvent(navEvent);
                setIsMenuOpen(false);
             }}
             style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
          >
            <UserCircle size={18} />
            <span>个人中心 (Profile)</span>
          </button>
          
          <div className="menu-divider-home" style={{ height: '1px', background: '#f1f5f9', margin: '4px 6px' }} />
          
          <button 
            className="menu-item-home logout"
            onClick={() => {
              logout();
              setIsMenuOpen(false);
            }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
          >
            <LogOut size={18} />
            <span>退出登录 (Logout)</span>
          </button>
        </div>
      )}

      <style>{`
        .user-info-pill-home:hover { background: #cbd5e1 !important; }
        .user-info-pill-home.active { background: #cbd5e1 !important; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05) !important; }
        
        .menu-item-home:hover { background: #f1f5f9; color: #0ea5e9; }
        .menu-item-home.logout:hover { background: #fef2f2 !important; color: #ef4444 !important; }
      `}</style>
    </div>
  );
};
