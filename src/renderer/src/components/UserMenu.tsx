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
        className="flex items-center gap-2 px-4.5 bg-slate-200 text-slate-900 border-none rounded-full font-black text-sm cursor-pointer transition-all h-11 hover:bg-slate-300 active:scale-95 shadow-sm"
        onClick={() => setIsLoginOpen(true)}
      >
        <User size={18} />
        <span className="whitespace-nowrap">登录</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button 
        className="flex items-center gap-3 pl-5 pr-1 py-1 bg-slate-200 border-none rounded-full transition-all h-11 cursor-pointer hover:bg-slate-300 active:bg-slate-300 active:shadow-inner group"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        <span className="font-black text-sm text-slate-800 max-w-[120px] truncate">{user.name}</span>
        
        <img 
          src={user.avatar || 'https://via.placeholder.com/32'} 
          alt={user.name} 
          className="w-[34px] h-[34px] rounded-full object-cover border-2 border-white shadow-sm"
        />
      </button>

      {isMenuOpen && (
        <div className="absolute top-[calc(100%+8px)] right-0 min-w-[200px] bg-white rounded-2xl border border-slate-200 p-1.5 z-[1000] shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <button 
             className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-none bg-transparent text-slate-500 font-bold text-[13px] cursor-pointer transition-all text-left hover:bg-slate-100 hover:text-primary group/item"
             onClick={() => {
                const navEvent = new CustomEvent('nav-to-profile');
                window.dispatchEvent(navEvent);
                setIsMenuOpen(false);
             }}
          >
            <UserCircle size={18} className="group-hover/item:scale-110 transition-transform" />
            <span>个人中心 (Profile)</span>
          </button>
          
          <div className="h-px bg-slate-100 mx-1.5 my-1" />
          
          <button 
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-none bg-transparent text-slate-500 font-bold text-[13px] cursor-pointer transition-all text-left hover:bg-red-50 hover:text-red-500 group/logout"
            onClick={() => {
              logout();
              setIsMenuOpen(false);
            }}
          >
            <LogOut size={18} className="group-hover/logout:translate-x-0.5 transition-transform" />
            <span>退出登录 (Logout)</span>
          </button>
        </div>
      )}
    </div>
  );
};
