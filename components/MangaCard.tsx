
import React from 'react';
import { Manga } from '../types';
import { useNavigate } from 'react-router-dom';

interface MangaCardProps {
  manga: Manga;
}

export const MangaCard: React.FC<MangaCardProps> = ({ manga }) => {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/manga/${manga.id}`)}
      className="group relative bg-[#0f0f0f] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/10 border border-white/5"
    >
      <div className="aspect-[2/3] overflow-hidden relative">
        <img 
          src={manga.coverUrl} 
          alt={manga.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-3 right-3 bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg">
          {manga.rating}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
           <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Унших</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-extrabold text-white truncate group-hover:text-indigo-400 transition-colors">{manga.title}</h3>
        <div className="flex items-center gap-2 mt-2">
            <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-tighter ${manga.status === 'Ongoing' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                {manga.status}
            </span>
            <span className="text-[9px] text-zinc-500 font-bold">
                {manga.chapters.length} CHAPTERS
            </span>
        </div>
      </div>
    </div>
  );
};
