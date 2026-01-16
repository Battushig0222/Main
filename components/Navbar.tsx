
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User } from '../types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onOpenAuth }) => {
  const isAdmin = user?.username === 'Battushig';

  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-4 md:px-8 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-2xl font-black tracking-tighter text-white hover:text-blue-500 transition-colors">
          MANGA<span className="text-blue-600">SPHERE</span>
        </Link>

        <div className="flex items-center space-x-6">
          <Link to="/" className="text-sm font-medium hover:text-blue-400 transition-colors hidden md:block">Нүүр</Link>
          
          {isAdmin && (
            <Link 
              to="/admin" 
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-full transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Манга нэмэх
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400 hidden sm:block">Сайн уу, {user.username}</span>
              <button 
                onClick={onLogout}
                className="text-xs font-bold border border-white/10 hover:border-red-500/50 hover:text-red-500 px-4 py-2 rounded transition-all"
              >
                Гарах
              </button>
            </div>
          ) : (
            <button 
              onClick={onOpenAuth}
              className="bg-white/5 hover:bg-white/10 text-white text-sm font-bold px-6 py-2 rounded transition-all border border-white/10"
            >
              Нэвтрэх
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
