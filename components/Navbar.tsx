
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
    <nav className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="group flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">R</div>
          <span className="text-xl font-black tracking-tighter text-white">
            RGT <span className="text-indigo-500">MANGA</span>
          </span>
        </Link>

        <div className="flex items-center space-x-4 md:space-x-8">
          <Link to="/" className="text-sm font-semibold text-gray-400 hover:text-white transition-colors hidden md:block">Нүүр</Link>
          
          {isAdmin && (
            <Link 
              to="/admin" 
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              Админ
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Хэрэглэгч</span>
                <span className="text-sm font-bold text-white">{user.username}</span>
              </div>
              <button 
                onClick={onLogout}
                className="text-xs font-black text-gray-500 hover:text-red-500 uppercase tracking-widest transition-all"
              >
                Гарах
              </button>
            </div>
          ) : (
            <button 
              onClick={onOpenAuth}
              className="bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-xl transition-all border border-white/5"
            >
              Нэвтрэх
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
