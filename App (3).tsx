
import React, { useState, useEffect, useRef } from 'react';
import { User, Expense, Project, Note, Page, Lang } from './types';
import { I18N } from './constants';
import { parseVoiceCommand, generateSpeech } from './services/geminiService';

const LogoSVG = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M35 38V28H41V34" fill="#FF6622" />
    <path d="M25 48L50 23L75 48" stroke="#FF6622" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M44 42V58C44 63 39 63 36 63" stroke="#FF6622" strokeWidth="9" strokeLinecap="round" />
    <path d="M56 42V63H71" stroke="#FF6622" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const App: React.FC = () => {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [lang, setLang] = useState<Lang>('zh');
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<string | undefined>(undefined);
  const [isVoiceOverlay, setIsVoiceOverlay] = useState(false);
  const [voiceResult, setVoiceResult] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);

  // Form states
  const [formVisible, setFormVisible] = useState<string | null>(null);
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [noteText, setNoteText] = useState('');
  const [projName, setProjName] = useState('');
  const [projPhone, setProjPhone] = useState('');

  const t = I18N[lang];
  const recognitionRef = useRef<any>(null);
  const voiceTargetRef = useRef<'global' | 'note' | 'expense'>('global');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    const savedUser = localStorage.getItem('jl_user');
    const savedExp = localStorage.getItem('jl_exp');
    const savedProj = localStorage.getItem('jl_proj');
    const savedNotes = localStorage.getItem('jl_notes');
    const savedLang = localStorage.getItem('jl_lang');

    if (savedUser && savedUser !== "null" && savedUser !== "undefined") {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.phone) setUser(parsed);
      } catch (e) {
        console.error("User parse error");
      }
    }

    const ensureIds = (dataStr: string | null, prefix: string) => {
      if (!dataStr) return [];
      try {
        const data = JSON.parse(dataStr);
        return data.map((item: any, idx: number) => ({
          ...item,
          id: item.id || `${prefix}-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`
        }));
      } catch (e) {
        return [];
      }
    };

    setExpenses(ensureIds(savedExp, 'exp'));
    setProjects(ensureIds(savedProj, 'proj'));
    setNotes(ensureIds(savedNotes, 'note'));
    if (savedLang) setLang(savedLang as Lang);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('jl_exp', JSON.stringify(expenses));
      localStorage.setItem('jl_proj', JSON.stringify(projects));
      localStorage.setItem('jl_notes', JSON.stringify(notes));
      localStorage.setItem('jl_lang', lang);
    }
  }, [expenses, projects, notes, lang, user]);

  // --- Handlers ---
  const handleAuth = () => {
    const nameInput = document.getElementById('auth-name') as HTMLInputElement;
    const phoneInput = document.getElementById('auth-phone') as HTMLInputElement;
    const passInput = document.getElementById('auth-pass') as HTMLInputElement;
    
    const nameValue = nameInput?.value || (lang === 'zh' ? '师傅' : 'Master');
    const phoneValue = phoneInput?.value;
    const passValue = passInput?.value;
    
    if (!phoneValue) {
      alert(lang === 'zh' ? "请输入手机号" : "Please enter phone number");
      return;
    }
    if (!passValue) {
      alert(lang === 'zh' ? "请输入密码" : "Please enter password");
      return;
    }

    const newUser = { name: nameValue, phone: phoneValue };
    setUser(newUser);
    localStorage.setItem('jl_user', JSON.stringify(newUser));
  };

  const logout = (e: React.MouseEvent) => {
    e.preventDefault();
    const confirmMsg = lang === 'zh' ? '确定要退出系统并返回登录页面吗？' : 'Confirm logout?';
    if (window.confirm(confirmMsg)) {
      localStorage.removeItem('jl_user');
      setUser(null);
      setCurrentPage('home');
      setFormVisible(null);
    }
  };

  const resetAllData = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.confirm(t.clearConfirm)) {
      if (window.confirm(t.clearFinal)) {
        localStorage.clear();
        setUser(null);
        setExpenses([]);
        setProjects([]);
        setNotes([]);
        setCurrentPage('home');
        setFormVisible(null);
        alert(lang === 'zh' ? "所有数据已清空，系统已重置。" : "All data cleared. System reset.");
      }
    }
  };

  const toggleLang = () => setLang(prev => prev === 'zh' ? 'en' : 'zh');

  const addExpense = (amount: number, description: string, photo?: string) => {
    if (isNaN(amount) || amount <= 0) {
      alert(lang === 'zh' ? "请输入有效金额" : "Invalid amount");
      return;
    }
    const newExp: Expense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      amount,
      description: description || (lang === 'zh' ? '材料支出' : 'Materials'),
      photo,
      timestamp: Date.now()
    };
    setExpenses(prev => [newExp, ...prev]);
    setExpAmount('');
    setExpDesc('');
    setCurrentPhoto(undefined);
    setFormVisible(null);
  };

  const deleteExpense = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm(lang === 'zh' ? '确认删除这条账目？' : 'Delete this record?')) {
      setExpenses(prev => prev.filter(e => e.id !== id));
    }
  };

  const addNote = (text: string) => {
    if (!text.trim()) return;
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      timestamp: Date.now()
    };
    setNotes(prev => [newNote, ...prev]);
    setNoteText('');
    setFormVisible(null);
  };

  const deleteNote = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm(lang === 'zh' ? '确定删除这条记事？' : 'Delete this note?')) {
      setNotes(prev => prev.filter(n => n.id !== id));
    }
  };

  const addProject = (name: string, phone: string) => {
    if (!name.trim()) return;
    const newProj: Project = {
      id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.toUpperCase(),
      phone,
      progress: 0
    };
    setProjects(prev => [newProj, ...prev]);
    setProjName('');
    setProjPhone('');
    setFormVisible(null);
  };

  const deleteProject = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm(lang === 'zh' ? '确定删除该项目？' : 'Delete this project?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
    }
  };

  const triggerCamera = (expenseId?: string) => {
    setPendingPhotoId(expenseId || null);
    setTimeout(() => {
      if (fileInputRef.current) fileInputRef.current.click();
    }, 50);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (pendingPhotoId) {
          setExpenses(prev => prev.map(exp => 
            exp.id === pendingPhotoId ? { ...exp, photo: result } : exp
          ));
          setPendingPhotoId(null);
        } else {
          setCurrentPhoto(result);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleVoiceFinish = async () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    const transcript = voiceResult.trim();
    if (!transcript) {
      setIsVoiceOverlay(false);
      return;
    }

    const target = voiceTargetRef.current;
    if (target === 'note') {
      setNoteText(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsVoiceOverlay(false);
    } else if (target === 'expense') {
      setExpDesc(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsVoiceOverlay(false);
    } else {
      setAiThinking(true);
      const result = await parseVoiceCommand(transcript, lang);
      setAiThinking(false);
      if (result.feedback) generateSpeech(result.feedback);

      setTimeout(() => {
        setIsVoiceOverlay(false);
        if (result.action === 'add_expense') {
          addExpense(result.data.amount || 0, result.data.description || '');
          setCurrentPage('accounting');
        } else if (result.action === 'add_note') {
          addNote(result.data.text || transcript);
          setCurrentPage('notes');
        } else if (result.action === 'add_project') {
          addProject(result.data.name || 'NEW SITE', result.data.phone || '');
          setCurrentPage('projects');
        }
      }, 800);
    }
  };

  const startVoice = (target: 'global' | 'note' | 'expense' = 'global') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser does not support voice.");
    voiceTargetRef.current = target;
    setIsVoiceOverlay(true);
    setVoiceResult('');
    setAiThinking(false);
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    recognition.continuous = true; 
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setVoiceResult(final + interim);
    };
    recognition.onerror = () => setIsVoiceOverlay(false);
    recognition.start();
  };

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const netValue = totalSpent / 1.13;
  const hstValue = totalSpent - netValue;

  // --- Auth View ---
  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center h-screen w-full bg-white p-8 max-w-[400px] mx-auto shadow-2xl overflow-hidden relative">
        <LogoSVG className="w-24 h-24 mb-6" />
        <h1 className="text-3xl font-black text-brand italic mb-8 tracking-tighter text-center uppercase">JL MASTER PRO</h1>
        <div className="w-full space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-slate-800 uppercase">{isLoginMode ? t.authT : t.regT}</h2>
            <div className="inline-block px-2 py-0.5 mt-1 bg-brand/10 text-brand text-[8px] font-black rounded uppercase tracking-widest">Master Trial Beta v1.0</div>
          </div>
          {!isLoginMode && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Full Name (师傅姓名)</label>
              <input id="auth-name" type="text" placeholder="e.g. Master Zhang" className="w-full border-2 p-4 rounded-2xl focus:border-brand outline-none transition-all shadow-sm" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Phone Number (手机号)</label>
            <input id="auth-phone" type="tel" placeholder="416-000-0000" className="w-full border-2 p-4 rounded-2xl focus:border-brand outline-none transition-all shadow-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t.password} (登录密码)</label>
            <input id="auth-pass" type="password" placeholder="••••••••" className="w-full border-2 p-4 rounded-2xl focus:border-brand outline-none transition-all shadow-sm" />
          </div>
          <button type="button" onClick={handleAuth} className="w-full bg-brand text-white py-5 rounded-2xl font-black text-lg active:scale-95 transition-all shadow-xl shadow-orange-100 uppercase mt-4">
            {isLoginMode ? t.authB : t.regB}
          </button>
          <p onClick={() => setIsLoginMode(!isLoginMode)} className="text-center text-sm font-bold text-slate-400 cursor-pointer underline hover:text-brand transition-colors pt-2">
            {isLoginMode ? t.authS : t.regS}
          </p>
        </div>
        <div className="absolute bottom-10 text-[9px] text-slate-300 font-bold uppercase tracking-[0.2em] text-center w-full px-8 leading-relaxed">
          Powered by Gemini AI<br/>Developed for Ontario Contractors
        </div>
      </div>
    );
  }

  // --- Main App View ---
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 max-w-[400px] mx-auto shadow-2xl overflow-hidden relative font-sans">
      <header className="h-14 px-4 flex justify-between items-center border-b shrink-0 bg-white shadow-sm z-30 safe-top">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPage('home')}>
          <LogoSVG className="w-8 h-8" />
          <span className="font-black text-brand italic text-base tracking-tighter">JL MASTER PRO</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleLang} className="bg-slate-100 px-2.5 py-1.5 rounded-lg text-[10px] font-black text-slate-500 uppercase active:bg-slate-200">
            {lang === 'zh' ? 'EN' : 'CN'}
          </button>
          <button type="button" onClick={resetAllData} className="px-2.5 py-1.5 bg-slate-50 text-slate-400 border border-slate-100 rounded-lg text-[10px] font-black uppercase active:bg-red-50 active:text-red-500 transition-colors" title="Reset All Data">
            <i className="fa-solid fa-trash-can mr-1"></i>{t.clearData}
          </button>
          <button type="button" onClick={logout} className="px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-black uppercase active:bg-red-100 transition-colors">
            {t.logout}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-5 pb-32">
        {currentPage === 'home' && (
          <div className="space-y-5 animate-fadeIn">
            <h3 className="text-lg font-black text-slate-800">{user?.name}{t.welcome}</h3>
            
            <div onClick={() => setCurrentPage('projects')} className="bg-white rounded-3xl p-6 border-l-[6px] border-brand shadow-md active:scale-95 transition-all cursor-pointer group">
                <span className="text-[10px] font-black text-brand uppercase tracking-widest block mb-1">{t.proj}</span>
                <h2 className="text-xl font-black text-slate-800 leading-none uppercase tracking-tight group-hover:text-brand transition-colors">
                    {projects[0]?.name || (lang === 'zh' ? "暂无工地项目" : "No Active Sites")}
                </h2>
                {projects.length > 0 && (
                  <div className="mt-4">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-brand h-full transition-all duration-700" style={{ width: `${projects[0]?.progress || 0}%` }}></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Current Progress</span>
                      <span className="text-[10px] font-black text-brand">{projects[0]?.progress}%</span>
                    </div>
                  </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div onClick={() => setCurrentPage('accounting')} className="bg-white rounded-3xl p-4 shadow-md active:scale-95 transition-all cursor-pointer border-2 border-transparent hover:border-brand/10">
                <div className="flex justify-between items-center mb-2">
                  <i className="fa-solid fa-file-invoice-dollar text-brand text-xl"></i>
                  <span className="text-[8px] font-black text-brand uppercase">{t.ledger}</span>
                </div>
                <h4 className="text-[9px] font-black text-slate-400 uppercase">{t.exp}</h4>
                <p className="text-xl font-black text-slate-800 tracking-tighter">$ {totalSpent.toFixed(2)}</p>
              </div>
              <div onClick={() => setCurrentPage('notes')} className="bg-emerald-50 rounded-3xl p-4 shadow-md border-2 border-emerald-100 active:scale-95 transition-all cursor-pointer hover:bg-emerald-100">
                <div className="flex justify-between items-center mb-2">
                  <i className="fa-solid fa-note-sticky text-emerald-600 text-xl"></i>
                  <span className="text-[8px] font-black text-emerald-700 uppercase">{t.note}</span>
                </div>
                <h4 className="text-[9px] font-black text-emerald-600 uppercase">{t.memo}</h4>
                <p className="text-xl font-black text-emerald-900">{notes.length} ITEMS</p>
              </div>
            </div>

            <div onClick={() => startVoice('global')} className="bg-navy rounded-3xl p-5 flex items-center gap-4 shadow-xl active:scale-95 transition-all cursor-pointer border-b-[4px] border-brand/50">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand to-orange-300 flex items-center justify-center text-white text-xl">
                  <i className="fa-solid fa-microphone-lines"></i>
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-navy"></span>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black text-xs uppercase tracking-wider">{t.sec}</span>
                <span className="text-brand text-[9px] font-bold uppercase tracking-widest opacity-80">Tap to talk to AI</span>
              </div>
            </div>
          </div>
        )}

        {/* --- Ledger Page --- */}
        {currentPage === 'accounting' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center mb-2">
              <button type="button" onClick={() => setCurrentPage('home')} className="text-xs font-black text-slate-500 uppercase flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm">
                <i className="fa-solid fa-arrow-left"></i> {t.back}
              </button>
              <button type="button" onClick={() => setFormVisible(formVisible === 'exp' ? null : 'exp')} className="w-11 h-11 bg-brand text-white rounded-2xl shadow-lg flex items-center justify-center font-bold text-2xl active:scale-90 transition-transform">+</button>
            </div>
            
            {formVisible === 'exp' && (
              <div className="bg-white p-5 rounded-2xl border-2 border-brand/30 space-y-4 shadow-xl animate-fadeIn">
                <div className="flex gap-3">
                  <input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder={t.amount} className="flex-1 border-2 p-3 rounded-xl text-sm outline-none focus:border-brand" />
                  <button type="button" onClick={() => triggerCamera()} className="w-14 h-12 bg-slate-50 rounded-xl text-brand flex items-center justify-center border-2 transition-colors active:bg-slate-200">
                    <i className="fa-solid fa-camera text-lg"></i>
                  </button>
                </div>
                <div className="flex gap-3">
                  <input type="text" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder={t.usage} className="flex-1 border-2 p-3 rounded-xl text-sm outline-none focus:border-brand" />
                  <button type="button" onClick={() => startVoice('expense')} className="w-14 h-12 bg-slate-50 text-brand rounded-xl flex items-center justify-center border-2 transition-all active:bg-slate-200">
                    <i className="fa-solid fa-microphone text-lg"></i>
                  </button>
                </div>
                <button type="button" onClick={() => addExpense(parseFloat(expAmount), expDesc, currentPhoto)} className="w-full bg-brand text-white py-4 rounded-xl text-sm font-black uppercase tracking-widest active:scale-95 shadow-md">
                  {t.save}
                </button>
              </div>
            )}

            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl border-b-[6px] border-brand">
              <p className="text-[9px] text-slate-500 font-black uppercase mb-3 italic tracking-widest text-center">{t.hst}</p>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-center">
                <div><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Net (税前)</p><p className="text-lg font-bold tracking-tighter text-slate-200">$ {netValue.toFixed(2)}</p></div>
                <div><p className="text-[10px] text-brand uppercase font-black mb-1">Tax (HST 13%)</p><p className="text-lg font-bold text-brand tracking-tighter">$ {hstValue.toFixed(2)}</p></div>
              </div>
              <div className="mt-6 text-center border-t border-slate-800 pt-5">
                <p className="text-4xl font-black text-white tracking-tighter italic">$ {totalSpent.toFixed(2)}</p>
                <p className="text-[9px] text-brand uppercase font-black mt-2 tracking-widest">Total Expenses Including Tax</p>
              </div>
            </div>

            <div className="space-y-3 pb-8">
              {expenses.map((item) => (
                <div key={item.id} className="bg-white border-2 rounded-2xl p-4 flex justify-between items-center shadow-sm animate-fadeIn group">
                  <div className="flex items-center gap-4">
                    {item.photo ? (
                      <div className="relative" onClick={() => triggerCamera(item.id)}>
                        <img src={item.photo} className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm active:scale-110 transition-all cursor-pointer" alt="receipt" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand text-white rounded-full flex items-center justify-center text-[10px] shadow-sm border-2 border-white">
                          <i className="fa-solid fa-camera"></i>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => triggerCamera(item.id)} className="w-14 h-14 bg-orange-50 flex flex-col items-center justify-center text-brand border-2 border-dashed border-orange-200 rounded-xl text-[8px] leading-tight active:bg-orange-100 transition-colors">
                        <i className="fa-solid fa-receipt mb-1 text-sm"></i>
                        <span className="font-black uppercase tracking-tighter">{lang === 'zh' ? '补拍照' : 'Receipt'}</span>
                      </button>
                    )}
                    <div className="flex flex-col">
                      <span className="text-slate-800 font-black text-xs leading-tight block truncate max-w-[120px] uppercase">{item.description}</span>
                      <span className="text-slate-400 font-bold text-[9px] mt-1 uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-black tracking-tighter text-slate-800">$ {item.amount.toFixed(2)}</span>
                    <button 
                      type="button"
                      onClick={(e) => deleteExpense(item.id, e)} 
                      className="w-10 h-10 flex items-center justify-center text-slate-200 hover:text-red-500 active:text-red-700 transition-all rounded-full bg-slate-50"
                    >
                      <i className="fa-solid fa-trash-can text-base"></i>
                    </button>
                  </div>
                </div>
              ))}
              {expenses.length === 0 && <p className="text-center py-16 text-xs text-slate-400 font-black uppercase opacity-50 italic tracking-widest">No financial records found.</p>}
            </div>
          </div>
        )}

        {/* --- Notes Page --- */}
        {currentPage === 'notes' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center mb-2">
              <button type="button" onClick={() => setCurrentPage('home')} className="text-xs font-black text-slate-500 uppercase flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm">
                <i className="fa-solid fa-arrow-left"></i> {t.back}
              </button>
              <button type="button" onClick={() => setFormVisible(formVisible === 'note' ? null : 'note')} className="w-11 h-11 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-center font-bold text-2xl active:scale-90">+</button>
            </div>
            {formVisible === 'note' && (
              <div className="bg-white p-5 rounded-2xl border-2 border-emerald-100 space-y-4 shadow-xl animate-fadeIn">
                <div className="relative">
                  <textarea rows={5} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t.memo} className="w-full border-2 p-4 pr-14 rounded-2xl text-sm focus:border-emerald-600 outline-none resize-none shadow-inner" />
                  <button type="button" onClick={() => startVoice('note')} className="absolute right-3 top-3 w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-sm active:bg-emerald-100">
                    <i className="fa-solid fa-microphone text-base"></i>
                  </button>
                </div>
                <button type="button" onClick={() => addNote(noteText)} className="w-full bg-emerald-700 text-white py-4 rounded-2xl text-sm font-black uppercase shadow-lg active:scale-95 transition-all">
                  {t.save}
                </button>
              </div>
            )}
            <div className="space-y-4 pb-12">
              {notes.map(noteItem => (
                <div key={noteItem.id} className="bg-emerald-50 border-l-[6px] border-emerald-700 p-5 rounded-r-3xl shadow-sm relative group animate-fadeIn flex justify-between items-start hover:shadow-md transition-shadow">
                  <div className="flex-1 pr-6">
                    <div className="font-bold text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap">{noteItem.text}</div>
                    <div className="text-[9px] text-emerald-600/50 mt-3 font-black uppercase tracking-widest">{new Date(noteItem.timestamp).toLocaleString()}</div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => deleteNote(noteItem.id, e)} 
                    className="w-10 h-10 flex items-center justify-center text-emerald-200 hover:text-red-500 active:text-red-700 transition-colors bg-white/40 rounded-full border border-emerald-100 hover:border-red-200"
                  >
                    <i className="fa-solid fa-trash-can text-base"></i>
                  </button>
                </div>
              ))}
              {notes.length === 0 && <p className="text-center py-16 text-xs text-slate-400 font-black uppercase opacity-50 italic tracking-widest">Materials notebook is empty.</p>}
            </div>
          </div>
        )}

        {/* --- Projects Page --- */}
        {currentPage === 'projects' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center mb-2">
              <button type="button" onClick={() => setCurrentPage('home')} className="text-xs font-black text-slate-500 uppercase flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm">
                <i className="fa-solid fa-arrow-left"></i> {t.back}
              </button>
              <button type="button" onClick={() => setFormVisible(formVisible === 'proj' ? null : 'proj')} className="w-11 h-11 bg-brand text-white rounded-2xl shadow-lg flex items-center justify-center font-bold text-2xl active:scale-90">+</button>
            </div>
            {formVisible === 'proj' && (
              <div className="bg-white p-5 rounded-2xl border-2 border-brand/20 space-y-4 shadow-xl animate-fadeIn">
                <input type="text" value={projName} onChange={(e) => setProjName(e.target.value)} placeholder={t.siteName} className="w-full border-2 p-3.5 rounded-xl text-sm outline-none focus:border-brand" />
                <input type="tel" value={projPhone} onChange={(e) => setProjPhone(e.target.value)} placeholder={t.ownerPhone} className="w-full border-2 p-3.5 rounded-xl text-sm outline-none focus:border-brand" />
                <button type="button" onClick={() => addProject(projName, projPhone)} className="w-full bg-brand text-white py-4 rounded-xl text-sm font-black uppercase shadow-md active:scale-95">{t.save}</button>
              </div>
            )}
            <div className="space-y-4 pb-12">
              {projects.map(projectItem => (
                <div key={projectItem.id} className="bg-white border-2 rounded-3xl p-5 flex justify-between items-center shadow-sm animate-fadeIn hover:shadow-md transition-shadow">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-black uppercase tracking-tight text-slate-800">{projectItem.name}</span>
                    <span className="text-slate-400 font-bold text-[10px] tracking-widest">{projectItem.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={`tel:${projectItem.phone}`} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-brand active:bg-brand active:text-white transition-colors border-2 shadow-sm"><i className="fa-solid fa-phone text-xl"></i></a>
                    <button 
                      type="button"
                      onClick={(e) => deleteProject(projectItem.id, e)} 
                      className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 hover:text-red-500 active:text-red-700 transition-colors border-2 shadow-sm"
                    >
                      <i className="fa-solid fa-trash-can text-xl"></i>
                    </button>
                  </div>
                </div>
              ))}
              {projects.length === 0 && <p className="text-center py-16 text-xs text-slate-400 font-black uppercase opacity-50 italic tracking-widest">No site projects listed.</p>}
            </div>
          </div>
        )}
      </main>

      <footer className="h-24 bg-white border-t shrink-0 flex items-center justify-between px-12 relative z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] safe-bottom">
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">JL MASTER</span>
        <div className="absolute -top-10 left-1/2 -translate-x-1/2">
          <button type="button" onClick={() => startVoice('global')} className="w-20 h-20 bg-brand rounded-full flex items-center justify-center text-white text-3xl shadow-2xl border-[6px] border-white active:scale-90 transition-all hover:bg-orange-600 animate-pulse">
            <i className="fa-solid fa-microphone"></i>
          </button>
        </div>
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">PRO AI</span>
      </footer>

      {isVoiceOverlay && (
        <div className="absolute inset-0 bg-brand/95 z-[100] flex flex-col items-center justify-center text-white p-8 text-center animate-fadeIn backdrop-blur-md safe-top safe-bottom">
          <div className="mb-12 relative">
            <div className="absolute -inset-10 bg-white/20 rounded-full animate-ping"></div>
            <i className="fa-solid fa-microphone-lines text-7xl relative z-10"></i>
          </div>
          <h3 className="text-2xl font-black tracking-tight mb-4 uppercase tracking-widest">
            {aiThinking ? t.loadingAI : (lang === 'zh' ? '师傅请说话' : 'Ready for Command') }
          </h3>
          <div className="text-base mt-4 font-black italic opacity-95 min-h-[12rem] bg-black/10 p-8 rounded-3xl w-full flex items-center justify-center shadow-inner overflow-y-auto backdrop-blur-md border border-white/20">
            {voiceResult ? `“${voiceResult}”` : (lang === 'zh' ? "我在听，请直接说出金额、用途或材料需求..." : "Listening... Tell me what you spent or what materials you need.")}
          </div>
          <div className="flex gap-5 mt-14 w-full justify-center">
            <button type="button" onClick={() => { if(recognitionRef.current) recognitionRef.current.abort(); setIsVoiceOverlay(false); }} className="flex-1 max-w-[140px] border-2 border-white/30 px-6 py-4 rounded-full text-xs font-black tracking-widest uppercase active:bg-white/10 transition-colors">
              {t.cancel}
            </button>
            <button type="button" onClick={handleVoiceFinish} className="flex-1 max-w-[140px] bg-white text-brand px-6 py-4 rounded-full text-xs font-black tracking-widest shadow-2xl uppercase active:scale-95 hover:bg-slate-50 transition-all">
              {lang === 'zh' ? '说完确认' : 'DONE'}
            </button>
          </div>
        </div>
      )}

      <input 
        type="file"
        ref={fileInputRef} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        onChange={handleImage} 
      />
    </div>
  );
};

export default App;
