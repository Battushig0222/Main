
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
      className="group relative bg-[#1a1a1a] rounded-lg overflow-hidden cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/20"
    >
      <div className="aspect-[2/3] overflow-hidden">
        <img 
          src={manga.coverUrl} 
          alt={manga.title} 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
          {manga.rating}
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-bold truncate group-hover:text-blue-400">{manga.title}</h3>
        <p className="text-xs text-gray-400 mt-1">{manga.genre[0]}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-[10px] px-2 py-0.5 rounded ${manga.status === 'Ongoing' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
            {manga.status}
          </span>
          <span className="text-[10px] text-gray-500">
            {manga.chapters.length} Бүлэг
          </span>
        </div>
      </div>
    </div>
  );
};
