import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await logout();
    void navigate('/login');
  };

  return (
    <nav className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="text-white font-bold text-lg flex items-center gap-2">
          🛡️ <span>Security Bot</span>
        </Link>
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
          Servers
        </Link>
        <Link to="/bot/activity" className="text-gray-400 hover:text-white text-sm transition-colors">
          Bot Activity
        </Link>
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full" />
          <span className="text-gray-300 text-sm">{user.globalName ?? user.username}</span>
          <button
            onClick={() => void handleLogout()}
            className="text-gray-400 hover:text-white text-sm transition-colors ml-2"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
