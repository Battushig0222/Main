
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Manga, User, AuthState, Chapter, AdminAccount } from './types';
import { INITIAL_MANGA, ADMIN_CREDENTIALS, SUPABASE_CONFIG } from './constants';
import { Navbar } from './components/Navbar';
import { MangaCard } from './components/MangaCard';

/**
 * High-fidelity image processing for manga.
 * Caps width and height to safe limits to prevent "black image" failure in browsers
 * while maintaining high sharpness (pixel density).
 */
const processImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Safe high-resolution settings: 1600px width is perfect for mobile & desktop.
        // Capping height at 10,000px to prevent canvas memory failure (which causes black screens).
        const TARGET_WIDTH = 1600; 
        const MAX_HEIGHT = 10000; 
        
        let width = img.width;
        let height = img.height;

        if (width > TARGET_WIDTH) {
          const ratio = TARGET_WIDTH / width;
          width = TARGET_WIDTH;
          height = height * ratio;
        }
        
        if (height > MAX_HEIGHT) {
          const ratio = MAX_HEIGHT / height;
          height = MAX_HEIGHT;
          width = width * ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context failed');
        
        // Ensure the highest quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Fill white background for transparent PNGs
        ctx.fillStyle = "white"; 
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // 0.95 quality for better sharpness
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        if (dataUrl.length < 100) {
          reject('Image processing failed (Empty output)');
        } else {
          resolve(dataUrl);
        }
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

// --- Modals ---
const MangaEditModal: React.FC<{ manga: Manga; onClose: () => void; onSave: (updated: Manga) => void; onDelete: () => void; }> = ({ manga, onClose, onSave, onDelete }) => {
  const [data, setData] = useState(manga);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <div className="bg-[#0f0f0f] w-full max-w-xl p-8 rounded-[2.5rem] border border-white/10 space-y-6">
        <h2 className="text-2xl font-black italic uppercase">Мэдээлэл Засах</h2>
        <input value={data.title} onChange={e => setData({...data, title: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-indigo-600" placeholder="Гарчиг" />
        <textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white h-32 outline-none focus:border-indigo-600" placeholder="Тайлбар" />
        <div className="flex gap-4">
           <button onClick={() => onSave(data)} className="flex-1 bg-indigo-600 py-4 rounded-2xl font-black uppercase shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">Хадгалах</button>
           <button onClick={onClose} className="flex-1 bg-white/5 py-4 rounded-2xl font-black uppercase hover:bg-white/10 transition-all">Цуцлах</button>
        </div>
        <button onClick={() => window.confirm('Энэ мангаг системээс бүрмөсөн устгах уу?') && onDelete()} className="w-full text-red-500 font-black uppercase text-[10px] opacity-50 hover:opacity-100 transition-opacity">Бүрмөсөн устгах</button>
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
           <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-2xl">&times;</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
           {data.pages.map((p, i) => (
             <div key={i} className="relative aspect-[2/3] bg-zinc-900 rounded-xl overflow-hidden border border-white/5">
                <img src={p} className="w-full h-full object-cover" alt="page" />
                <button onClick={() => setData({...data, pages: data.pages.filter((_, idx) => idx !== i)})} className="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full text-sm font-bold shadow-lg flex items-center justify-center">×</button>
             </div>
           ))}
        </div>
        <div className="flex gap-4 border-t border-white/5 pt-8">
           <button onClick={() => onSave(data)} className="flex-1 bg-indigo-600 py-4 rounded-2xl font-black uppercase active:scale-95 transition-all shadow-lg shadow-indigo-600/20">Хадгалах</button>
           <button onClick={() => window.confirm('Энэ chapter-г устгах уу?') && onDelete()} className="flex-1 bg-red-600/10 text-red-500 py-4 rounded-2xl font-black uppercase border border-red-600/20 hover:bg-red-600 hover:text-white transition-all">Устгах</button>
        </div>
      </div>
    </div>
  );
};

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
  
  const [cloudStatus, setCloudStatus] = useState('Standby');
  const [lastSynced, setLastSynced] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  
  const syncTimeoutRef = useRef<any>(null);
  const initialFetchDone = useRef(false);

  useEffect(() => {
    const init = async () => {
      await handleFetchFromCloud();
      initialFetchDone.current = true;
    };
    init();
  }, []);

  useEffect(() => { 
    if (initialFetchDone.current) {
        localStorage.setItem('manga_list', JSON.stringify(mangaList)); 
    }
  }, [mangaList]);
  
  useEffect(() => { localStorage.setItem('rgt_admins', JSON.stringify(admins)); }, [admins]);
  useEffect(() => { localStorage.setItem('auth_state', JSON.stringify(authState)); }, [authState]);

  useEffect(() => {
    if (!initialFetchDone.current || !authState.user || authState.user.role !== 'admin') return;
    setCloudStatus('Өөрчлөлт хадгалахыг хүлээж байна...');
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      handleSyncToCloud();
    }, 5000); 
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [mangaList, admins]);

  const handleSyncToCloud = async (ovAdmins?: AdminAccount[], ovManga?: Manga[]) => {
    const sb = getSupabase(); if (!sb) return;
    setCloudStatus('Cloud-руу илгээж байна...');
    try {
      const targetAdmins = ovAdmins || admins;
      const targetManga = ovManga || mangaList;
      const mangaData = targetManga.map(m => ({ id: m.id, data: m }));
      if (mangaData.length > 0) {
        const { error } = await sb.from('manga').upsert(mangaData);
        if (error) throw error;
      }
      const { error: confErr } = await sb.from('config').upsert({ id: 'admins_list', data: targetAdmins });
      if (confErr) throw confErr;
      setCloudStatus('Cloud-д амжилттай хадгаллаа');
      setLastSynced(new Date().toLocaleTimeString());
      setTimeout(() => setCloudStatus('Синхрончлогдсон'), 3000);
    } catch (e) { 
      setCloudStatus('Синк алдаа гарлаа'); 
    }
  };

  const handleFetchFromCloud = async () => {
    const sb = getSupabase(); if (!sb) return;
    setCloudStatus('Мэдээлэл татаж байна...');
    try {
      const { data: mData, error: mErr } = await sb.from('manga').select('*');
      if (mErr) throw mErr;
      if (mData) {
        const newList = mData.map((i: any) => i.data);
        setMangaList(newList);
      }
      const { data: cData } = await sb.from('config').select('*').eq('id', 'admins_list').single();
      if (cData?.data) setAdmins(cData.data);
      setCloudStatus('Холбогдсон');
      setLastSynced(new Date().toLocaleTimeString());
    } catch (e) {
      setCloudStatus('Сүлжээний алдаа');
    }
  };

  const handleDeleteManga = async (id: string) => {
    setMangaList(prev => prev.filter(m => m.id !== id));
    const sb = getSupabase();
    if (sb) {
        setCloudStatus('Cloud-аас бүрмөсөн устгаж байна...');
        const { error } = await sb.from('manga').delete().eq('id', id);
        if (error) {
            alert("Cloud-аас устгахад алдаа гарлаа.");
        } else {
            setCloudStatus('Устгагдлаа');
        }
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
      else alert("Нэвтрэх нэр эсвэл нууц үг буруу байна.");
    } else {
      if (admins.some(a => a.username === authForm.username)) return alert("Энэ хэрэглэгч бүртгэлтэй байна.");
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
            <Route path="/manga/:id" element={<MangaDetail mangaList={mangaList} user={authState.user} onUpdateManga={u => setMangaList(mangaList.map(m => m.id === u.id ? u : m))} onDeleteManga={handleDeleteManga} />} />
            <Route path="/reader/:mangaId/:chapterId" element={<Reader mangaList={mangaList} />} />
            <Route path="/admin" element={authState.user?.role === 'admin' ? (
              <AdminPanel 
                mangaList={mangaList} 
                admins={admins} 
                onAddManga={m => setMangaList([m, ...mangaList])} 
                onSyncToCloud={() => handleSyncToCloud()} 
                onFetchFromCloud={handleFetchFromCloud} 
                onDeleteManga={handleDeleteManga} 
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
                <button className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase shadow-xl hover:bg-indigo-500 transition-all">{authMode === 'login' ? 'Login' : 'Register'}</button>
                <button type="button" onClick={() => setShowAuthModal(false)} className="w-full text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] mt-4">Dismiss</button>
              </form>
            </div>
          </div>
        )}
        <footer className="p-16 border-t border-white/5 bg-[#050505] text-center text-zinc-600 text-sm font-bold tracking-widest uppercase">
          &copy; 2026 RGT MANGA • PREMIUM READER
        </footer>
      </div>
    </HashRouter>
  );
};

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
        {filtered.length === 0 && <div className="col-span-full py-20 text-center font-black uppercase text-zinc-700 tracking-widest">Сан хоосон байна</div>}
      </div>
    </div>
  );
};

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

  if (!manga) return <div className="p-40 text-center font-black uppercase text-zinc-500">Манга олдсонгүй</div>;
  const isAdmin = user?.role === 'admin';

  const handlePagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setProcessing(true);
      try {
        const filesArray = Array.from(e.target.files);
        const processed = await Promise.all(filesArray.map(f => processImageFile(f as File)));
        setChPages(prev => [...prev, ...processed]);
      } catch (err) {
        alert("Зураг оруулахад алдаа гарлаа (Зургийн хэмжээ хэт том байж магадгүй).");
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleCreateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (chPages.length === 0) return alert("Зураг оруулаагүй байна.");
    const num = parseFloat(chNumber);
    if (isNaN(num)) return alert("Буруу дугаар.");
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
            <img src={manga.coverUrl} className="w-full rounded-[3rem] shadow-2xl border border-white/5" alt="cover" />
            {isAdmin && <button onClick={() => setEditingManga(true)} className="absolute inset-0 bg-black/40 opacity-0 group-hover/main:opacity-100 flex items-center justify-center font-black uppercase text-xs rounded-[3rem] transition-all">Мэдээлэл Засах</button>}
          </div>
          <div className="bg-[#0f0f0f] p-8 rounded-[2.5rem] border border-white/5 font-bold space-y-4">
            <div className="flex justify-between items-center"><span className="text-zinc-500 uppercase text-[10px] font-black tracking-widest">Зохиолч</span><span>{manga.author}</span></div>
            <div className="flex justify-between items-center"><span className="text-zinc-500 uppercase text-[10px] font-black tracking-widest">Төлөв</span><span className="text-indigo-500">{manga.status}</span></div>
          </div>
        </div>
        
        <div className="flex-1 space-y-12">
          <h1 className="text-6xl md:text-8xl font-black leading-none text-white uppercase italic tracking-tighter">{manga.title}</h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl font-medium">{manga.description}</p>
          
          {isAdmin && <button onClick={() => setShowAddChapter(!showAddChapter)} className="bg-indigo-600 px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-indigo-500 transition-all active:scale-95">Chapter Нэмэх</button>}
          
          {showAddChapter && (
            <form onSubmit={handleCreateChapter} className="p-10 bg-[#0f0f0f] rounded-[3rem] space-y-8 border border-white/5 shadow-2xl scale-in">
              <div className="grid md:grid-cols-2 gap-6">
                <input type="number" step="0.1" value={chNumber} onChange={e => setChNumber(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-indigo-600" placeholder="Дугаар" required />
                <input value={chTitle} onChange={e => setChTitle(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-indigo-600" placeholder="Нэр" />
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center"><span className="text-xs font-black uppercase text-zinc-500">Сонгосон хуудас ({chPages.length})</span><button type="button" onClick={() => setChPages([])} className="text-red-500 text-[10px] font-black uppercase hover:underline">Цэвэрлэх</button></div>
                 <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                   {chPages.map((p, idx) => (
                     <div key={idx} className="relative aspect-[2/3] rounded-lg overflow-hidden border border-white/5 shadow-md"><img src={p} className="w-full h-full object-cover" alt="page" /></div>
                   ))}
                   <label className="aspect-[2/3] bg-black border border-dashed border-white/10 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                      {processing ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <span className="text-2xl text-zinc-800">+</span>}
                      <input type="file" multiple onChange={handlePagesUpload} className="hidden" />
                   </label>
                 </div>
              </div>
              <button disabled={processing} className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase shadow-xl disabled:opacity-50 active:scale-95 transition-all">Publish</button>
            </form>
          )}

          <div className="space-y-6">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Бүлгүүд</h2>
            <div className="grid gap-4">
              {[...manga.chapters].sort((a,b) => b.number - a.number).map(chapter => (
                <div key={chapter.id} className="bg-[#0f0f0f] p-6 rounded-[2.5rem] flex items-center justify-between group border border-white/5 hover:border-indigo-600/30 transition-all">
                   <div onClick={() => navigate(`/reader/${manga.id}/${chapter.id}`)} className="flex-1 cursor-pointer">
                      <div className="text-indigo-600 font-black text-4xl italic leading-none">#{chapter.number}</div>
                      <div className="font-black text-xl text-white mt-2 group-hover:text-indigo-400 transition-colors">{chapter.title}</div>
                      <div className="text-[10px] text-zinc-600 font-bold uppercase mt-1 tracking-widest">{chapter.pages.length} PAGES • {chapter.createdAt}</div>
                   </div>
                   {isAdmin && <button onClick={() => setEditingChapter(chapter)} className="p-4 bg-indigo-600/10 text-indigo-500 rounded-2xl font-black text-[10px] uppercase opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white">Засах</button>}
                </div>
              ))}
              {manga.chapters.length === 0 && <div className="py-20 text-center font-black uppercase text-zinc-800 tracking-tighter">Бүлэг ороогүй байна</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Reader: React.FC<{ mangaList: Manga[] }> = ({ mangaList }) => {
  const { mangaId, chapterId } = useParams();
  const manga = mangaList.find(m => m.id === mangaId);
  const chapter = manga?.chapters.find(c => c.id === chapterId);
  if (!chapter) return <div className="p-40 text-center font-black uppercase text-zinc-500">Бүлэг олдсонгүй</div>;
  
  return (
    <div className="bg-[#050505] min-h-screen">
      <div className="max-w-4xl mx-auto pb-32">
        <div className="sticky top-0 bg-[#050505]/95 backdrop-blur-3xl p-6 flex items-center justify-between z-50 border-b border-white/5 shadow-2xl">
          <button onClick={() => window.history.back()} className="px-6 py-3 bg-white/5 rounded-2xl text-white font-black text-[10px] uppercase hover:bg-white/10 transition-all tracking-widest">← Буцах</button>
          <div className="text-center">
             <h2 className="font-black text-sm text-white truncate max-w-[200px] uppercase">{manga?.title}</h2>
             <p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.2em]">Chapter {chapter.number}</p>
          </div>
          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{chapter.pages.length} Pages</span>
        </div>
        <div className="flex flex-col gap-0 mt-6 bg-black">
          {chapter.pages.map((p, i) => (
            <img 
                key={i} 
                src={p} 
                className="w-full h-auto block shadow-2xl" 
                style={{ 
                  imageRendering: '-webkit-optimize-contrast',
                  display: 'block'
                } as any}
                loading="lazy" 
                alt={`Page ${i+1}`} 
            />
          ))}
        </div>
        <div className="mt-12 text-center">
            <button onClick={() => window.history.back()} className="bg-indigo-600 px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-indigo-500 transition-all">Бүх бүлэг рүү буцах</button>
        </div>
      </div>
    </div>
  );
};

const AdminPanel: React.FC<{ 
  mangaList: Manga[], admins: AdminAccount[], onAddManga: (m: Manga) => void, onSyncToCloud: () => void, 
  onFetchFromCloud: () => void, onDeleteManga: (id: string) => void, onAddAdmin: (a: AdminAccount) => void,
  onDeleteAdmin: (u: string) => void, cloudStatus: string, lastSynced: string
}> = (props) => {
  const [newManga, setNewManga] = useState({ title: '', author: '', description: '', coverUrl: '', genre: [] as string[], status: 'Ongoing' as 'Ongoing' | 'Completed' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-16 space-y-16">
      <div className="bg-[#0f0f0f] p-10 md:p-16 rounded-[3.5rem] border border-white/5 flex flex-col md:flex-row justify-between items-center gap-10 shadow-2xl">
        <div>
          <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter">Админ Панел</h1>
          <p className="text-zinc-500 font-bold mt-2 uppercase tracking-widest text-[10px]">Database Management & Sync</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button onClick={props.onSyncToCloud} className="bg-indigo-600 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-500 transition-all active:scale-95">Manual Sync</button>
          <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{props.cloudStatus}</div>
          {props.lastSynced && <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Synced at: {props.lastSynced}</div>}
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-16">
          <form onSubmit={async e => { e.preventDefault(); setLoading(true); try { props.onAddManga({ id: `m-${Date.now()}`, title: newManga.title, author: newManga.author, description: newManga.description, coverUrl: newManga.coverUrl || 'https://picsum.photos/400/600', gallery: [], genre: newManga.genre.length > 0 ? newManga.genre : ['Manga'], status: newManga.status, rating: 5.0, chapters: [] }); setNewManga({ title: '', author: '', description: '', coverUrl: '', genre: [], status: 'Ongoing' }); } finally { setLoading(false); } }} className="space-y-6 bg-[#0f0f0f] p-10 rounded-[3.5rem] border border-white/5 shadow-xl">
            <h2 className="text-2xl font-black italic uppercase">Манга Нэмэх</h2>
            <input value={newManga.title} onChange={e => setNewManga({...newManga, title: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-indigo-600" placeholder="Манга Гарчиг" required />
            <input value={newManga.author} onChange={e => setNewManga({...newManga, author: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-indigo-600" placeholder="Зохиолч" required />
            <textarea value={newManga.description} onChange={e => setNewManga({...newManga, description: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white h-44 outline-none focus:border-indigo-600" placeholder="Товч тайлбар..." required />
            <div className="grid md:grid-cols-2 gap-4">
              <select value={newManga.status} onChange={e => setNewManga({...newManga, status: e.target.value as 'Ongoing' | 'Completed'})} className="bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-indigo-600">
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
              <input value={newManga.genre.join(', ')} onChange={e => setNewManga({...newManga, genre: e.target.value.split(',').map(g => g.trim()).filter(g => g)})} className="bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-indigo-600" placeholder="Жанр (тусгаарлахдаа , ашигла)" />
            </div>
            <input type="file" onChange={async e => { const target = e.target as HTMLInputElement; if (target.files?.[0]) setNewManga({...newManga, coverUrl: await processImageFile(target.files[0] as File)}); }} className="hidden" id="m-cover" /><label htmlFor="m-cover" className="block border-2 border-dashed border-white/5 p-12 rounded-[2rem] text-center cursor-pointer text-zinc-600 font-black uppercase text-xs hover:bg-white/5 transition-colors">{newManga.coverUrl ? 'Cover Ready' : 'Upload Cover Art'}</label>
            <button disabled={loading} className="w-full bg-indigo-600 py-6 rounded-2xl font-black uppercase shadow-lg shadow-indigo-600/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Нэмж байна...' : 'Publish'}</button>
          </form>
          <div className="bg-[#0f0f0f] p-10 rounded-[3.5rem] border border-white/5 space-y-8 shadow-xl">
             <h2 className="text-2xl font-black italic uppercase">Жагсаалт</h2>
             <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 scrollbar-hide">
               {props.mangaList.map(m => (
                <div key={m.id} className="flex items-center justify-between p-5 bg-black rounded-[2rem] border border-white/5 group transition-all hover:border-indigo-600/40">
                  <div className="flex items-center gap-6"><img src={m.coverUrl} className="w-14 h-20 object-cover rounded-xl shadow-lg" alt="thumb" /><span className="font-black text-white">{m.title}</span></div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => navigate(`/manga/${m.id}`)} className="p-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase">Засах</button>
                    <button onClick={() => props.onDeleteManga(m.id)} className="p-3 bg-red-600/10 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-colors">Устгах</button>
                  </div>
                </div>
              ))}
              {props.mangaList.length === 0 && <div className="py-20 text-center font-black uppercase text-zinc-800 italic">Сан хоосон байна</div>}
            </div>
          </div>
        </div>
    </div>
  );
};

export default App;
