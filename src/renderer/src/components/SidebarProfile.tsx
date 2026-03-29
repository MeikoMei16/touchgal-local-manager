import React from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { User } from 'lucide-react';

interface SidebarProfileProps {
  active: boolean;
  onClick: () => void;
}

const SidebarProfile: React.FC<SidebarProfileProps> = ({ active, onClick }) => {
  const { user, setIsLoginOpen } = useTouchGalStore();

  if (!user) {
    return (
      <div 
        className={`nav-item ${active ? 'active' : ''}`}
        onClick={() => setIsLoginOpen(true)}
      >
        <div className="icon-wrapper">
          <User size={24} />
        </div>
        <span className="label">Login</span>
      </div>
    );
  }

  return (
    <div 
      className={`nav-item ${active ? 'active' : ''} group`}
      onClick={onClick}
    >
      <div className="p-0.5 rounded-full border-2 border-transparent group-hover:border-blue-400 transition-all duration-300">
        <img 
          src={user.avatar || 'https://via.placeholder.com/32'} 
          alt={user.name} 
          className="w-8 h-8 rounded-full object-cover shadow-sm"
        />
      </div>
      <span className="label mt-1">{user.name}</span>
    </div>
  );
};

export default SidebarProfile;
