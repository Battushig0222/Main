
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Manga, User, AuthState, Chapter } from './types';
import { INITIAL_MANGA, ADMIN_CREDENTIALS, SUPABASE_CONFIG } from './constants';
import { Navbar } from './components/Navbar';
import { MangaCard } from './components/MangaCard';

// Utility to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// --- Supabase Client Utility ---
let supabaseInstance: any = null;
const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;
  try {
    supabaseInstance = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    return supabaseInstance;
  } catch (e) {
    console.error("Supabase creation failed", e);
  }
  return null;
};

// --- Image Editor (Basic Drawing/Rotation) ---
const ImageEditor: React.FC<{
  src: string;
  onSave: (newSrc: string) => void;
  onClose: () => void;
}> = ({ src, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#6366f1');
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const isVertical = rotation % 180 !== 0;
      canvas.width = isVertical ? img.height : img.width;
      canvas.height = isVertical ? img.width : img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      setHistory([canvas.toDataURL()]);
    };
    img.src = src;
  }, [src, rotation]);

  const startDrawing = (e: any) => {
    if (!isDrawingMode) return;
    setIsDrawing(true);
    draw(e);
  };
  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      if (canvasRef.current) setHistory(prev => [...prev, canvasRef.current!.toDataURL()]);
    }
    canvasRef.current?.getContext('2d')?.beginPath();
  };
  const draw = (e: any) => {
    if (!isDrawing || !isDrawingMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = brushColor;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/95 flex flex-col p-4 md:p-10">
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full gap-4">
        <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex gap-2">
            <button onClick={() => setIsDrawingMode(!isDrawingMode)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isDrawingMode ? 'bg-indigo-600' : 'bg-white/5'}`}>Зурах Mode</button>
            <button onClick={() => setRotation(r => r + 90)} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold">Эргүүлэх</button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold">Болих</button>
            <button onClick={() => canvasRef.current && onSave(canvasRef.current.toDataURL('image/jpeg', 0.8))} className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20">Хадгалах</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-black rounded-[2rem] flex items-center justify-center p-4 border border-white/5">
          <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="max-w-full max-h-full shadow-2xl rounded-lg" />
        </div>
      </div>
    </div>
  );
};

// --- Manga Edit Modal ---
const MangaEditModal: React.FC<{
  manga: Manga;
  onClose: () => void;
  onSave: (updated: Manga) => void;
  onDelete: () => void;
}> = ({ manga, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState(manga.title);
  const [author, setAuthor] = useState(manga.author);
  const [description, setDescription] = useState(manga.description);
  const [coverUrl, setCoverUrl] = useState(manga.coverUrl);
  const [status, setStatus] = useState(manga.status);
  const [isEditingCover, setIsEditingCover] = useState(false);

  const handleSave = () => {
    onSave({ ...manga, title, author, description, coverUrl, status });
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      {isEditingCover && (
        <ImageEditor 
          src={coverUrl} 
          onClose={() => setIsEditingCover(false)} 
          onSave={(newSrc) => { setCoverUrl(newSrc); setIsEditingCover(false); }} 
        />
      )}
      <div className="bg-[#0f0f0f] w-full max-w-2xl p-8 md:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black text-white italic">EDIT <span className="text-indigo-500">MANGA</span></h2>
          <button onClick={onClose} className="text-zinc-500 bg-white/5 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 hover:text-white transition-all">&times;</button>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Манга нэр</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-600 outline-none transition-all font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Зохиолч</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-600 outline-none transition-all font-bold" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Статус</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white outline-none font-bold">
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Тайлбар</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white h-32 outline-none focus:border-indigo-600 transition-all font-medium leading-relaxed" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Нүүр зураг</label>
            <div className="flex flex-col gap-4">
              <div className="relative group/cover w-full max-h-[200px] overflow-hidden rounded-2xl border border-white/5 shadow-inner bg-black">
                <img src={coverUrl} className="w-full h-full object-contain opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <button 
                    onClick={() => setIsEditingCover(true)}
                    className="bg-indigo-600 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-transform"
                  >
                    Зураг засах
                  </button>
                </div>
              </div>
              <input type="file" accept="image/*" onChange={async e => { if (e.target.files && e.target.files[0]) setCoverUrl(await fileToBase64(e.target.files[0])); }} className="hidden" id="edit-cover-file" />
              <label htmlFor="edit-cover-file" className="block bg-zinc-900 border border-white/5 p-4 rounded-2xl text-center cursor-pointer hover:bg-zinc-800 transition-all">
                <span className="text-xs text-zinc-400 font-bold">Шинэ зураг оруулах</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
          <button onClick={handleSave} className="w-full bg-indigo-600 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all">Өөрчлөлтийг хадгалах</button>
          <button onClick={() => { if(window.confirm('Мангаг бүхэлд нь устгах уу?')) onDelete(); }} className="w-full bg-red-600/10 text-red-500 py-4 rounded-2xl font-black uppercase tracking-widest border border-red-600/20 hover:bg-red-600 hover:text-white transition-all">Мангаг устгах</button>
        </div>
      </div>
    </div>
  );
};

// --- Chapter Editor Modal ---
const ChapterEditorModal: React.FC<{ chapter: Chapter; onClose: () => void; onSave: (updated: Chapter) => void; }> = ({ chapter, onClose, onSave }) => {
  const [num, setNum] = useState(chapter.number.toString());
  const [title, setTitle] = useState(chapter.title);
  const [pages, setPages] = useState<string[]>(chapter.pages);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const handleAddPages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const base64s = await Promise.all(Array.from(e.target.files).map((f: File) => fileToBase64(f)));
    setPages(prev => [...prev, ...base64s]);
  };

  const handleFinalSave = () => {
    const parsedNum = parseFloat(num);
    if (isNaN(parsedNum)) {
      alert("Бүлгийн дугаар зөвхөн тоо байх ёстой.");
      return;
    }
    onSave({ ...chapter, number: parsedNum, title, pages });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
      {editingIdx !== null && <ImageEditor src={pages[editingIdx]} onClose={() => setEditingIdx(null)} onSave={src => { const p = [...pages]; p[editingIdx] = src; setPages(p); setEditingIdx(null); }} />}
      <div className="bg-[#0f0f0f] w-full max-w-6xl p-8 rounded-[3rem] border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black text-white italic">EDIT <span className="text-indigo-500">CHAPTER</span></h2>
          <button onClick={onClose} className="text-zinc-500 bg-white/5 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all">&times;</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          <div className="space-y-6">
            <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Бүлэг #</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={num} 
                  onChange={e => setNum(e.target.value)} 
                  className="w-full bg-black border border-white/5 rounded-xl p-3 text-white outline-none focus:border-indigo-600 font-bold" 
                  placeholder="1.0" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Гарчиг</label>
                <input 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="w-full bg-black border border-white/5 rounded-xl p-3 text-white outline-none focus:border-indigo-600 font-bold" 
                  placeholder="Гарчиг" 
                />
              </div>
            </div>
            <div className="space-y-3">
              <input type="file" multiple accept="image/*" id="chapter-add-pages" className="hidden" onChange={handleAddPages} />
              <label htmlFor="chapter-add-pages" className="w-full flex items-center justify-center gap-2 bg-indigo-600/10 text-indigo-400 p-4 rounded-2xl cursor-pointer hover:bg-indigo-600/20 transition-all font-black text-xs uppercase tracking-widest">Хуудас нэмэх</label>
              <button onClick={handleFinalSave} className="w-full bg-indigo-600 font-black py-5 rounded-2xl shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all uppercase tracking-widest text-xs">Хадгалах</button>
            </div>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-6 bg-black rounded-[2rem] min-h-[50vh] content-start border border-white/5">
            {pages.map((p, i) => (
              <div key={i} className="relative group aspect-[2/3] bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 transition-transform hover:scale-[1.02]">
                <img src={p} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity">
                  <button onClick={() => setEditingIdx(i)} className="bg-indigo-600 text-[10px] font-black uppercase tracking-widest px-5 py-2 rounded-full shadow-lg">Засах</button>
                  <button onClick={() => setPages(pages.filter((_, idx) => idx !== i))} className="bg-red-600 text-[10px] font-black uppercase tracking-widest px-5 py-2 rounded-full shadow-lg">Устгах</button>
                </div>
                <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-black text-white">{i + 1}</div>
              </div>
            ))}
            {pages.length === 0 && (
              <div className="col-span-full h-60 flex flex-col items-center justify-center text-zinc-600 gap-4 border-2 border-dashed border-white/5 rounded-[2rem]">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span className="font-bold uppercase tracking-widest text-xs">Зураг оруулаагүй байна.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Home Component ---
const Home: React.FC<{ mangaList: Manga[] }> = ({ mangaList }) => {
  const [search, setSearch] = useState('');
  const filtered = mangaList.filter(m => m.title.toLowerCase().includes(search.toLowerCase()) || m.author.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-16 space-y-6 pt-10">
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white">
          DISCOVER <br/> <span className="text-indigo-600">NEW STORIES</span>
        </h1>
        <div className="relative max-w-2xl">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Хайх (Нэр эсвэл Зохиолч)..." 
            className="w-full bg-[#0f0f0f] border border-white/5 rounded-[1.5rem] p-5 pl-14 text-white font-bold outline-none focus:border-indigo-600 transition-all shadow-xl"
          />
          <svg className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-10">
        {filtered.map(manga => <MangaCard key={manga.id} manga={manga} />)}
      </div>
      {filtered.length === 0 && (
        <div className="p-32 text-center">
            <div className="text-zinc-700 font-black text-4xl uppercase tracking-tighter opacity-30">No results found</div>
            <p className="text-zinc-500 mt-2 font-bold uppercase text-xs tracking-widest">Try another search term</p>
        </div>
      )}
    </div>
  );
};

// --- Manga Detail Component ---
const MangaDetail: React.FC<{ 
  mangaList: Manga[], 
  user: User | null, 
  onUpdateManga: (manga: Manga) => void,
  onDeleteManga: (id: string) => void
}> = ({ mangaList, user, onUpdateManga, onDeleteManga }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const manga = mangaList.find(m => m.id === id);
  
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [chNumber, setChNumber] = useState('');
  const [chTitle, setChTitle] = useState('');
  const [chPages, setChPages] = useState<string[]>([]);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingManga, setEditingManga] = useState(false);

  const isAdmin = user?.username === 'Battushig';
  if (!manga) return <div className="p-40 text-center font-black text-4xl opacity-20">MANGA NOT FOUND</div>;

  const handleAddChapterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newChapter: Chapter = { id: `ch-${Date.now()}`, number: parseFloat(chNumber), title: chTitle, pages: chPages, createdAt: new Date().toLocaleDateString() };
    onUpdateManga({ ...manga, chapters: [...manga.chapters, newChapter] });
    setShowAddChapter(false); setChNumber(''); setChTitle(''); setChPages([]);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-16">
      {editingManga && <MangaEditModal manga={manga} onClose={() => setEditingManga(false)} onSave={u => { onUpdateManga(u); setEditingManga(false); }} onDelete={() => { onDeleteManga(manga.id); navigate('/'); }} />}
      {editingChapter && <ChapterEditorModal chapter={editingChapter} onClose={() => setEditingChapter(null)} onSave={u => { onUpdateManga({ ...manga, chapters: manga.chapters.map(c => c.id === u.id ? u : c) }); setEditingChapter(null); }} />}

      <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">
        <div className="w-full lg:w-[400px] shrink-0 space-y-10">
          <div className="relative group/main">
            <img src={manga.coverUrl} className="w-full rounded-[3rem] shadow-2xl border border-white/5 transition-all group-hover/main:brightness-50" />
            {isAdmin && (
              <button onClick={() => setEditingManga(true)} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/main:opacity-100 transition-opacity bg-black/40 rounded-[3rem] font-black uppercase tracking-[0.2em] text-xs">
                Edit Manga
              </button>
            )}
          </div>
          <div className="bg-[#0f0f0f] p-8 md:p-10 rounded-[2.5rem] border border-white/5 space-y-6 shadow-xl">
            <div className="flex justify-between font-bold"><span className="text-zinc-600 uppercase text-[10px] tracking-[0.2em]">Author</span><span className="text-sm text-white">{manga.author}</span></div>
            <div className="flex justify-between font-bold"><span className="text-zinc-600 uppercase text-[10px] tracking-[0.2em]">Status</span><span className="text-sm text-indigo-400">{manga.status}</span></div>
            <div className="flex justify-between font-bold"><span className="text-zinc-600 uppercase text-[10px] tracking-[0.2em]">Rating</span><span className="text-sm text-white">⭐ {manga.rating}</span></div>
          </div>
        </div>
        <div className="flex-1 space-y-14">
          <div className="space-y-8">
            <div className="flex justify-between items-start flex-wrap gap-6">
              <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tighter text-white">{manga.title}</h1>
              {isAdmin && (
                <button onClick={() => setShowAddChapter(!showAddChapter)} className="bg-indigo-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition-transform active:scale-95">
                  {showAddChapter ? 'Болих' : 'Add Chapter'}
                </button>
              )}
            </div>
            <p className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-3xl font-medium">{manga.description}</p>
          </div>

          {showAddChapter && (
            <form onSubmit={handleAddChapterSubmit} className="p-10 bg-[#0f0f0f] rounded-[3rem] space-y-8 border border-white/5 animate-slide-up shadow-2xl">
              <h3 className="text-xl font-black italic">NEW <span className="text-indigo-500">CHAPTER</span></h3>
              <div className="grid md:grid-cols-2 gap-6">
                <input type="number" step="0.1" value={chNumber} onChange={e => setChNumber(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold focus:border-indigo-600 outline-none" placeholder="Бүлэг #" required />
                <input value={chTitle} onChange={e => setChTitle(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold focus:border-indigo-600 outline-none" placeholder="Гарчиг" required />
              </div>
              <input type="file" multiple accept="image/*" className="hidden" id="chapter-pages-bulk" onChange={async e => { if (e.target.files) setChPages(await Promise.all(Array.from(e.target.files).map(f => fileToBase64(f)))); }} />
              <label htmlFor="chapter-pages-bulk" className="block border-2 border-dashed border-white/5 p-16 rounded-[2rem] text-center cursor-pointer hover:bg-white/5 transition-all text-zinc-500 font-black uppercase text-xs tracking-widest">
                {chPages.length > 0 ? `${chPages.length} PAGES SELECTED` : 'UPLOAD PAGES'}
              </label>
              <button className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all">Create Chapter</button>
            </form>
          )}

          <div className="space-y-8">
            <h2 className="text-4xl font-black italic flex items-center gap-6"><span className="w-3 h-12 bg-indigo-600 rounded-full"></span>CHAPTERS</h2>
            <div className="grid gap-4">
              {[...manga.chapters].sort((a,b) => b.number - a.number).map(chapter => (
                <div key={chapter.id} className="bg-[#0f0f0f] hover:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] flex items-center justify-between group transition-all border border-white/5 hover:border-indigo-500/30">
                  <div onClick={() => navigate(`/reader/${manga.id}/${chapter.id}`)} className="flex-1 cursor-pointer flex items-center gap-8">
                    <div className="text-indigo-600 font-black text-3xl italic min-w-[80px]">#{chapter.number}</div>
                    <div>
                      <div className="font-black text-xl text-white group-hover:text-indigo-400 transition-colors">{chapter.title}</div>
                      <div className="text-[10px] text-zinc-600 uppercase font-black mt-1 tracking-widest">{chapter.createdAt} • {chapter.pages.length} PAGES</div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => setEditingChapter(chapter)} className="p-4 bg-indigo-600/10 text-indigo-500 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all font-black text-[10px] uppercase">Edit</button>
                      <button onClick={() => window.confirm('Бүлгийг устгах уу?') && onUpdateManga({ ...manga, chapters: manga.chapters.filter(c => c.id !== chapter.id) })} className="p-4 bg-red-600/10 text-red-500 rounded-2xl hover:bg-red-600 hover:text-white transition-all font-black text-[10px] uppercase">Delete</button>
                    </div>
                  )}
                </div>
              ))}
              {manga.chapters.length === 0 && <div className="p-20 text-center text-zinc-700 font-black text-xl uppercase tracking-widest opacity-20 border-2 border-dashed border-white/5 rounded-[3rem]">No chapters yet</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Reader Component ---
const Reader: React.FC<{ mangaList: Manga[] }> = ({ mangaList }) => {
  const { mangaId, chapterId } = useParams<{ mangaId: string, chapterId: string }>();
  const manga = mangaList.find(m => m.id === mangaId);
  const chapter = manga?.chapters.find(c => c.id === chapterId);
  if (!chapter) return <div className="p-40 text-center font-black opacity-20 text-4xl">CHAPTER NOT FOUND</div>;
  return (
    <div className="bg-[#050505] min-h-screen">
      <div className="max-w-4xl mx-auto pb-32">
        <div className="sticky top-0 bg-[#050505]/90 backdrop-blur-2xl p-6 flex items-center justify-between z-50 border-b border-white/5">
          <button onClick={() => window.history.back()} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-white">←</button>
          <div className="text-center">
            <h2 className="font-black text-lg text-white truncate max-w-[200px]">{manga?.title}</h2>
            <p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.3em]">Chapter {chapter.number}</p>
          </div>
          <span className="text-[10px] bg-indigo-600/10 border border-indigo-600/20 px-4 py-2 rounded-full font-black text-indigo-400 uppercase tracking-widest">{chapter.pages.length} PAGES</span>
        </div>
        <div className="flex flex-col gap-1 mt-6">{chapter.pages.map((p, i) => <img key={i} src={p} className="w-full h-auto block shadow-2xl" loading="lazy" alt={`Page ${i+1}`} />)}</div>
        <div className="mt-20 p-10 bg-[#0f0f0f] rounded-[3rem] border border-white/5 text-center space-y-4">
             <div className="text-zinc-600 font-black uppercase text-xs tracking-widest">You have reached the end of the chapter</div>
             <button onClick={() => window.history.back()} className="bg-indigo-600 px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/20">Go Back</button>
        </div>
      </div>
    </div>
  );
};

// --- Admin Panel ---
const AdminPanel: React.FC<{ 
  mangaList: Manga[], 
  onAddManga: (m: Manga) => void,
  onSyncToCloud: () => void,
  onFetchFromCloud: () => void,
  onDeleteManga: (id: string) => void,
  cloudStatus: string,
}> = ({ mangaList, onAddManga, onSyncToCloud, onFetchFromCloud, onDeleteManga, cloudStatus }) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newManga: Manga = { id: `m-${Date.now()}`, title, author, description, coverUrl: coverUrl || 'https://picsum.photos/400/600', gallery: [], genre: ['Manga'], status: 'Ongoing', rating: 5.0, chapters: [] };
    onAddManga(newManga); navigate(`/manga/${newManga.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-16 space-y-20">
      <div className="bg-[#0f0f0f] p-10 md:p-16 rounded-[3.5rem] border border-white/5 shadow-2xl space-y-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[150px] -z-10"></div>
        <div className="flex items-center justify-between flex-wrap gap-8">
          <div>
              <h1 className="text-5xl font-black text-white italic tracking-tighter">ADMIN <span className="text-indigo-500">DASHBOARD</span></h1>
              <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest mt-2">Manage your collection and sync to cloud.</p>
          </div>
          <div className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${cloudStatus.includes('Амжилттай') ? 'bg-indigo-600/10 text-indigo-400 border-indigo-600/20' : 'bg-zinc-900 text-zinc-500 border-white/5'}`}>Status: {cloudStatus}</div>
        </div>
        <div className="flex flex-wrap gap-4 pt-10 border-t border-white/5">
          <button onClick={onSyncToCloud} className="bg-indigo-600 hover:bg-indigo-500 px-10 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-600/30 transition-all">Upload to Cloud</button>
          <button onClick={onFetchFromCloud} className="bg-zinc-900 hover:bg-zinc-800 border border-white/5 px-10 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all">Fetch from Cloud</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-16">
        <form onSubmit={handleSubmit} className="space-y-10 bg-[#0f0f0f] p-10 md:p-14 rounded-[3.5rem] border border-white/5 shadow-2xl">
          <h2 className="text-3xl font-black italic">ADD <span className="text-indigo-500">MANGA</span></h2>
          <div className="space-y-6">
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold focus:border-indigo-600 outline-none transition-all" placeholder="Title" required />
            <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold focus:border-indigo-600 outline-none transition-all" placeholder="Author" required />
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white h-44 focus:border-indigo-600 outline-none transition-all font-medium" placeholder="Description" required />
            <input type="file" accept="image/*" onChange={async e => { if (e.target.files && e.target.files[0]) setCoverUrl(await fileToBase64(e.target.files[0])); }} className="hidden" id="admin-cover-new" />
            <label htmlFor="admin-cover-new" className="block border-2 border-dashed border-white/5 p-12 rounded-[2rem] text-center cursor-pointer hover:bg-zinc-900 transition-all text-zinc-500 font-black uppercase text-[10px] tracking-[0.3em] leading-loose">
                {coverUrl ? 'COVER SELECTED' : 'CHOOSE COVER IMAGE'}
            </label>
            <button className="w-full bg-indigo-600 py-6 rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-indigo-600/40 hover:bg-indigo-500 transition-all text-sm">Register Manga</button>
          </div>
        </form>

        <div className="bg-[#0f0f0f] p-10 md:p-14 rounded-[3.5rem] border border-white/5 shadow-2xl space-y-10">
          <h2 className="text-3xl font-black italic">MANAGE <span className="text-indigo-500">RESOURCES</span></h2>
          <div className="grid gap-5 max-h-[700px] overflow-y-auto pr-4 scrollbar-hide">
            {mangaList.map(m => (
              <div key={m.id} className="flex items-center justify-between p-5 bg-black rounded-[2rem] border border-white/5 group hover:border-indigo-600/40 transition-all">
                <div className="flex items-center gap-6">
                  <img src={m.coverUrl} className="w-16 h-20 object-cover rounded-xl shadow-lg border border-white/10" />
                  <div>
                      <div className="font-black text-white text-lg group-hover:text-indigo-400 transition-colors">{m.title}</div>
                      <div className="text-[10px] text-zinc-500 font-black uppercase mt-1 tracking-widest">{m.chapters.length} CHAPTERS</div>
                  </div>
                </div>
                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => navigate(`/manga/${m.id}`)} className="p-4 bg-indigo-600/10 text-indigo-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all font-black text-[10px] uppercase">Edit</button>
                  <button onClick={() => { if(window.confirm('Устгах уу?')) onDeleteManga(m.id); }} className="p-4 bg-red-600/10 text-red-500 rounded-2xl hover:bg-red-600 hover:text-white transition-all font-black text-[10px] uppercase">Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('auth_state');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false };
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [cloudStatus, setCloudStatus] = useState('Холбогдоогүй');

  useEffect(() => {
    const saved = localStorage.getItem('manga_list');
    if (saved) setMangaList(JSON.parse(saved));
    else setMangaList(INITIAL_MANGA);
    setTimeout(() => handleFetchFromCloud(), 1000);
  }, []);

  useEffect(() => {
    if (mangaList.length > 0) localStorage.setItem('manga_list', JSON.stringify(mangaList));
  }, [mangaList]);

  useEffect(() => {
    localStorage.setItem('auth_state', JSON.stringify(authState));
  }, [authState]);

  const handleSyncToCloud = async () => {
    const sb = getSupabase();
    if (!sb) return;
    setCloudStatus('Syncing...');
    try {
      for (const manga of mangaList) {
        const { error } = await sb.from('manga').upsert({ id: manga.id, data: manga });
        if (error) throw error;
      }
      setCloudStatus('Амжилттай хуулагдлаа');
      alert("Бүх мэдээлэл Cloud-руу хадгалагдлаа!");
    } catch (e: any) {
      setCloudStatus('Error: ' + e.message);
    }
  };

  const handleFetchFromCloud = async () => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const { data, error } = await sb.from('manga').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        setMangaList(data.map((item: any) => item.data));
        setCloudStatus('Амжилттай татлаа');
      }
    } catch (e: any) {
      setCloudStatus('Error: ' + e.message);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const role = (authForm.username === ADMIN_CREDENTIALS.username && authForm.password === ADMIN_CREDENTIALS.password) ? 'admin' : 'user';
    setAuthState({ user: { username: authForm.username, role: role as 'admin'|'user' }, isAuthenticated: true });
    setShowAuthModal(false); setAuthForm({ username: '', password: '' });
  };

  const handleUpdateManga = (updated: Manga) => setMangaList(prev => prev.map(m => m.id === updated.id ? updated : m));
  const handleDeleteManga = async (id: string) => {
    const sb = getSupabase();
    if (sb) { try { await sb.from('manga').delete().eq('id', id); } catch (e) { console.error(e); } }
    setMangaList(prev => prev.filter(m => m.id !== id));
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col selection:bg-indigo-600 selection:text-white">
        <Navbar user={authState.user} onLogout={() => setAuthState({ user: null, isAuthenticated: false })} onOpenAuth={() => setShowAuthModal(true)} />
        <main className="flex-1 bg-[#050505]">
          <Routes>
            <Route path="/" element={<Home mangaList={mangaList} />} />
            <Route path="/manga/:id" element={<MangaDetail mangaList={mangaList} user={authState.user} onUpdateManga={handleUpdateManga} onDeleteManga={handleDeleteManga} />} />
            <Route path="/reader/:mangaId/:chapterId" element={<Reader mangaList={mangaList} />} />
            <Route path="/admin" element={authState.user?.username === 'Battushig' ? <AdminPanel mangaList={mangaList} onAddManga={m => setMangaList([m, ...mangaList])} onSyncToCloud={handleSyncToCloud} onFetchFromCloud={handleFetchFromCloud} onDeleteManga={handleDeleteManga} cloudStatus={cloudStatus} /> : <Home mangaList={mangaList} />} />
          </Routes>
        </main>
        {showAuthModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl">
            <div className="bg-[#0f0f0f] w-full max-w-md p-12 rounded-[3.5rem] border border-white/5 shadow-2xl scale-in">
              <h2 className="text-4xl font-black mb-10 text-white italic tracking-tighter">SIGN <span className="text-indigo-500">IN</span></h2>
              <form onSubmit={handleLogin} className="space-y-8">
                <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Username</label>
                    <input value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-indigo-600 transition-all" placeholder="Enter username" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-1">Password</label>
                    <input type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-indigo-600 transition-all" placeholder="Enter password" required />
                </div>
                <button className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-indigo-600/40 active:scale-95 transition-all text-xs">Authorize</button>
              </form>
              <button onClick={() => setShowAuthModal(false)} className="mt-8 w-full text-[10px] text-zinc-600 font-black hover:text-white transition-all uppercase tracking-[0.3em]">Cancel</button>
            </div>
          </div>
        )}
        <footer className="mt-20 p-16 text-center border-t border-white/5 bg-[#050505]">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex flex-col items-start gap-2">
                <div className="text-2xl font-black text-white italic tracking-tighter">RGT<span className="text-indigo-600">MANGA</span></div>
                <p className="text-zinc-600 font-bold uppercase text-[9px] tracking-[0.4em]">The Ultimate Reading Experience</p>
            </div>
            <div className="text-zinc-700 font-black uppercase text-[10px] tracking-[0.3em]">
                © 2026 RGT MEDIA GROUP. ALL RIGHTS RESERVED.
            </div>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
