
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Manga, User, AuthState, Chapter, AdminAccount } from './types';
import { INITIAL_MANGA, ADMIN_CREDENTIALS, SUPABASE_CONFIG } from './constants';
import { Navbar } from './components/Navbar';
import { MangaCard } from './components/MangaCard';

// Utility to convert file to base64
const processImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 4096; 
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
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
  });
};

// --- Supabase ---
let supabaseInstance: any = null;
const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;
  try {
    supabaseInstance = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    return supabaseInstance;
  } catch (e) { return null; }
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

// --- Professional Image Editor ---
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
  const [isLoading, setIsLoading] = useState(true);
  
  const [history, setHistory] = useState<EditorHistoryState[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadCanvas();
  }, [src, rotation]);

  const loadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    setIsLoading(true);
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
      setIsLoading(false);
      
      const initialState = { canvasData: canvas.toDataURL(), texts: [] };
      setHistory([initialState]);
      setHistoryIdx(0);
      setTextElements([]);
    };
    img.src = src;
  };

  const pushHistory = (newCanvasData?: string, newTexts?: TextElement[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentCanvas = newCanvasData || canvas.toDataURL();
    const currentTexts = newTexts || textElements;
    const newState = { canvasData: currentCanvas, texts: JSON.parse(JSON.stringify(currentTexts)) };
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(newState);
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIdx <= 0) return;
    const prevState = history[historyIdx - 1];
    setHistoryIdx(historyIdx - 1);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setTextElements(prevState.texts);
      setSelectedTextId(null);
    };
    img.src = prevState.canvasData;
  };

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const handleMouseDown = (e: any) => {
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (activeTool === 'eyedropper') {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      setBrushColor(`#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`);
      setActiveTool('pen');
      return;
    }

    if (activeTool === 'text') {
      const newText: TextElement = {
        id: `txt-${Date.now()}`,
        text: 'Шинэ текст',
        x, y,
        size: Math.max(24, brushSize * 3),
        rotation: 0,
        color: brushColor
      };
      const newTexts = [...textElements, newText];
      setTextElements(newTexts);
      setSelectedTextId(newText.id);
      setActiveTool('select');
      pushHistory(undefined, newTexts);
      return;
    }

    if (activeTool === 'select') {
      const clicked = [...textElements].reverse().find(t => {
        const hitPadding = 20;
        const hitWidth = (t.size * 0.6 * t.text.length) / 2 + hitPadding;
        const hitHeight = t.size / 2 + hitPadding;
        return x > t.x - hitWidth && x < t.x + hitWidth && y > t.y - hitHeight && y < t.y + hitHeight;
      });
      if (clicked) {
        setSelectedTextId(clicked.id);
        setIsDraggingText(true);
        setDragOffset({ x: x - clicked.x, y: y - clicked.y });
      } else {
        setSelectedTextId(null);
      }
      return;
    }

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = activeTool === 'eraser' ? 'white' : brushColor;
  };

  const handleMouseMove = (e: any) => {
    const { x, y } = getCoordinates(e);
    if (isDrawing) {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) { ctx.lineTo(x, y); ctx.stroke(); }
    } else if (isDraggingText && selectedTextId) {
      setTextElements(prev => prev.map(t => t.id === selectedTextId ? { ...t, x: x - dragOffset.x, y: y - dragOffset.y } : t));
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) { setIsDrawing(false); pushHistory(); }
    if (isDraggingText) { setIsDraggingText(false); pushHistory(); }
  };

  const handleFlattenAndSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvas.width;
    finalCanvas.height = canvas.height;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return;
    fctx.drawImage(canvas, 0, 0);
    textElements.forEach(t => {
      fctx.save();
      fctx.translate(t.x, t.y);
      fctx.rotate((t.rotation * Math.PI) / 180);
      fctx.font = `bold ${t.size}px 'Plus Jakarta Sans', sans-serif`;
      fctx.fillStyle = t.color;
      fctx.textAlign = 'center';
      fctx.textBaseline = 'middle';
      fctx.fillText(t.text, 0, 0);
      fctx.restore();
    });
    onSave(finalCanvas.toDataURL('image/jpeg', 0.9));
  };

  const selectedText = textElements.find(t => t.id === selectedTextId);

  return (
    <div className="fixed inset-0 z-[3000] bg-[#050505] flex flex-col font-['Plus_Jakarta_Sans']">
      <div className="bg-[#0f0f0f] border-b border-white/5 p-4 flex flex-wrap items-center justify-between gap-4 z-50">
        <div className="flex items-center gap-2">
          <div className="flex bg-black p-1 rounded-xl border border-white/5">
            {[
              { id: 'pen', label: 'Pen', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
              { id: 'eraser', label: 'Eraser', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6' },
              { id: 'text', label: 'Add Text', icon: 'M4 7V4h16v3M9 20h6M12 4v16' },
              { id: 'select', label: 'Move', icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5' },
              { id: 'eyedropper', label: 'Pick', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' }
            ].map(tool => (
              <button key={tool.id} onClick={() => setActiveTool(tool.id as any)} className={`p-3 rounded-lg transition-all ${activeTool === tool.id ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={tool.icon} /></svg>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 bg-black px-4 py-2 rounded-xl border border-white/5">
            <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-none" />
            <input type="range" min="1" max="100" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-16 accent-indigo-600" />
          </div>
          <div className="flex items-center gap-3 bg-black px-4 py-2 rounded-xl border border-white/5">
             <span className="text-[9px] text-zinc-600 font-black uppercase">Zoom</span>
             <input type="range" min="0.1" max="5" step="0.1" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} className="w-16 accent-indigo-600" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleUndo} disabled={historyIdx <= 0} className="p-3 bg-zinc-900 rounded-xl text-white disabled:opacity-20"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg></button>
          <button onClick={() => setRotation(r => r + 90)} className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase border border-white/5">Rotate</button>
          <button onClick={onClose} className="px-5 py-2.5 text-zinc-500 font-black uppercase text-[10px]">Cancel</button>
          <button onClick={handleFlattenAndSave} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-indigo-600/30">Save Image</button>
        </div>
      </div>

      {selectedText && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-[#121212]/95 backdrop-blur-xl border border-white/10 p-5 rounded-3xl flex flex-wrap items-center gap-6 z-[100] shadow-2xl animate-slide-up">
           <input value={selectedText.text} onChange={e => setTextElements(textElements.map(t => t.id === selectedTextId ? { ...t, text: e.target.value } : t))} onBlur={() => pushHistory()} className="bg-black border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none w-40" />
           <div className="flex flex-col gap-1"><label className="text-[9px] text-zinc-500 font-black uppercase">Size</label><input type="range" min="10" max="400" value={selectedText.size} onChange={e => setTextElements(prev => prev.map(t => t.id === selectedTextId ? { ...t, size: parseInt(e.target.value) } : t))} onMouseUp={() => pushHistory()} className="accent-indigo-600 w-24" /></div>
           <div className="flex flex-col gap-1"><label className="text-[9px] text-zinc-500 font-black uppercase">Rotate</label><input type="range" min="-180" max="180" value={selectedText.rotation} onChange={e => setTextElements(prev => prev.map(t => t.id === selectedTextId ? { ...t, rotation: parseInt(e.target.value) } : t))} onMouseUp={() => pushHistory()} className="accent-indigo-600 w-24" /></div>
           <input type="color" value={selectedText.color} onChange={e => { const nt = textElements.map(t => t.id === selectedTextId ? { ...t, color: e.target.value } : t); setTextElements(nt); pushHistory(undefined, nt); }} className="w-8 h-8 rounded-lg cursor-pointer" />
           <button onClick={() => { const nt = textElements.filter(t => t.id !== selectedTextId); setTextElements(nt); setSelectedTextId(null); pushHistory(undefined, nt); }} className="bg-red-600/10 text-red-500 p-3 rounded-2xl">Del</button>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-[#0a0a0a] relative flex items-center justify-center p-20 select-none scrollbar-hide">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }} className="relative transition-transform duration-200">
          <div className="relative shadow-2xl bg-white">
            <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp} className={`block ${activeTool === 'pen' ? 'cursor-crosshair' : 'cursor-default'}`} />
            {textElements.map(t => (
              <div key={t.id} style={{ position: 'absolute', left: t.x, top: t.y, transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`, color: t.color, fontSize: `${t.size}px`, fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'none', border: selectedTextId === t.id ? '2px dashed #6366f1' : 'none', padding: '8px', lineHeight: '1' }}>{t.text}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Manga Edit Modal ---
const MangaEditModal: React.FC<{ manga: Manga; onClose: () => void; onSave: (updated: Manga) => void; onDelete: () => void; }> = ({ manga, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState(manga.title);
  const [author, setAuthor] = useState(manga.author);
  const [description, setDescription] = useState(manga.description);
  const [coverUrl, setCoverUrl] = useState(manga.coverUrl);
  const [isEditingCover, setIsEditingCover] = useState(false);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      {isEditingCover && <ImageEditor src={coverUrl} onClose={() => setIsEditingCover(false)} onSave={(newSrc) => { setCoverUrl(newSrc); setIsEditingCover(false); }} />}
      <div className="bg-[#0f0f0f] w-full max-w-2xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-8">
        <div className="flex justify-between items-center"><h2 className="text-3xl font-black text-white italic uppercase">Edit Manga</h2><button onClick={onClose} className="text-zinc-500 bg-white/5 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all">&times;</button></div>
        <div className="space-y-6">
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Title" />
          <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Author" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white h-32 outline-none" placeholder="Description" />
          <div className="relative aspect-[3/2] rounded-2xl overflow-hidden bg-black group"><img src={coverUrl} className="w-full h-full object-contain opacity-60" /><div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setIsEditingCover(true)} className="bg-indigo-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase">Edit Cover</button></div></div>
        </div>
        <div className="flex flex-col gap-3 border-t border-white/5 pt-6">
          <button onClick={() => onSave({ ...manga, title, author, description, coverUrl })} className="w-full bg-indigo-600 py-4 rounded-2xl font-black uppercase shadow-xl">Save All Changes</button>
          <button onClick={() => window.confirm('Delete?') && onDelete()} className="w-full bg-red-600/10 text-red-500 py-4 rounded-2xl font-black uppercase border border-red-600/20">Delete Entry</button>
        </div>
      </div>
    </div>
  );
};

// --- Chapter Editor Modal ---
const ChapterEditorModal: React.FC<{ chapter: Chapter; onClose: () => void; onSave: (updated: Chapter) => void; onDelete: () => void; }> = ({ chapter, onClose, onSave, onDelete }) => {
  const [num, setNum] = useState(chapter.number.toString());
  const [title, setTitle] = useState(chapter.title);
  const [pages, setPages] = useState<string[]>(chapter.pages);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
      {editingIdx !== null && <ImageEditor src={pages[editingIdx]} onClose={() => setEditingIdx(null)} onSave={src => { const p = [...pages]; p[editingIdx] = src; setPages(p); setEditingIdx(null); }} />}
      <div className="bg-[#0f0f0f] w-full max-w-6xl p-8 rounded-[3rem] border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8"><h2 className="text-3xl font-black text-white italic uppercase">Edit Chapter</h2><button onClick={onClose} className="text-zinc-500 bg-white/5 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all">&times;</button></div>
        <div className="grid lg:grid-cols-4 gap-10">
          <div className="space-y-6">
            <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5 space-y-4">
              <input type="number" step="0.1" value={num} onChange={e => setNum(e.target.value)} className="w-full bg-black border border-white/5 rounded-xl p-3 text-white font-bold outline-none" placeholder="Num" />
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/5 rounded-xl p-3 text-white font-bold outline-none" placeholder="Title" />
            </div>
            <button onClick={() => onSave({ ...chapter, number: parseFloat(num), title, pages })} className="w-full bg-indigo-600 py-4 rounded-2xl font-black uppercase shadow-xl">Update Chapter</button>
            <button onClick={() => window.confirm('Устгах уу?') && onDelete()} className="w-full bg-red-600/10 text-red-500 py-4 rounded-2xl font-black uppercase border border-red-600/20">Delete Chapter</button>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 bg-black p-6 rounded-[2rem] min-h-[50vh] content-start">
            {pages.map((p, i) => (
              <div key={i} className="relative group aspect-[2/3] bg-zinc-900 rounded-2xl overflow-hidden border border-white/5">
                <img src={p} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-3"><button onClick={() => setEditingIdx(i)} className="bg-indigo-600 text-[10px] font-black uppercase px-6 py-2 rounded-xl">Edit</button><button onClick={() => setPages(pages.filter((_, idx) => idx !== i))} className="bg-red-600/20 text-red-500 text-[10px] font-black uppercase px-6 py-2 rounded-xl">Remove</button></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Home ---
const Home: React.FC<{ mangaList: Manga[] }> = ({ mangaList }) => {
  const [search, setSearch] = useState('');
  const filtered = mangaList.filter(m => m.title.toLowerCase().includes(search.toLowerCase()) || m.author.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-16 pt-10"><h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white uppercase italic leading-none">Epic <span className="text-indigo-600">Stories</span></h1><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full max-w-2xl mt-8 bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 text-white font-bold outline-none focus:border-indigo-600 shadow-2xl" /></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-10">{filtered.map(manga => <MangaCard key={manga.id} manga={manga} />)}</div>
    </div>
  );
};

// --- Manga Detail ---
const MangaDetail: React.FC<{ mangaList: Manga[], user: User | null, onUpdateManga: (manga: Manga) => void, onDeleteManga: (id: string) => void }> = ({ mangaList, user, onUpdateManga, onDeleteManga }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const manga = mangaList.find(m => m.id === id);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [chNumber, setChNumber] = useState('');
  const [chTitle, setChTitle] = useState('');
  const [chPages, setChPages] = useState<string[]>([]);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingManga, setEditingManga] = useState(false);

  if (!manga) return null;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-16">
      {editingManga && <MangaEditModal manga={manga} onClose={() => setEditingManga(false)} onSave={u => { onUpdateManga(u); setEditingManga(false); }} onDelete={() => { onDeleteManga(manga.id); navigate('/'); }} />}
      {editingChapter && <ChapterEditorModal chapter={editingChapter} onClose={() => setEditingChapter(null)} onSave={u => { onUpdateManga({ ...manga, chapters: manga.chapters.map(c => c.id === u.id ? u : c) }); setEditingChapter(null); }} onDelete={() => { onUpdateManga({ ...manga, chapters: manga.chapters.filter(c => c.id !== editingChapter.id) }); setEditingChapter(null); }} />}
      <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">
        <div className="w-full lg:w-[400px] shrink-0 space-y-10">
          <div className="relative group/main"><img src={manga.coverUrl} className="w-full rounded-[3rem] shadow-2xl border border-white/5" />{isAdmin && <button onClick={() => setEditingManga(true)} className="absolute inset-0 bg-black/40 opacity-0 group-hover/main:opacity-100 flex items-center justify-center font-black uppercase text-xs rounded-[3rem]">Edit Info</button>}</div>
        </div>
        <div className="flex-1 space-y-12">
          <h1 className="text-6xl md:text-8xl font-black leading-none text-white uppercase italic">{manga.title}</h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">{manga.description}</p>
          {isAdmin && <button onClick={() => setShowAddChapter(!showAddChapter)} className="bg-indigo-600 px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">Add Chapter</button>}
          {showAddChapter && (
            <form onSubmit={(e) => { e.preventDefault(); onUpdateManga({ ...manga, chapters: [...manga.chapters, { id: `ch-${Date.now()}`, number: parseFloat(chNumber), title: chTitle, pages: chPages, createdAt: new Date().toLocaleDateString() }] }); setShowAddChapter(false); setChPages([]); }} className="p-10 bg-[#0f0f0f] rounded-[3rem] space-y-6 border border-white/5 shadow-2xl">
              <div className="grid md:grid-cols-2 gap-6"><input type="number" step="0.1" value={chNumber} onChange={e => setChNumber(e.target.value)} className="bg-black border border-white/5 rounded-2xl p-4 text-white font-bold" placeholder="Num" required /><input value={chTitle} onChange={e => setChTitle(e.target.value)} className="bg-black border border-white/5 rounded-2xl p-4 text-white font-bold" placeholder="Title" required /></div>
              {/* Fix: Explicitly cast target to HTMLInputElement and map items to File to resolve TypeScript error on line 421 */}
              <input type="file" multiple onChange={async e => { const target = e.target as HTMLInputElement; if (target.files) setChPages(await Promise.all(Array.from(target.files).map(f => processImageFile(f as File)))); }} className="hidden" id="ch-upload" /><label htmlFor="ch-upload" className="block border-2 border-dashed border-white/5 p-12 rounded-[2rem] text-center cursor-pointer font-black text-xs text-zinc-500 uppercase">{chPages.length > 0 ? `${chPages.length} Pages Ready` : 'Upload Pages'}</label>
              <button className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase shadow-xl">Create Chapter</button>
            </form>
          )}
          <div className="space-y-8"><h2 className="text-4xl font-black italic">Chapters</h2><div className="grid gap-4">{[...manga.chapters].sort((a,b) => b.number - a.number).map(chapter => (
            <div key={chapter.id} className="bg-[#0f0f0f] p-6 rounded-[2.5rem] flex items-center justify-between group border border-white/5 hover:border-indigo-600/30 transition-all"><div onClick={() => navigate(`/reader/${manga.id}/${chapter.id}`)} className="flex-1 cursor-pointer"><div className="text-indigo-600 font-black text-3xl italic">#{chapter.number}</div><div className="font-black text-xl text-white mt-1">{chapter.title}</div></div>{isAdmin && <button onClick={() => setEditingChapter(chapter)} className="p-4 bg-indigo-600/10 text-indigo-500 rounded-2xl font-black text-[10px] uppercase opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>}</div>
          ))}</div></div>
        </div>
      </div>
    </div>
  );
};

// --- Admin Panel ---
const AdminPanel: React.FC<{ 
  mangaList: Manga[], admins: AdminAccount[], onAddManga: (m: Manga) => void, onSyncToCloud: () => void, 
  onFetchFromCloud: () => void, onDeleteManga: (id: string) => void, onAddAdmin: (a: AdminAccount) => void,
  onDeleteAdmin: (u: string) => void, cloudStatus: string, currentUser: User | null
}> = (props) => {
  const [activeTab, setActiveTab] = useState<'content' | 'staff'>('content');
  const [newManga, setNewManga] = useState({ title: '', author: '', description: '', coverUrl: '' });
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-16 space-y-16">
      <div className="bg-[#0f0f0f] p-10 md:p-16 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-10">
        <div className="relative z-10">
          <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter">Command Center</h1>
          <div className="flex gap-4 mt-8">
            <button onClick={() => setActiveTab('content')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'content' ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:text-white'}`}>Content</button>
            <button onClick={() => setActiveTab('staff')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'staff' ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:text-white'}`}>Staff</button>
          </div>
        </div>
        <div className="flex gap-4 relative z-10">
          <button onClick={props.onSyncToCloud} className="bg-indigo-600 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-500 transition-all">Sync Cloud</button>
          <div className="px-8 py-3.5 bg-black border border-white/5 rounded-2xl text-[10px] text-indigo-400 font-black uppercase">{props.cloudStatus}</div>
        </div>
      </div>

      {activeTab === 'content' ? (
        <div className="grid lg:grid-cols-2 gap-16">
          <form onSubmit={e => { e.preventDefault(); props.onAddManga({ id: `m-${Date.now()}`, title: newManga.title, author: newManga.author, description: newManga.description, coverUrl: newManga.coverUrl || 'https://picsum.photos/400/600', gallery: [], genre: ['Manga'], status: 'Ongoing', rating: 5.0, chapters: [] }); navigate(`/manga/m-${Date.now()}`); }} className="space-y-10 bg-[#0f0f0f] p-10 md:p-14 rounded-[3.5rem] border border-white/5 shadow-2xl">
            <h2 className="text-3xl font-black italic uppercase">Add Manga</h2>
            <div className="space-y-6">
              <input value={newManga.title} onChange={e => setNewManga({...newManga, title: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none" placeholder="Title" required />
              <input value={newManga.author} onChange={e => setNewManga({...newManga, author: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none" placeholder="Author" required />
              <textarea value={newManga.description} onChange={e => setNewManga({...newManga, description: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white h-44 outline-none" placeholder="Description" required />
              {/* Fix: Cast event target to HTMLInputElement and files to File to prevent TypeScript errors when processing cover upload */}
              <input type="file" onChange={async e => { const target = e.target as HTMLInputElement; if (target.files?.[0]) setNewManga({...newManga, coverUrl: await processImageFile(target.files[0] as File)}); }} className="hidden" id="m-cover-add" /><label htmlFor="m-cover-add" className="block border-2 border-dashed border-white/5 p-12 rounded-[2rem] text-center cursor-pointer text-zinc-600 font-black uppercase text-xs hover:bg-white/5">{newManga.coverUrl ? 'Ready' : 'Cover Art'}</label>
              <button className="w-full bg-indigo-600 py-6 rounded-2xl font-black uppercase">Initialize Series</button>
            </div>
          </form>
          <div className="bg-[#0f0f0f] p-10 md:p-14 rounded-[3.5rem] border border-white/5 shadow-2xl space-y-8">
             <h2 className="text-3xl font-black italic uppercase">Inventory</h2>
             <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 scrollbar-hide">{props.mangaList.map(m => (
                <div key={m.id} className="flex items-center justify-between p-5 bg-black rounded-[2rem] border border-white/5 group transition-all hover:border-indigo-600/40"><div className="flex items-center gap-6"><img src={m.coverUrl} className="w-14 h-20 object-cover rounded-xl" /><span className="font-black text-white">{m.title}</span></div><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => navigate(`/manga/${m.id}`)} className="p-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase">Manage</button><button onClick={() => props.onDeleteManga(m.id)} className="p-3 bg-red-600/10 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white">Del</button></div></div>
              ))}</div>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-16">
          <form onSubmit={e => { e.preventDefault(); props.onAddAdmin({ ...newAdmin, isSuperAdmin: false }); setNewAdmin({username:'', password:''}); }} className="space-y-10 bg-[#0f0f0f] p-10 md:p-14 rounded-[3.5rem] border border-white/5 shadow-2xl">
            <h2 className="text-3xl font-black italic uppercase">New Staff</h2>
            <div className="space-y-6">
              <input value={newAdmin.username} onChange={e => setNewAdmin({...newAdmin, username: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none" placeholder="Username" required />
              <input type="password" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none" placeholder="Password" required />
              <button className="w-full bg-indigo-600 py-6 rounded-2xl font-black uppercase">Grant Access</button>
            </div>
          </form>
          <div className="bg-[#0f0f0f] p-10 md:p-14 rounded-[3.5rem] border border-white/5 shadow-2xl space-y-8">
            <h2 className="text-3xl font-black italic uppercase">Personnel</h2>
            <div className="space-y-4">{props.admins.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-6 bg-black rounded-[2rem] border border-white/5 group transition-all hover:border-indigo-600/20">
                <div className="flex items-center gap-4"><div className="w-12 h-12 bg-indigo-600/10 text-indigo-500 rounded-2xl flex items-center justify-center font-black">A</div><div><div className="font-black text-white">{a.username}</div><div className="text-[10px] text-zinc-600 uppercase font-black">{a.isSuperAdmin ? 'Super User' : 'Staff'}</div></div></div>
                {!a.isSuperAdmin && <button onClick={() => props.onDeleteAdmin(a.username)} className="text-red-500 font-black uppercase text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Revoke</button>}
              </div>
            ))}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const Reader: React.FC<{ mangaList: Manga[] }> = ({ mangaList }) => {
  const { mangaId, chapterId } = useParams();
  const manga = mangaList.find(m => m.id === mangaId);
  const chapter = manga?.chapters.find(c => c.id === chapterId);
  if (!chapter) return null;
  return (
    <div className="bg-[#050505] min-h-screen">
      <div className="max-w-4xl mx-auto pb-32">
        <div className="sticky top-0 bg-[#050505]/95 backdrop-blur-2xl p-6 flex items-center justify-between z-50 border-b border-white/5">
          <button onClick={() => window.history.back()} className="px-6 py-3 bg-white/5 rounded-2xl text-white font-black text-xs uppercase hover:bg-white/10 transition-all">← Back</button>
          <div className="text-center"><h2 className="font-black text-lg text-white truncate max-w-[200px]">{manga?.title}</h2><p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.3em]">Chapter {chapter.number}</p></div>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{chapter.pages.length} Pages</span>
        </div>
        <div className="flex flex-col gap-2 mt-6">{chapter.pages.map((p, i) => <img key={i} src={p} className="w-full h-auto block shadow-2xl" loading="lazy" />)}</div>
      </div>
    </div>
  );
};

// --- App ---
const App: React.FC = () => {
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>(() => {
    const saved = localStorage.getItem('rgt_admins');
    return saved ? JSON.parse(saved) : [{ username: ADMIN_CREDENTIALS.username, password: ADMIN_CREDENTIALS.password, isSuperAdmin: true }];
  });
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('auth_state');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false };
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [cloudStatus, setCloudStatus] = useState('Standby');

  useEffect(() => {
    const saved = localStorage.getItem('manga_list');
    if (saved) setMangaList(JSON.parse(saved));
    else setMangaList(INITIAL_MANGA);
    handleFetchFromCloud();
  }, []);

  useEffect(() => { localStorage.setItem('manga_list', JSON.stringify(mangaList)); }, [mangaList]);
  useEffect(() => { localStorage.setItem('rgt_admins', JSON.stringify(admins)); }, [admins]);
  useEffect(() => { localStorage.setItem('auth_state', JSON.stringify(authState)); }, [authState]);

  const handleSyncToCloud = async (ovAdmins?: AdminAccount[], ovManga?: Manga[]) => {
    const sb = getSupabase(); if (!sb) return;
    setCloudStatus('Syncing...');
    try {
      const targetAdmins = ovAdmins || admins;
      const targetManga = ovManga || mangaList;
      const mangaData = targetManga.map(m => ({ id: m.id, data: m }));
      if (mangaData.length > 0) await sb.from('manga').upsert(mangaData);
      await sb.from('config').upsert({ id: 'admins_list', data: targetAdmins });
      setCloudStatus('Success'); setTimeout(() => setCloudStatus('Standby'), 3000);
    } catch (e) { setCloudStatus('Error'); }
  };

  const handleFetchFromCloud = async () => {
    const sb = getSupabase(); if (!sb) return;
    try {
      const { data: mData } = await sb.from('manga').select('*');
      if (mData?.length) setMangaList(mData.map((i: any) => i.data));
      const { data: cData } = await sb.from('config').select('*').eq('id', 'admins_list').single();
      if (cData?.data) setAdmins(cData.data);
    } catch (e) { }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'login') {
      const found = admins.find(a => a.username === authForm.username && a.password === authForm.password);
      if (found) { setAuthState({ user: { username: found.username, role: 'admin' }, isAuthenticated: true }); setShowAuthModal(false); }
      else alert("Authentication failed.");
    } else {
      if (admins.some(a => a.username === authForm.username)) return alert("User exists.");
      const newUser = { username: authForm.username, password: authForm.password, isSuperAdmin: false };
      const upAdmins = [...admins, newUser]; setAdmins(upAdmins); await handleSyncToCloud(upAdmins);
      setAuthState({ user: { username: authForm.username, role: 'admin' }, isAuthenticated: true }); setShowAuthModal(false);
    }
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar user={authState.user} onLogout={() => setAuthState({ user: null, isAuthenticated: false })} onOpenAuth={() => setShowAuthModal(true)} />
        <main className="flex-1 bg-[#050505]">
          <Routes>
            <Route path="/" element={<Home mangaList={mangaList} />} />
            <Route path="/manga/:id" element={<MangaDetail mangaList={mangaList} user={authState.user} onUpdateManga={u => { const newList = mangaList.map(m => m.id === u.id ? u : m); setMangaList(newList); handleSyncToCloud(admins, newList); }} onDeleteManga={id => { const newList = mangaList.filter(m => m.id !== id); setMangaList(newList); handleSyncToCloud(admins, newList); }} />} />
            <Route path="/reader/:mangaId/:chapterId" element={<Reader mangaList={mangaList} />} />
            <Route path="/admin" element={authState.user?.role === 'admin' ? <AdminPanel mangaList={mangaList} admins={admins} onAddManga={m => { const nl = [m, ...mangaList]; setMangaList(nl); handleSyncToCloud(admins, nl); }} onSyncToCloud={() => handleSyncToCloud()} onFetchFromCloud={handleFetchFromCloud} onDeleteManga={id => { const nl = mangaList.filter(m => m.id !== id); setMangaList(nl); handleSyncToCloud(admins, nl); }} onAddAdmin={a => { const upAdmins = [...admins, a]; setAdmins(upAdmins); handleSyncToCloud(upAdmins); }} onDeleteAdmin={u => { const upAdmins = admins.filter(a => a.username !== u); setAdmins(upAdmins); handleSyncToCloud(upAdmins); }} cloudStatus={cloudStatus} currentUser={authState.user} /> : <Home mangaList={mangaList} />} />
          </Routes>
        </main>
        {showAuthModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl">
            <div className="bg-[#0f0f0f] w-full max-w-md p-12 rounded-[3.5rem] border border-white/5 shadow-2xl scale-in">
              <div className="flex gap-8 mb-10 border-b border-white/5 pb-2"><button onClick={() => setAuthMode('login')} className={`text-xl font-black uppercase italic ${authMode === 'login' ? 'text-indigo-500' : 'text-zinc-600'}`}>Sign In</button><button onClick={() => setAuthMode('register')} className={`text-xl font-black uppercase italic ${authMode === 'register' ? 'text-indigo-500' : 'text-zinc-600'}`}>Create Account</button></div>
              <form onSubmit={handleAuthSubmit} className="space-y-6">
                <input value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none" placeholder="Username" required />
                <input type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} className="w-full bg-black border border-white/5 rounded-2xl p-5 text-white font-bold outline-none" placeholder="Password" required />
                <button className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase shadow-xl hover:bg-indigo-500 transition-all">{authMode === 'login' ? 'Login' : 'Register'}</button>
                <button type="button" onClick={() => setShowAuthModal(false)} className="w-full text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] hover:text-white mt-4">Dismiss</button>
              </form>
            </div>
          </div>
        )}
        <footer className="p-16 border-t border-white/5 bg-[#050505] text-center"><div className="text-2xl font-black italic">RGT <span className="text-indigo-600">MANGA</span></div></footer>
      </div>
    </HashRouter>
  );
};

export default App;
