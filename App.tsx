
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
  const [brushColor, setBrushColor] = useState('#3b82f6');
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
    <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col p-4">
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full gap-4">
        <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-2xl border border-white/10">
          <div className="flex gap-2">
            <button onClick={() => setIsDrawingMode(!isDrawingMode)} className={`px-4 py-2 rounded-xl text-xs font-bold ${isDrawingMode ? 'bg-blue-600' : 'bg-white/5'}`}>Зурах Mode</button>
            <button onClick={() => setRotation(r => r + 90)} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold">Эргүүлэх</button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold">Болих</button>
            <button onClick={() => canvasRef.current && onSave(canvasRef.current.toDataURL('image/jpeg', 0.8))} className="px-4 py-2 bg-blue-600 rounded-xl text-xs font-bold">Хадгалах</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-black rounded-3xl flex items-center justify-center p-4">
          <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="max-w-full max-h-full shadow-2xl" />
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

  const handleSave = () => {
    onSave({ ...manga, title, author, description, coverUrl, status });
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-[#111] w-full max-w-2xl p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black text-white">Манга Засах</h2>
          <button onClick={onClose} className="text-gray-400 bg-white/5 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">&times;</button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-black uppercase ml-1">Гарчиг</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white focus:border-blue-500 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-black uppercase ml-1">Зохиолч</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white focus:border-blue-500 outline-none" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-black uppercase ml-1">Төлөв</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none">
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-black uppercase ml-1">Тайлбар</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white h-32 outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-black uppercase ml-1">Нүүр зураг</label>
            <input type="file" accept="image/*" onChange={async e => { if (e.target.files && e.target.files[0]) setCoverUrl(await fileToBase64(e.target.files[0])); }} className="hidden" id="edit-cover-file" />
            <label htmlFor="edit-cover-file" className="block border-2 border-dashed border-white/10 p-4 rounded-2xl text-center cursor-pointer hover:bg-white/5 transition-all">
              <img src={coverUrl} className="h-24 mx-auto rounded-lg mb-2 shadow-lg" />
              <span className="text-xs text-gray-500 font-bold">Зураг солих</span>
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-4">
          <button onClick={handleSave} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all">Хадгалах</button>
          <button onClick={() => { if(window.confirm('Мангаг бүхэлд нь устгах уу?')) onDelete(); }} className="w-full bg-red-600/10 text-red-500 py-4 rounded-2xl font-black uppercase tracking-widest border border-red-600/20 hover:bg-red-600 hover:text-white transition-all">Устгах</button>
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      {editingIdx !== null && <ImageEditor src={pages[editingIdx]} onClose={() => setEditingIdx(null)} onSave={src => { const p = [...pages]; p[editingIdx] = src; setPages(p); setEditingIdx(null); }} />}
      <div className="bg-[#111] w-full max-w-6xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black text-white">Бүлэг Засах</h2>
          <button onClick={onClose} className="text-gray-400 bg-white/5 w-10 h-10 flex items-center justify-center rounded-full">&times;</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="space-y-6">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
              <input type="number" step="0.1" value={num} onChange={e => setNum(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white" placeholder="Бүлэг #" />
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white" placeholder="Гарчиг" />
            </div>
            <input type="file" multiple accept="image/*" id="chapter-add-pages" className="hidden" onChange={handleAddPages} />
            <label htmlFor="chapter-add-pages" className="w-full flex items-center justify-center gap-2 bg-blue-600/10 text-blue-400 p-4 rounded-xl cursor-pointer hover:bg-blue-600/20">Зураг нэмэх</label>
            <button onClick={() => onSave({ ...chapter, number: parseFloat(num), title, pages })} className="w-full bg-blue-600 font-black py-5 rounded-2xl shadow-xl shadow-blue-600/20">Хадгалах</button>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-black/40 rounded-3xl min-h-[40vh] content-start">
            {pages.map((p, i) => (
              <div key={i} className="relative group aspect-[2/3] bg-zinc-900 rounded-xl overflow-hidden border border-white/5">
                <img src={p} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity">
                  <button onClick={() => setEditingIdx(i)} className="bg-blue-600 text-[10px] font-bold px-4 py-1.5 rounded-full">Засах</button>
                  <button onClick={() => setPages(pages.filter((_, idx) => idx !== i))} className="bg-red-600 text-[10px] font-bold px-4 py-1.5 rounded-full">Устгах</button>
                </div>
              </div>
            ))}
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
      <div className="mb-12 space-y-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Шинэ Манганууд</h1>
        <div className="relative max-w-xl">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Хайх..." 
            className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 pl-12 text-white font-medium outline-none focus:border-blue-600 transition-all"
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8">
        {filtered.map(manga => <MangaCard key={manga.id} manga={manga} />)}
      </div>
      {filtered.length === 0 && <div className="p-20 text-center text-gray-600 font-bold">Ийм нэртэй манга олдсонгүй.</div>}
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
  if (!manga) return <div className="p-20 text-center">Манга олдсонгүй.</div>;

  const handleAddChapterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newChapter: Chapter = { id: `ch-${Date.now()}`, number: parseFloat(chNumber), title: chTitle, pages: chPages, createdAt: new Date().toLocaleDateString() };
    onUpdateManga({ ...manga, chapters: [...manga.chapters, newChapter] });
    setShowAddChapter(false); setChNumber(''); setChTitle(''); setChPages([]);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10">
      {editingManga && <MangaEditModal manga={manga} onClose={() => setEditingManga(false)} onSave={u => { onUpdateManga(u); setEditingManga(false); }} onDelete={() => { onDeleteManga(manga.id); navigate('/'); }} />}
      {editingChapter && <ChapterEditorModal chapter={editingChapter} onClose={() => setEditingChapter(null)} onSave={u => { onUpdateManga({ ...manga, chapters: manga.chapters.map(c => c.id === u.id ? u : c) }); setEditingChapter(null); }} />}

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
        <div className="w-full lg:w-96 shrink-0 space-y-8">
          <div className="relative group">
            <img src={manga.coverUrl} className="w-full rounded-[2.5rem] shadow-2xl border border-white/5 transition-all group-hover:brightness-50" />
            {isAdmin && (
              <button onClick={() => setEditingManga(true)} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-[2.5rem] font-black uppercase tracking-widest text-sm">
                Манга засах
              </button>
            )}
          </div>
          <div className="bg-zinc-900/40 p-8 rounded-[2rem] border border-white/5 space-y-4 backdrop-blur-sm">
            <div className="flex justify-between font-bold"><span className="text-gray-500 uppercase text-[10px] tracking-widest">Зохиолч</span><span className="text-sm">{manga.author}</span></div>
            <div className="flex justify-between font-bold"><span className="text-gray-500 uppercase text-[10px] tracking-widest">Төлөв</span><span className="text-sm text-blue-400">{manga.status}</span></div>
          </div>
        </div>
        <div className="flex-1 space-y-12">
          <div className="space-y-6">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <h1 className="text-5xl md:text-7xl font-black leading-tight">{manga.title}</h1>
              {isAdmin && (
                <button onClick={() => setShowAddChapter(!showAddChapter)} className="bg-blue-600 px-8 py-4 rounded-full font-black text-xs uppercase shadow-lg shadow-blue-600/30 transition-transform active:scale-95">
                  {showAddChapter ? 'Болих' : 'Бүлэг нэмэх'}
                </button>
              )}
            </div>
            <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-3xl">{manga.description}</p>
          </div>

          {showAddChapter && (
            <form onSubmit={handleAddChapterSubmit} className="p-8 md:p-10 bg-zinc-900 rounded-[2.5rem] space-y-6 border border-white/5 animate-slide-up">
              <div className="grid md:grid-cols-2 gap-4">
                <input type="number" step="0.1" value={chNumber} onChange={e => setChNumber(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white" placeholder="Бүлэг #" required />
                <input value={chTitle} onChange={e => setChTitle(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white" placeholder="Гарчиг" required />
              </div>
              <input type="file" multiple accept="image/*" className="hidden" id="chapter-pages-bulk" onChange={async e => { if (e.target.files) setChPages(await Promise.all(Array.from(e.target.files).map(f => fileToBase64(f)))); }} />
              <label htmlFor="chapter-pages-bulk" className="block border-2 border-dashed border-white/10 p-10 rounded-3xl text-center cursor-pointer hover:bg-white/5 transition-all text-gray-500 font-bold">Зургууд Сонгох ({chPages.length})</label>
              <button className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/30">Бүлэг үүсгэх</button>
            </form>
          )}

          <div className="space-y-6">
            <h2 className="text-3xl font-black flex items-center gap-4"><span className="w-2 h-10 bg-blue-600 rounded-full"></span>Бүлгүүд</h2>
            <div className="grid gap-3">
              {[...manga.chapters].sort((a,b) => b.number - a.number).map(chapter => (
                <div key={chapter.id} className="bg-white/5 hover:bg-white/10 p-6 rounded-[2rem] flex items-center justify-between group transition-all border border-white/5">
                  <div onClick={() => navigate(`/reader/${manga.id}/${chapter.id}`)} className="flex-1 cursor-pointer flex items-center gap-6">
                    <div className="text-blue-500 font-black text-2xl italic min-w-[70px]">Ch. {chapter.number}</div>
                    <div>
                      <div className="font-black text-xl text-gray-100">{chapter.title}</div>
                      <div className="text-[10px] text-gray-600 uppercase font-black mt-1 tracking-widest">{chapter.createdAt} • {chapter.pages.length} хуудас</div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => setEditingChapter(chapter)} className="p-3 bg-blue-600/10 text-blue-500 rounded-2xl hover:bg-blue-600 hover:text-white transition-all">Засах</button>
                      <button onClick={() => window.confirm('Бүлгийг устгах уу?') && onUpdateManga({ ...manga, chapters: manga.chapters.filter(c => c.id !== chapter.id) })} className="p-3 bg-red-600/10 text-red-500 rounded-2xl hover:bg-red-600 hover:text-white transition-all">Устгах</button>
                    </div>
                  )}
                </div>
              ))}
              {manga.chapters.length === 0 && <div className="p-12 text-center text-gray-600 font-bold border-2 border-dashed border-white/5 rounded-3xl">Бүлэг нэмэгдээгүй байна.</div>}
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
  if (!chapter) return <div className="p-20 text-center">Бүлэг олдсонгүй.</div>;
  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-4xl mx-auto pb-20">
        <div className="sticky top-0 bg-black/95 backdrop-blur-xl p-6 flex items-center justify-between z-50 border-b border-white/5">
          <button onClick={() => window.history.back()} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all">←</button>
          <div className="text-center">
            <h2 className="font-black text-lg text-white">{manga?.title}</h2>
            <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Chapter {chapter.number}</p>
          </div>
          <span className="text-[10px] bg-white/5 px-4 py-2 rounded-full font-black text-gray-500">{chapter.pages.length} хуудас</span>
        </div>
        <div className="flex flex-col gap-1 mt-4">{chapter.pages.map((p, i) => <img key={i} src={p} className="w-full h-auto block" loading="lazy" />)}</div>
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
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-12">
      <div className="bg-zinc-900 p-8 md:p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] -z-10"></div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h1 className="text-3xl font-black text-white">Админ Удирдах Хэсэг</h1><p className="text-gray-500 text-sm">Cloud Sync болон дата менежмент.</p></div>
          <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${cloudStatus.includes('Амжилттай') ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'}`}>Status: {cloudStatus}</div>
        </div>
        <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
          <button onClick={onSyncToCloud} className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition-all">Cloud-руу хуулах (Sync Up)</button>
          <button onClick={onFetchFromCloud} className="bg-zinc-800 hover:bg-zinc-700 px-8 py-3 rounded-2xl font-bold transition-all">Cloud-аас татах (Sync Down)</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        <form onSubmit={handleSubmit} className="space-y-8 bg-zinc-900 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
          <h2 className="text-2xl font-black">Шинэ Манга Нэмэх</h2>
          <div className="space-y-4">
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white focus:border-blue-600 outline-none" placeholder="Гарчиг" required />
            <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white focus:border-blue-600 outline-none" placeholder="Зохиолч" required />
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white h-40 focus:border-blue-600 outline-none" placeholder="Тайлбар" required />
            <input type="file" accept="image/*" onChange={async e => { if (e.target.files && e.target.files[0]) setCoverUrl(await fileToBase64(e.target.files[0])); }} className="hidden" id="admin-cover-new" />
            <label htmlFor="admin-cover-new" className="block border-2 border-dashed border-white/10 p-8 rounded-[2rem] text-center cursor-pointer hover:bg-white/5 transition-all text-gray-500 font-bold">{coverUrl ? 'Зураг сонгогдлоо' : '+ Нүүр зураг'}</label>
            <button className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20">Бүртгэх</button>
          </div>
        </form>

        <div className="bg-zinc-900 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
          <h2 className="text-2xl font-black">Манга Удирдах ({mangaList.length})</h2>
          <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
            {mangaList.map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 bg-black/40 rounded-3xl border border-white/5 group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-4">
                  <img src={m.coverUrl} className="w-12 h-16 object-cover rounded-xl shadow-lg" />
                  <div><div className="font-bold text-sm">{m.title}</div><div className="text-[10px] text-gray-500 font-black uppercase mt-1">{m.chapters.length} бүлэг</div></div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => navigate(`/manga/${m.id}`)} className="p-3 bg-blue-600/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all">Edit</button>
                  <button onClick={() => { if(window.confirm('Устгах уу?')) onDeleteManga(m.id); }} className="p-3 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all">Delete</button>
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
    setCloudStatus('Хуулж байна...');
    try {
      for (const manga of mangaList) {
        const { error } = await sb.from('manga').upsert({ id: manga.id, data: manga });
        if (error) throw error;
      }
      setCloudStatus('Амжилттай хуулагдлаа');
      alert("Бүх мэдээлэл Cloud-руу хадгалагдлаа!");
    } catch (e: any) {
      setCloudStatus('Алдаа: ' + e.message);
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
      setCloudStatus('Алдаа: ' + e.message);
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
      <div className="min-h-screen flex flex-col selection:bg-blue-600 selection:text-white">
        <Navbar user={authState.user} onLogout={() => setAuthState({ user: null, isAuthenticated: false })} onOpenAuth={() => setShowAuthModal(true)} />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home mangaList={mangaList} />} />
            <Route path="/manga/:id" element={<MangaDetail mangaList={mangaList} user={authState.user} onUpdateManga={handleUpdateManga} onDeleteManga={handleDeleteManga} />} />
            <Route path="/reader/:mangaId/:chapterId" element={<Reader mangaList={mangaList} />} />
            <Route path="/admin" element={authState.user?.username === 'Battushig' ? <AdminPanel mangaList={mangaList} onAddManga={m => setMangaList([m, ...mangaList])} onSyncToCloud={handleSyncToCloud} onFetchFromCloud={handleFetchFromCloud} onDeleteManga={handleDeleteManga} cloudStatus={cloudStatus} /> : <Home mangaList={mangaList} />} />
          </Routes>
        </main>
        {showAuthModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <div className="bg-zinc-900 w-full max-w-md p-10 rounded-[2.5rem] border border-white/5 shadow-2xl scale-in">
              <h2 className="text-3xl font-black mb-8">Нэвтрэх</h2>
              <form onSubmit={handleLogin} className="space-y-6">
                <input value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-600 transition-all" placeholder="Username" required />
                <input type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-600 transition-all" placeholder="Password" required />
                <button className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all">Үргэлжлүүлэх</button>
              </form>
              <button onClick={() => setShowAuthModal(false)} className="mt-6 w-full text-xs text-gray-600 font-bold hover:text-white transition-all uppercase tracking-widest">Болих</button>
            </div>
          </div>
        )}
        <footer className="mt-20 p-12 text-center border-t border-white/5 opacity-50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em]">
            <div>MANGA<span className="text-blue-600">SPHERE</span> MN</div>
            <p>© 2025 Бүх эрх хамгаалагдсан.</p>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
