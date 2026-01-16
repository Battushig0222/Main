
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Manga, User, AuthState, Chapter, AdminAccount } from './types';
import { INITIAL_MANGA, ADMIN_CREDENTIALS, SUPABASE_CONFIG } from './constants';
import { Navbar } from './components/Navbar';
import { MangaCard } from './components/MangaCard';

// Utility to convert file to base64 with aggressive optimization to prevent performance lag (pexil)
const processImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Optimize for performance: max 1200px width/height and lower jpeg quality
        const MAX_DIM = 1200; 
        let width = img.width || 800;
        let height = img.height || 1200;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width *= ratio;
          height *= ratio;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context failed');
        ctx.fillStyle = "white"; 
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        // 0.7 quality is sufficient for mobile/web and significantly reduces base64 size
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => reject('Image load failed');
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject('File read failed');
  });
};

// --- Supabase ---
let supabaseInstance: any = null;
const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;
  try {
    supabaseInstance = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    return supabaseInstance;
  } catch (e) { 
    console.error("Supabase init error:", e);
    return null; 
  }
};

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
}

interface EditorHistoryState {
  canvasData: string;
  texts: TextElement[];
}

// --- Image Editor (Simplified for brevity but functional) ---
const ImageEditor: React.FC<{
  src: string;
  onSave: (newSrc: string) => void;
  onClose: () => void;
}> = ({ src, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'text' | 'eyedropper' | 'select'>('pen');
  const [brushColor, setBrushColor] = useState('#6366f1');
  const [brushSize, setBrushSize] = useState(10);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

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
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    };
    img.src = src;
  }, [src, rotation]);

  const handleMouseDown = (e: any) => {
    if (activeTool !== 'pen' && activeTool !== 'eraser') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = activeTool === 'eraser' ? 'white' : brushColor;
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.lineTo(x, y); ctx.stroke(); }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) onSave(canvas.toDataURL('image/jpeg', 0.8));
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black flex flex-col font-['Plus_Jakarta_Sans']">
      <div className="bg-[#0f0f0f] border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex gap-4">
           <button onClick={() => setActiveTool('pen')} className={`p-2 rounded ${activeTool === 'pen' ? 'bg-indigo-600' : 'bg-white/5'}`}>Pen</button>
           <button onClick={() => setActiveTool('eraser')} className={`p-2 rounded ${activeTool === 'eraser' ? 'bg-indigo-600' : 'bg-white/5'}`}>Eraser</button>
           <button onClick={() => setRotation(r => r + 90)} className="p-2 bg-white/5 rounded">Rotate</button>
        </div>
        <div className="flex gap-4">
           <button onClick={onClose} className="p-2 text-zinc-500 uppercase font-black text-xs">Cancel</button>
           <button onClick={handleSave} className="bg-indigo-600 px-6 py-2 rounded-xl font-black uppercase text-xs">Save</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-zinc-950 flex items-center justify-center p-10">
         <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDrawing(false)} className="bg-white shadow-2xl" />
      </div>
    </div>
  );
};

// --- Modals ---
const MangaEditModal: React.FC<{ manga: Manga; onClose: () => void; onSave: (updated: Manga) => void; onDelete: () => void; }> = ({ manga, onClose, onSave, onDelete }) => {
  const [data, setData] = useState(manga);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <div className="bg-[#0f0f0f] w-full max-w-xl p-8 rounded-[2.5rem] border border-white/10 space-y-6">
        <h2 className="text-2xl font-black italic uppercase">Edit Info</h2>
        <input value={data.title} onChange={e => setData({...data, title: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold" placeholder="Title" />
        <textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white h-32" placeholder="Description" />
        <div className="flex gap-4">
           <button onClick={() => onSave(data)} className="flex-1 bg-indigo-600 py-4 rounded-2xl font-black uppercase">Save</button>
           <button onClick={onClose} className="flex-1 bg-white/5 py-4 rounded-2xl font-black uppercase">Cancel</button>
        </div>
        <button onClick={() => window.confirm('Delete?') && onDelete()} className="w-full text-red-500 font-black uppercase text-[10px] opacity-50">Delete Permanently</button>
      </div>
    </div>
  );
};

const ChapterEditorModal: React.FC<{ chapter: Chapter; onClose: () => void; onSave: (updated: Chapter) => void; onDelete: () => void; }> = ({ chapter, onClose, onSave, onDelete }) => {
  const [data, setData] = useState(chapter);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
      <div className="bg-[#0f0f0f] w-full max-w-4xl p-8 rounded-[3rem] border border-white/10 max-h-[90vh] overflow-y-auto space-y-8">
        <div className="flex justify-between items-center">
           <h2 className="text-2xl font-black italic uppercase">Chapter {data.number} Editor</h2>
           <button onClick={onClose} className="text-zinc-500">&times;</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
           {data.pages.map((p, i) => (
             <div key={i} className="relative aspect-[2/3] bg-zinc-900 rounded-xl overflow-hidden border border-white/5">
                <img src={p} className="w-full h-full object-cover" />
                <button onClick={() => setData({...data, pages: data.pages.filter((_, idx) => idx !== i)})} className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full text-[10px]">×</button>
             </div>
           ))}
        </div>
        <div className="flex gap-4 border-t border-white/5 pt-8">
           <button onClick={() => onSave(data)} className="flex-1 bg-indigo-600 py-4 rounded-2xl font-black uppercase">Save Chapter</button>
           <button onClick={() => window.confirm('Delete?') && onDelete()} className="flex-1 bg-red-600/10 text-red-500 py-4 rounded-2xl font-black uppercase border border-red-600/20">Delete</button>
        </div>
      </div>
    </div>
  );
};

// --- Main Logic Component ---
const App: React.FC = () => {
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>(() => {
    const saved = localStorage.getItem('rgt_admins');
    return saved ? JSON.parse(saved) : [{ ...ADMIN_CREDENTIALS, isSuperAdmin: true }];
  });
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('auth_state');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false };
  });
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  
  const [cloudStatus, setCloudStatus] = useState('Sync Ready');
  const [lastSynced, setLastSynced] = useState('');
  
  const syncTimeoutRef = useRef<any>(null);
  const initialFetchDone = useRef(false);

  // Initialize and Sync from Cloud
  useEffect(() => {
    const init = async () => {
      // 1. Load from LocalStorage first for instant UI
      const saved = localStorage.getItem('manga_list');
      if (saved) setMangaList(JSON.parse(saved));
      else setMangaList(INITIAL_MANGA);
      
      // 2. Fetch from Cloud to get latest (Ensures "Other users" see updates)
      await handleFetchFromCloud();
      initialFetchDone.current = true;
    };
    init();
  }, []);

  // Save to LocalStorage
  useEffect(() => { localStorage.setItem('manga_list', JSON.stringify(mangaList)); }, [mangaList]);
  useEffect(() => { localStorage.setItem('rgt_admins', JSON.stringify(admins)); }, [admins]);
  useEffect(() => { localStorage.setItem('auth_state', JSON.stringify(authState)); }, [authState]);

  // Auto-sync mechanism (Only for Admins)
  useEffect(() => {
    if (!initialFetchDone.current || !authState.user || authState.user.role !== 'admin') return;

    setCloudStatus('Өөрчлөлт илэрлээ...');
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    
    syncTimeoutRef.current = setTimeout(() => {
      handleSyncToCloud();
    }, 4000); // 4s debounce to prevent overloading Supabase

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [mangaList, admins]);

  const handleSyncToCloud = async (ovAdmins?: AdminAccount[], ovManga?: Manga[]) => {
    const sb = getSupabase(); if (!sb) return;
    setCloudStatus('Cloud-руу илгээж байна...');
    try {
      const targetAdmins = ovAdmins || admins;
      const targetManga = ovManga || mangaList;
      
      // Batch Upsert
      const mangaData = targetManga.map(m => ({ id: m.id, data: m }));
      if (mangaData.length > 0) {
        const { error } = await sb.from('manga').upsert(mangaData);
        if (error) throw error;
      }
      
      const { error: confErr } = await sb.from('config').upsert({ id: 'admins_list', data: targetAdmins });
      if (confErr) throw confErr;
      
      setCloudStatus('Амжилттай хадгаллаа');
      setLastSynced(new Date().toLocaleTimeString());
      setTimeout(() => setCloudStatus('Синхрончлогдсон'), 5000);
    } catch (e) { 
      console.error("Sync Error:", e);
      setCloudStatus('Синк алдаа гарлаа'); 
    }
  };

  const handleFetchFromCloud = async () => {
    const sb = getSupabase(); if (!sb) return;
    setCloudStatus('Шинэ мэдээлэл татаж байна...');
    try {
      const { data: mData, error: mErr } = await sb.from('manga').select('*');
      if (mErr) throw mErr;
      
      if (mData && mData.length > 0) {
        const newList = mData.map((i: any) => i.data);
        setMangaList(newList);
        localStorage.setItem('manga_list', JSON.stringify(newList));
      }
      
      const { data: cData } = await sb.from('config').select('*').eq('id', 'admins_list').single();
      if (cData?.data) {
        setAdmins(cData.data);
      }
      
      setCloudStatus('Холбогдсон');
      setLastSynced(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Fetch Error:", e);
      setCloudStatus('Мэдээлэл татахад алдаа');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'login') {
      const found = admins.find(a => a.username === authForm.username && a.password === authForm.password);
      if (found) { 
        setAuthState({ user: { username: found.username, role: 'admin' }, isAuthenticated: true }); 
        setShowAuthModal(false); 
      }
      else alert("Authentication failed.");
    } else {
      if (admins.some(a => a.username === authForm.username)) return alert("User exists.");
      const newUser = { username: authForm.username, password: authForm.password, isSuperAdmin: false };
      const upAdmins = [...admins, newUser]; 
      setAdmins(upAdmins);
      await handleSyncToCloud(upAdmins);
      setAuthState({ user: { username: authForm.username, role: 'admin' }, isAuthenticated: true }); 
      setShowAuthModal(false);
    }
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col selection:bg-indigo-600 selection:text-white">
        <Navbar user={authState.user} onLogout={() => setAuthState({ user: null, isAuthenticated: false })} onOpenAuth={() => setShowAuthModal(true)} />
        <main className="flex-1 bg-[#050505]">
          <Routes>
            <Route path="/" element={<Home mangaList={mangaList} />} />
            <Route path="/manga/:id" element={<MangaDetail mangaList={mangaList} user={authState.user} onUpdateManga={u => setMangaList(mangaList.map(m => m.id === u.id ? u : m))} onDeleteManga={id => setMangaList(mangaList.filter(m => m.id !== id))} />} />
            <Route path="/reader/:mangaId/:chapterId" element={<Reader mangaList={mangaList} />} />
            <Route path="/admin" element={authState.user?.role === 'admin' ? (
              <AdminPanel 
                mangaList={mangaList} 
                admins={admins} 
                onAddManga={m => setMangaList([m, ...mangaList])} 
                onSyncToCloud={() => handleSyncToCloud()} 
                onFetchFromCloud={handleFetchFromCloud} 
                onDeleteManga={id => setMangaList(mangaList.filter(m => m.id !== id))} 
                onAddAdmin={a => setAdmins([...admins, a])} 
                onDeleteAdmin={u => setAdmins(admins.filter(a => a.username !== u))} 
                cloudStatus={cloudStatus} 
                lastSynced={lastSynced}
              />
            ) : <Home mangaList={mangaList} />} />
          </Routes>
        </main>
        {showAuthModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl">
            <div className="bg-[#0f0f0f] w-full max-w-md p-12 rounded-[3.5rem] border border-white/5 shadow-2xl scale-in">
              <div className="flex gap-8 mb-10 border-b border-white/5 pb-2">
                <button onClick={() => setAuthMode('login')} className={`text-xl font-black uppercase italic ${authMode === 'login' ? 'text-indigo-500' : 'text-zinc-600'}`}>Sign In</button>
                <button onClick={() => setAuthMode('register')} className={`text-xl font-black uppercase italic ${authMode === 'register' ? 'text-indigo-500' : 'text-zinc-600'}`}>Join</button>
              </div>
              <form onSubmit={handleAuthSubmit} className="space-y-6">
                <input value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none" placeholder="Username" required />
                <input type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none" placeholder="Password" required />
                <button className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase shadow-xl">{authMode === 'login' ? 'Login' : 'Register'}</button>
                <button type="button" onClick={() => setShowAuthModal(false)} className="w-full text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] mt-4">Dismiss</button>
              </form>
            </div>
          </div>
        )}
        <footer className="p-16 border-t border-white/5 bg-[#050505] text-center text-zinc-600 text-sm font-bold tracking-widest uppercase">
          &copy; 2026 RGT MANGA • PREMIUM EXPERIENCE
        </footer>
      </div>
    </HashRouter>
  );
};

// --- Home Component ---
const Home: React.FC<{ mangaList: Manga[] }> = ({ mangaList }) => {
  const [search, setSearch] = useState('');
  const filtered = mangaList.filter(m => m.title.toLowerCase().includes(search.toLowerCase()) || m.author.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-16 pt-10">
        <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white uppercase italic leading-none">Epic <span className="text-indigo-600">Stories</span></h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for titles, authors..." className="w-full max-w-2xl mt-8 bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 text-white font-bold outline-none focus:border-indigo-600 shadow-2xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-10">
        {filtered.map(manga => <MangaCard key={manga.id} manga={manga} />)}
      </div>
    </div>
  );
};

// --- Detail Component ---
const MangaDetail: React.FC<{ mangaList: Manga[], user: User | null, onUpdateManga: (manga: Manga) => void, onDeleteManga: (id: string) => void }> = ({ mangaList, user, onUpdateManga, onDeleteManga }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const manga = mangaList.find(m => m.id === id);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [chNumber, setChNumber] = useState('');
  const [chTitle, setChTitle] = useState('');
  const [chPages, setChPages] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingManga, setEditingManga] = useState(false);

  if (!manga) return <div className="p-40 text-center font-black uppercase text-zinc-500">Manga Not Found</div>;
  const isAdmin = user?.role === 'admin';

  const handlePagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setProcessing(true);
      try {
        const filesArray = Array.from(e.target.files);
        const processed = await Promise.all(filesArray.map(f => processImageFile(f as File)));
        setChPages(prev => [...prev, ...processed]);
      } catch (err) {
        alert("Upload error.");
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleCreateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (chPages.length === 0) return alert("No pages.");
    const num = parseFloat(chNumber);
    if (isNaN(num)) return alert("Invalid number.");

    const newChapter: Chapter = {
      id: `ch-${Date.now()}`,
      number: num,
      title: chTitle || `Chapter ${num}`,
      pages: chPages,
      createdAt: new Date().toLocaleDateString()
    };

    onUpdateManga({ ...manga, chapters: [...manga.chapters, newChapter] });
    setShowAddChapter(false);
    setChNumber('');
    setChTitle('');
    setChPages([]);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-16">
      {editingManga && <MangaEditModal manga={manga} onClose={() => setEditingManga(false)} onSave={u => { onUpdateManga(u); setEditingManga(false); }} onDelete={() => { onDeleteManga(manga.id); navigate('/'); }} />}
      {editingChapter && <ChapterEditorModal chapter={editingChapter} onClose={() => setEditingChapter(null)} onSave={u => { onUpdateManga({ ...manga, chapters: manga.chapters.map(c => c.id === u.id ? u : c) }); setEditingChapter(null); }} onDelete={() => { onUpdateManga({ ...manga, chapters: manga.chapters.filter(c => c.id !== editingChapter.id) }); setEditingChapter(null); }} />}
      
      <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">
        <div className="w-full lg:w-[400px] shrink-0 space-y-10">
          <div className="relative group/main">
            <img src={manga.coverUrl} className="w-full rounded-[3rem] shadow-2xl border border-white/5" />
            {isAdmin && <button onClick={() => setEditingManga(true)} className="absolute inset-0 bg-black/40 opacity-0 group-hover/main:opacity-100 flex items-center justify-center font-black uppercase text-xs rounded-[3rem]">Edit</button>}
          </div>
          <div className="bg-[#0f0f0f] p-8 rounded-[2.5rem] border border-white/5 font-bold space-y-4">
            <div className="flex justify-between"><span>Author</span><span className="text-zinc-500">{manga.author}</span></div>
            <div className="flex justify-between"><span>Status</span><span className="text-indigo-500">{manga.status}</span></div>
          </div>
        </div>
        
        <div className="flex-1 space-y-12">
          <h1 className="text-6xl md:text-8xl font-black leading-none text-white uppercase italic">{manga.title}</h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">{manga.description}</p>
          
          {isAdmin && <button onClick={() => setShowAddChapter(!showAddChapter)} className="bg-indigo-600 px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">Add New Chapter</button>}
          
          {showAddChapter && (
            <form onSubmit={handleCreateChapter} className="p-10 bg-[#0f0f0f] rounded-[3rem] space-y-8 border border-white/5 shadow-2xl scale-in">
              <div className="grid md:grid-cols-2 gap-6">
                <input type="number" step="0.1" value={chNumber} onChange={e => setChNumber(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold" placeholder="Chapter #" required />
                <input value={chTitle} onChange={e => setChTitle(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold" placeholder="Title" />
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center"><span className="text-xs font-black uppercase text-zinc-500">Selected Pages ({chPages.length})</span></div>
                 <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                   {chPages.map((p, idx) => (
                     <div key={idx} className="relative aspect-[2/3] rounded-lg overflow-hidden border border-white/5"><img src={p} className="w-full h-full object-cover" /></div>
                   ))}
                   <label className="aspect-[2/3] bg-black border border-dashed border-white/10 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                      {processing ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <span className="text-2xl text-zinc-800">+</span>}
                      <input type="file" multiple onChange={handlePagesUpload} className="hidden" />
                   </label>
                 </div>
              </div>
              <button disabled={processing} className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase shadow-xl disabled:opacity-50">Create Chapter</button>
            </form>
          )}

          <div className="space-y-6">
            <h2 className="text-4xl font-black italic uppercase">Chapters</h2>
            <div className="grid gap-4">
              {[...manga.chapters].sort((a,b) => b.number - a.number).map(chapter => (
                <div key={chapter.id} className="bg-[#0f0f0f] p-6 rounded-[2.5rem] flex items-center justify-between group border border-white/5 hover:border-indigo-600/30 transition-all">
                   <div onClick={() => navigate(`/reader/${manga.id}/${chapter.id}`)} className="flex-1 cursor-pointer">
                      <div className="text-indigo-600 font-black text-4xl italic leading-none">#{chapter.number}</div>
                      <div className="font-black text-xl text-white mt-2">{chapter.title}</div>
                      <div className="text-[10px] text-zinc-600 font-bold uppercase mt-1 tracking-widest">{chapter.pages.length} PAGES</div>
                   </div>
                   {isAdmin && <button onClick={() => setEditingChapter(chapter)} className="p-4 bg-indigo-600/10 text-indigo-500 rounded-2xl font-black text-[10px] uppercase opacity-0 group-hover:opacity-100 transition-all">Editor</button>}
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
  const { mangaId, chapterId } = useParams();
  const manga = mangaList.find(m => m.id === mangaId);
  const chapter = manga?.chapters.find(c => c.id === chapterId);
  if (!chapter) return <div className="p-40 text-center font-black uppercase text-zinc-500">Chapter Not Found</div>;
  
  return (
    <div className="bg-[#050505] min-h-screen">
      <div className="max-w-4xl mx-auto pb-32">
        <div className="sticky top-0 bg-[#050505]/95 backdrop-blur-3xl p-6 flex items-center justify-between z-50 border-b border-white/5">
          <button onClick={() => window.history.back()} className="px-6 py-3 bg-white/5 rounded-2xl text-white font-black text-[10px] uppercase hover:bg-white/10 transition-all">← Return</button>
          <div className="text-center">
             <h2 className="font-black text-sm text-white truncate max-w-[200px] uppercase">{manga?.title}</h2>
             <p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.2em]">Chapter {chapter.number}</p>
          </div>
          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{chapter.pages.length} Pages</span>
        </div>
        <div className="flex flex-col gap-1 mt-6">
          {chapter.pages.map((p, i) => (
            <img key={i} src={p} className="w-full h-auto block shadow-2xl border-y border-white/5" loading="lazy" />
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Admin Component ---
const AdminPanel: React.FC<{ 
  mangaList: Manga[], admins: AdminAccount[], onAddManga: (m: Manga) => void, onSyncToCloud: () => void, 
  onFetchFromCloud: () => void, onDeleteManga: (id: string) => void, onAddAdmin: (a: AdminAccount) => void,
  onDeleteAdmin: (u: string) => void, cloudStatus: string, lastSynced: string
}> = (props) => {
  const [newManga, setNewManga] = useState({ title: '', author: '', description: '', coverUrl: '' });
  const navigate = useNavigate();
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-16 space-y-16">
      <div className="bg-[#0f0f0f] p-10 md:p-16 rounded-[3.5rem] border border-white/5 flex flex-col md:flex-row justify-between items-center gap-10">
        <div>
          <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter">Admin Panel</h1>
          <p className="text-zinc-500 font-bold mt-2 uppercase tracking-widest text-xs">Manage your content ecosystem</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button onClick={props.onSyncToCloud} className="bg-indigo-600 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-500 transition-all">Force Sync</button>
          <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{props.cloudStatus}</div>
          {props.lastSynced && <div className="text-[9px] text-zinc-600 font-bold">Last Synced: {props.lastSynced}</div>}
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-16">
          <form onSubmit={e => { e.preventDefault(); props.onAddManga({ id: `m-${Date.now()}`, title: newManga.title, author: newManga.author, description: newManga.description, coverUrl: newManga.coverUrl || 'https://picsum.photos/400/600', gallery: [], genre: ['Manga'], status: 'Ongoing', rating: 5.0, chapters: [] }); setNewManga({ title: '', author: '', description: '', coverUrl: '' }); }} className="space-y-6 bg-[#0f0f0f] p-10 rounded-[3.5rem] border border-white/5">
            <h2 className="text-2xl font-black italic uppercase">Add New Entry</h2>
            <input value={newManga.title} onChange={e => setNewManga({...newManga, title: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold" placeholder="Title" required />
            <input value={newManga.author} onChange={e => setNewManga({...newManga, author: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold" placeholder="Author" required />
            <textarea value={newManga.description} onChange={e => setNewManga({...newManga, description: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white h-44" placeholder="Description" required />
            <input type="file" onChange={async e => { const target = e.target as HTMLInputElement; if (target.files?.[0]) setNewManga({...newManga, coverUrl: await processImageFile(target.files[0] as File)}); }} className="hidden" id="m-cover" /><label htmlFor="m-cover" className="block border-2 border-dashed border-white/5 p-12 rounded-[2rem] text-center cursor-pointer text-zinc-600 font-black uppercase text-xs hover:bg-white/5">{newManga.coverUrl ? 'Cover Ready' : 'Upload Cover Art'}</label>
            <button className="w-full bg-indigo-600 py-6 rounded-2xl font-black uppercase">Publish Series</button>
          </form>
          <div className="bg-[#0f0f0f] p-10 rounded-[3.5rem] border border-white/5 space-y-8">
             <h2 className="text-2xl font-black italic uppercase">Inventory</h2>
             <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 scrollbar-hide">
               {props.mangaList.map(m => (
                <div key={m.id} className="flex items-center justify-between p-5 bg-black rounded-[2rem] border border-white/5 group transition-all hover:border-indigo-600/40">
                  <div className="flex items-center gap-6"><img src={m.coverUrl} className="w-14 h-20 object-cover rounded-xl" /><span className="font-black text-white">{m.title}</span></div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => navigate(`/manga/${m.id}`)} className="p-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase">Edit</button>
                    <button onClick={() => props.onDeleteManga(m.id)} className="p-3 bg-red-600/10 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white">Del</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
    </div>
  );
};

export default App;
