
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Manga, User, AuthState, Chapter } from './types';
import { INITIAL_MANGA, ADMIN_CREDENTIALS } from './constants';
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

// --- Image Editor ---
const ImageEditor: React.FC<{
  src: string;
  onSave: (newSrc: string) => void;
  onClose: () => void;
}> = ({ src, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(5);
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

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingMode) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) setHistory(prev => [...prev, canvas.toDataURL()]);
    }
    canvasRef.current?.getContext('2d')?.beginPath();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawingMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = e.clientX; clientY = e.clientY; }
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = brushColor;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop();
    const prevState = newHistory[newHistory.length - 1];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && prevState) {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
      img.src = prevState;
      setHistory(newHistory);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black flex flex-col p-4 md:p-8">
      <div className="w-full max-w-6xl mx-auto flex flex-col h-full gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsDrawingMode(!isDrawingMode)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${isDrawingMode ? 'bg-blue-600' : 'bg-white/5 text-gray-400'}`}>Edit Mode</button>
            {isDrawingMode && <div className="flex items-center gap-4 pl-4 border-l border-white/10">
              <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} className="w-8 h-8 rounded bg-transparent border-none cursor-pointer" />
              <button onClick={handleUndo} className="p-2 hover:bg-white/10 rounded">Undo</button>
            </div>}
            <button onClick={() => setRotation(r => r + 90)} className="p-2 bg-white/5 rounded-xl">Rotate</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-6 py-2 rounded-xl bg-white/5">Cancel</button>
            <button onClick={() => canvasRef.current && onSave(canvasRef.current.toDataURL('image/jpeg', 0.7))} className="px-6 py-2 rounded-xl bg-blue-600">Save</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-zinc-950 rounded-3xl border border-white/5 flex items-center justify-center p-8">
          <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className={`max-w-full max-h-full object-contain shadow-2xl ${isDrawingMode ? 'cursor-crosshair' : ''}`} />
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
    const base64s = await Promise.all(Array.from(e.target.files).map(f => fileToBase64(f)));
    setPages(prev => [...prev, ...base64s]);
  };

  const movePage = (idx: number, direction: 'up' | 'down') => {
    const newPages = [...pages];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return;
    [newPages[idx], newPages[targetIdx]] = [newPages[targetIdx], newPages[idx]];
    setPages(newPages);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md overflow-y-auto">
      {editingIdx !== null && <ImageEditor src={pages[editingIdx]} onClose={() => setEditingIdx(null)} onSave={src => { const p = [...pages]; p[editingIdx] = src; setPages(p); setEditingIdx(null); }} />}
      <div className="bg-[#111] w-full max-w-6xl p-8 rounded-[2.5rem] border border-white/10 my-8 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black text-white">Бүлэг Засах</h2>
          <button onClick={onClose} className="text-gray-400 bg-white/5 w-10 h-10 flex items-center justify-center rounded-full">&times;</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="space-y-6">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
              <input type="number" step="0.1" value={num} onChange={e => setNum(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white" />
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white" />
            </div>
            <input type="file" multiple accept="image/*" id="edit-add" className="hidden" onChange={handleAddPages} />
            <label htmlFor="edit-add" className="w-full flex items-center justify-center gap-2 bg-blue-600/10 text-blue-400 p-4 rounded-xl cursor-pointer">Зураг нэмэх</label>
            <button onClick={() => onSave({ ...chapter, number: parseFloat(num), title, pages })} className="w-full bg-blue-600 font-black py-5 rounded-2xl shadow-xl shadow-blue-600/20">Хадгалах</button>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-4 bg-black/40 rounded-3xl">
            {pages.map((p, i) => (
              <div key={i} className="relative group aspect-[2/3] bg-zinc-900 rounded-xl overflow-hidden border border-white/5">
                <img src={p} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2">
                  <div className="flex gap-1">
                    <button onClick={() => movePage(i, 'up')} className="p-2 bg-white/10 rounded hover:bg-blue-600 transition-colors">↑</button>
                    <button onClick={() => movePage(i, 'down')} className="p-2 bg-white/10 rounded hover:bg-blue-600 transition-colors">↓</button>
                  </div>
                  <button onClick={() => setEditingIdx(i)} className="bg-blue-600 text-[10px] font-bold px-4 py-1.5 rounded-full">Edit</button>
                  <button onClick={() => setPages(pages.filter((_, idx) => idx !== i))} className="bg-red-600 text-[10px] font-bold px-4 py-1.5 rounded-full">Del</button>
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
const Home: React.FC<{ mangaList: Manga[] }> = ({ mangaList }) => (
  <div className="max-w-7xl mx-auto p-4 md:p-8">
    <div className="mb-10"><h1 className="text-4xl font-black mb-2">Шинэ Манганууд</h1><p className="text-gray-500 font-medium">Хамгийн сүүлд нэмэгдсэн бүтээлүүд.</p></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8">
      {mangaList.map(manga => <MangaCard key={manga.id} manga={manga} />)}
    </div>
  </div>
);

// --- Manga Detail Component ---
const MangaDetail: React.FC<{ mangaList: Manga[], user: User | null, onUpdateManga: (manga: Manga) => void }> = ({ mangaList, user, onUpdateManga }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const manga = mangaList.find(m => m.id === id);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [chNumber, setChNumber] = useState('');
  const [chTitle, setChTitle] = useState('');
  const [chPages, setChPages] = useState<string[]>([]);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);

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
      {editingChapter && <ChapterEditorModal chapter={editingChapter} onClose={() => setEditingChapter(null)} onSave={updated => { onUpdateManga({ ...manga, chapters: manga.chapters.map(c => c.id === updated.id ? updated : c) }); setEditingChapter(null); }} />}
      <div className="flex flex-col lg:flex-row gap-16">
        <div className="w-full lg:w-96 shrink-0 space-y-8">
          <img src={manga.coverUrl} className="w-full rounded-[2rem] shadow-2xl border border-white/5" />
          <div className="bg-zinc-900/50 p-8 rounded-[2rem] border border-white/5 space-y-4">
            <div className="flex justify-between font-bold"><span className="text-gray-500 uppercase text-xs">Зохиолч</span><span>{manga.author}</span></div>
            <div className="flex justify-between font-bold"><span className="text-gray-500 uppercase text-xs">Төлөв</span><span className="text-blue-400">{manga.status}</span></div>
          </div>
        </div>
        <div className="flex-1 space-y-12">
          <div className="flex justify-between items-start"><h1 className="text-6xl font-black">{manga.title}</h1>{isAdmin && <button onClick={() => setShowAddChapter(!showAddChapter)} className="bg-blue-600 px-8 py-4 rounded-full font-black text-xs uppercase">{showAddChapter ? 'Болих' : 'Бүлэг нэмэх'}</button>}</div>
          <p className="text-gray-400 text-xl leading-relaxed">{manga.description}</p>
          {showAddChapter && <form onSubmit={handleAddChapterSubmit} className="p-10 bg-zinc-900 rounded-[2.5rem] space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <input type="number" step="0.1" value={chNumber} onChange={e => setChNumber(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 text-white" placeholder="Бүлэг #" required />
              <input value={chTitle} onChange={e => setChTitle(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 text-white" placeholder="Гарчиг" required />
            </div>
            <input type="file" multiple accept="image/*" className="hidden" id="bulk-up" onChange={async e => { if (e.target.files) setChPages(await Promise.all(Array.from(e.target.files).map(f => fileToBase64(f)))); }} />
            <label htmlFor="bulk-up" className="block border-2 border-dashed border-white/10 p-10 rounded-[2rem] text-center cursor-pointer hover:bg-white/5 transition-all">Зургууд Сонгох ({chPages.length})</label>
            <button className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase shadow-xl shadow-blue-600/30">Хадгалах</button>
          </form>}
          <div className="space-y-4">
            <h2 className="text-3xl font-black flex items-center gap-4"><span className="w-2 h-10 bg-blue-600 rounded-full"></span>Бүлгүүд</h2>
            <div className="grid gap-3">
              {[...manga.chapters].sort((a,b) => b.number - a.number).map(chapter => (
                <div key={chapter.id} className="bg-white/5 hover:bg-white/10 p-6 rounded-3xl flex items-center justify-between group transition-all">
                  <div onClick={() => navigate(`/reader/${manga.id}/${chapter.id}`)} className="flex-1 cursor-pointer flex items-center gap-6">
                    <div className="text-blue-500 font-black text-2xl italic min-w-[60px]">Ch. {chapter.number}</div>
                    <div><div className="font-black text-xl text-gray-100">{chapter.title}</div><div className="text-[10px] text-gray-500 uppercase font-black mt-1">{chapter.createdAt} • {chapter.pages.length} хуудас</div></div>
                  </div>
                  {isAdmin && <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => setEditingChapter(chapter)} className="p-3 bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white">Edit</button>
                    <button onClick={() => window.confirm('Устгах уу?') && onUpdateManga({ ...manga, chapters: manga.chapters.filter(c => c.id !== chapter.id) })} className="p-3 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white">Del</button>
                  </div>}
                </div>
              ))}
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
        <div className="sticky top-0 bg-black/90 backdrop-blur-xl p-6 flex items-center justify-between z-50 border-b border-white/5">
          <button onClick={() => window.history.back()} className="p-2 bg-white/5 rounded-full">←</button>
          <div className="text-center"><h2 className="font-black text-lg text-white">{manga?.title}</h2><p className="text-[10px] text-blue-500 font-black uppercase">Ch. {chapter.number}</p></div>
          <span className="text-[10px] bg-white/5 px-4 py-2 rounded-full font-black text-gray-500">{chapter.pages.length} Pages</span>
        </div>
        <div className="flex flex-col gap-1 mt-4">{chapter.pages.map((p, i) => <img key={i} src={p} className="w-full h-auto block" loading="lazy" />)}</div>
      </div>
    </div>
  );
};

// --- Admin Panel (Backup & Restore included) ---
const AdminPanel: React.FC<{ mangaList: Manga[], setMangaList: (l: Manga[]) => void, onAddManga: (m: Manga) => void }> = ({ mangaList, setMangaList, onAddManga }) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const handleBackup = () => {
    const dataStr = JSON.stringify(mangaList);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'manga_database_backup.json');
    linkElement.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) { setMangaList(json); alert("Өгөгдлийг амжилттай сэргээлээ!"); }
      } catch (err) { alert("Буруу файл байна!"); }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newManga: Manga = { id: `m-${Date.now()}`, title, author, description, coverUrl: coverUrl || 'https://picsum.photos/400/600', gallery, genre: ['Manga'], status: 'Ongoing', rating: 5.0, chapters: [] };
    onAddManga(newManga); navigate(`/manga/${newManga.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10 space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-zinc-900 p-8 rounded-[2rem] border border-white/5 shadow-2xl">
        <div><h1 className="text-3xl font-black text-white">Админ Удирдлага</h1><p className="text-gray-500 text-sm">Мэдээллээ хадгалах эсвэл сэргээх боломжтой.</p></div>
        <div className="flex gap-4">
          <button onClick={handleBackup} className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-xl shadow-green-600/20">Backup (JSON Татах)</button>
          <input type="file" id="restore-file" className="hidden" accept=".json" onChange={handleRestore} />
          <label htmlFor="restore-file" className="bg-white/5 hover:bg-white/10 text-white font-bold px-6 py-3 rounded-2xl cursor-pointer border border-white/10 transition-all">Restore (Файл Унших)</label>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        <form onSubmit={handleSubmit} className="space-y-8 bg-zinc-900 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
          <h2 className="text-2xl font-black">Шинэ Манга Нэмэх</h2>
          <div className="space-y-4">
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white" placeholder="Гарчиг" required />
            <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white" placeholder="Зохиолч" required />
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white h-40" placeholder="Тайлбар" required />
            <input type="file" accept="image/*" onChange={async e => { if (e.target.files) setCoverUrl(await fileToBase64(e.target.files[0])); }} className="hidden" id="cover-pick" />
            <label htmlFor="cover-pick" className="block border-2 border-dashed border-white/10 p-8 rounded-[2rem] text-center cursor-pointer hover:bg-white/5">{coverUrl ? 'Нүүр зураг сонгогдлоо' : '+ Нүүр зураг'}</label>
            <button className="w-full bg-blue-600 py-5 rounded-2xl font-black tracking-widest uppercase shadow-xl shadow-blue-600/30">Бүртгэх</button>
          </div>
        </form>
        <div className="bg-blue-600/5 p-10 rounded-[2.5rem] border border-blue-600/10 space-y-6">
          <h3 className="text-xl font-black text-blue-400">💡 Вэбсайтыг нийтэд байршуулах (Hosting):</h3>
          <ul className="space-y-4 text-gray-400 text-sm">
            <li>1. Энэ кодоо <b>GitHub</b> дээр хадгал.</li>
            <li>2. <b>Vercel.com</b> эсвэл <b>Netlify.com</b> руу орж GitHub-аа холбо.</li>
            <li>3. Мангануудаа оруулсны дараа <b>"Backup"</b> товчийг дарж файлаа хадгалж бай.</li>
            <li>4. Өөр төхөөрөмжөөс орохдоо <b>"Restore"</b> хийж мэдээллээ сэргээнэ.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [mangaList, setMangaList] = useState<Manga[]>(() => {
    const saved = localStorage.getItem('manga_list');
    return saved ? JSON.parse(saved) : INITIAL_MANGA;
  });
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('auth_state');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false };
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  useEffect(() => { try { localStorage.setItem('manga_list', JSON.stringify(mangaList)); } catch (e) { alert("Санах ой дүүрсэн байна!"); } }, [mangaList]);
  useEffect(() => { localStorage.setItem('auth_state', JSON.stringify(authState)); }, [authState]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const role = (authForm.username === ADMIN_CREDENTIALS.username && authForm.password === ADMIN_CREDENTIALS.password) ? 'admin' : 'user';
    setAuthState({ user: { username: authForm.username, role: role as 'admin'|'user' }, isAuthenticated: true });
    setShowAuthModal(false); setAuthForm({ username: '', password: '' });
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col selection:bg-blue-600 selection:text-white">
        <Navbar user={authState.user} onLogout={() => setAuthState({ user: null, isAuthenticated: false })} onOpenAuth={() => setShowAuthModal(true)} />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home mangaList={mangaList} />} />
            <Route path="/manga/:id" element={<MangaDetail mangaList={mangaList} user={authState.user} onUpdateManga={m => setMangaList(mangaList.map(item => item.id === m.id ? m : item))} />} />
            <Route path="/reader/:mangaId/:chapterId" element={<Reader mangaList={mangaList} />} />
            <Route path="/admin" element={authState.user?.username === 'Battushig' ? <AdminPanel mangaList={mangaList} setMangaList={setMangaList} onAddManga={m => setMangaList([m, ...mangaList])} /> : <Home mangaList={mangaList} />} />
          </Routes>
        </main>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <div className="bg-zinc-900 w-full max-w-md p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <h2 className="text-3xl font-black mb-8">Нэвтрэх</h2>
              <form onSubmit={handleLogin} className="space-y-6">
                <input value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white" placeholder="Username" required />
                <input type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white" placeholder="Password" required />
                <button className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl">Үргэлжлүүлэх</button>
                <div className="pt-4 text-[10px] text-center text-gray-600 font-black border-t border-white/5 uppercase">Admin: Battushig / RGT_YTHAPPY</div>
              </form>
            </div>
          </div>
        )}
        <footer className="mt-20 p-12 text-center border-t border-white/5">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-gray-600 font-bold uppercase text-xs">
            <div className="text-2xl font-black text-white/30 italic">MANGA<span className="text-blue-600/30">SPHERE</span></div>
            <p>© 2025 Бүх эрх хамгаалагдсан.</p>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
