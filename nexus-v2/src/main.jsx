import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Brain, ChevronDown, CircleAlert, FileUp, Lightbulb, MessageSquare, PanelTop, Plus, RotateCcw, Send, Sparkles, Target, Trash2, Upload, Users, X, Home, Search, Database, Clock, CheckCircle2, AlertTriangle, Flag, Zap, Calendar, ArrowRight, FolderKanban, Sparkles as SparklesIcon, Filter, LayoutGrid, List, Download, Wand2 } from 'lucide-react';
import { GPTLogo, ClaudeLogo, V0Logo, NotebookLMLogo, ProviderBadge } from './logos.jsx';
import './styles.css';

const PROVIDERS = {
  gpt: { name:'GPT', Logo: GPTLogo, desc:'Racional, estratégia e decisão' },
  claude: { name:'Claude', Logo: ClaudeLogo, desc:'Contexto, nuance e contradições' },
  v0: { name:'v0', Logo: V0Logo, desc:'Produto, UX e implementação' },
  notebooklm: { name:'NotebookLM', Logo: NotebookLMLogo, desc:'Fontes e conhecimento pessoal' },
};

const TABS = [
  { id: 'home',    label: 'Home',    icon: Home },
  { id: 'chat',    label: 'Chat',    icon: MessageSquare },
  { id: 'memory',  label: 'Memória', icon: Database },
];

const MEM_FILTERS = [
  { id: 'all',            label: 'Tudo' },
  { id: 'goal',           label: 'Objetivos' },
  { id: 'decision',       label: 'Decisões' },
  { id: 'idea',           label: 'Ideias' },
  { id: 'pattern',        label: 'Padrões' },
  { id: 'warning',        label: 'Alertas' },
  { id: 'contradiction',  label: 'Contradições' },
  { id: 'reminder',       label: 'Lembretes' },
  { id: 'resume_later',   label: 'Retomar' },
  { id: 'insight',        label: 'Insights' },
];

const TYPE_ICON = {
  decision: '✅', idea: '💡', pattern: '🔁', warning: '⚠️', goal: '🎯',
  reminder: '📌', resume_later: '↩️', contradiction: '⚡', insight: '✨',
};

function fmtDate(iso){
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff/60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff/3600)} h atrás`;
  if (diff < 86400 * 7) return `${Math.floor(diff/86400)} d atrás`;
  return d.toLocaleDateString('pt-BR');
}

function parseSuggested(text) {
  if (!text) return [];
  const section = text.match(/MEMÓRIA SUGERIDA[\s\S]*/i)?.[0];
  if (!section) return [];
  const lines = section.split('\n').slice(1).map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const raw of lines.slice(0, 8)) {
    const line = raw.replace(/^[-•*]\s*/, '').trim();
    const m = line.match(/^\[?\s*(DECISAO|DECISÃO|IDEIA|PADRAO|PADRÃO|ALERTA|OBJETIVO|LEMBRETE|RETOMAR|INSIGHT)\s*\]?\s*[:\-\s]*(.*)$/i);
    let type = 'insight'; let text2 = line;
    if (m) {
      const k = m[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const map = { decisao: 'decision', ideia: 'idea', padrao: 'pattern', alerta: 'warning', objetivo: 'goal', lembrete: 'reminder', retomar: 'resume_later', insight: 'insight' };
      type = map[k] || 'insight';
      text2 = m[2].trim() || line;
    }
    if (text2?.trim()) out.push({ type, text: text2.trim().slice(0, 500) });
  }
  return out;
}

function BubbleCloud({ items, onPick }) {
  const bubbles = useMemo(() => {
    const buckets = {};
    for (const it of items) {
      const key = it.type || 'insight';
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(it);
    }
    return Object.entries(buckets).map(([type, list]) => ({ type, items: list }));
  }, [items]);

  return (
    <div className="bubbleCloud">
      {!bubbles.length && <div className="emptyHint">Nenhuma memória ainda. Adicione ideias, decisões ou converse.</div>}
      {bubbles.map(({ type, items }) => {
        const meta = items[0];
        return (
          <div key={type} className="bubbleGroup" style={{ '--base-color': getComputedStyle(document.documentElement).getPropertyValue(`--c-${type}`) || '#8a7df0' }}>
            <div className="bubbleGroupHead"><span>{TYPE_ICON[type] || '✨'}</span><b>{MEM_FILTERS.find(f => f.id === type)?.label || type}</b><small>{items.length}</small></div>
            <div className="bubbles">
              {items.map(it => (
                <button key={it.id} className="bubble" onClick={() => onPick?.(it)} style={{
                  fontSize: `${10 + (it.importance || 1) * 1.8}px`,
                  opacity: 0.65 + (it.importance || 1) * 0.1,
                }}>
                  {(it.title || it.text).slice(0, 70)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MemoryCard({ item, types, onResolve, onDelete, onEdit }) {
  const meta = types?.[item.type] || {};
  return (
    <article className={`memCard ${item.resolved ? 'resolved' : ''}`} style={{ borderColor: `${meta.color}22` }}>
      <div className="memHead">
        <div className="memTag" style={{ color: meta.color || '#c4b5fd' }}>
          <span>{TYPE_ICON[item.type] || '✨'}</span>
          <b>{meta.label || item.type}</b>
          {item.importance > 1 && <i>{'★'.repeat(item.importance)}</i>}
        </div>
        <small className="memDate"><Clock size={11}/> {fmtDate(item.createdAt)}</small>
      </div>
      {item.title && <h4>{item.title}</h4>}
      <p>{item.text}</p>
      {item.tags?.length ? <div className="memTags">{item.tags.slice(0,5).map((t,i)=><span key={i}>#{t}</span>)}</div> : null}
      <div className="memActions">
        {!['insight'].includes(item.type) && <button onClick={() => onResolve?.(item)}><CheckCircle2 size={13}/>{item.resolved ? 'Reabrir' : 'Resolver'}</button>}
        <button onClick={() => onEdit?.(item)}><Wand2 size={13}/>Editar</button>
        <button className="danger" onClick={() => onDelete?.(item)}><Trash2 size={13}/>Excluir</button>
      </div>
    </article>
  );
}

function App(){
  const [tab, setTab] = useState('chat');
  const [mode, setMode] = useState('auto');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [results, setResults] = useState([]);
  const [synthesis, setSynthesis] = useState(null);
  const [suggestedMemory, setSuggestedMemory] = useState([]);
  const [contextUsed, setContextUsed] = useState([]);
  const [health, setHealth] = useState(null);
  const [memory, setMemory] = useState([]);
  const [memorySearch, setMemorySearch] = useState('');
  const [memoryFilter, setMemoryFilter] = useState('all');
  const [memoryView, setMemoryView] = useState('list');
  const [memorySort, setMemorySort] = useState('date');
  const [home, setHome] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [showCapture, setShowCapture] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [captureType, setCaptureType] = useState('insight');
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureImp, setCaptureImp] = useState(1);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [toast, setToast] = useState(null);

  const MODES = [
    { id: 'auto',    label: 'Auto',    hint: 'NEXUS decide: Chat / Painel / Memória' },
    { id: 'gpt',     label: 'GPT' },
    { id: 'claude',  label: 'Claude' },
    { id: 'panel',   label: 'Painel' },
    { id: 'nexus',   label: 'Nexus' },
  ];

  const hintToast = useCallback((msg, type='ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  async function refreshAll() {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth(null));
    fetch(`/api/memory?sort=${memorySort}&limit=200`).then(r => r.json()).then(d => setMemory(d.items)).catch(() => {});
    fetch('/api/memory/timeline?limit=60').then(r => r.json()).then(d => setTimeline(d.events)).catch(() => {});
    fetch('/api/memory/home').then(r => r.json()).then(setHome).catch(() => {});
  }

  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { if (tab === 'home' || tab === 'memory') fetch('/api/memory/home').then(r => r.json()).then(setHome).catch(() => {}); }, [tab]);
  useEffect(() => {
    if (tab !== 'memory') return;
    const params = new URLSearchParams();
    if (memorySearch) params.set('q', memorySearch);
    if (memoryFilter !== 'all') params.set('type', memoryFilter);
    params.set('sort', memorySort);
    params.set('limit', 200);
    fetch(`/api/memory?${params.toString()}`).then(r => r.json()).then(d => setMemory(d.items)).catch(() => {});
  }, [tab, memorySearch, memoryFilter, memorySort]);

  async function saveManual({ text, type, importance = 1, tags = [], title }) {
    const r = await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, type, importance, tags, title }) });
    if (!r.ok) return hintToast('Não foi possível salvar.', 'bad');
    const d = await r.json();
    setMemory(m => [d.item, ...m]);
    fetch('/api/memory/home').then(rr => rr.json()).then(setHome).catch(() => {});
    return d.item;
  }

  async function deleteMemory(id) {
    const r = await fetch(`/api/memory/${id}`, { method: 'DELETE' });
    if (!r.ok) return hintToast('Não foi possível excluir.', 'bad');
    setMemory(m => m.filter(x => x.id !== id));
    refreshAll();
  }

  async function resolveMemory(item) {
    const r = await fetch(`/api/memory/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolved: !item.resolved }) });
    if (!r.ok) return hintToast('Erro ao atualizar.', 'bad');
    const d = await r.json();
    setMemory(m => m.map(x => x.id === item.id ? d.item : x));
    refreshAll();
  }

  async function submitEdit() {
    if (!editing || !editDraft) return;
    const r = await fetch(`/api/memory/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editDraft) });
    if (!r.ok) return hintToast('Erro ao salvar.', 'bad');
    const d = await r.json();
    setMemory(m => m.map(x => x.id === editing.id ? d.item : x));
    setEditing(null); setEditDraft(null);
    refreshAll();
  }

  async function send() {
    const text = input.trim(); if (!text || busy) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next); setInput(''); setBusy(true); setResults([]); setSynthesis(null); setSuggestedMemory([]); setContextUsed([]); setRouteInfo(null);

    try {
      let effectiveMode = mode;
      if (mode === 'auto') {
        const route = await fetch('/api/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, messages: next }) }).then(r => r.json()).catch(() => null);
        if (route) {
          setRouteInfo(route);
          if (route.mode === 'memory') {
            const ctx = route.memoryContext || [];
            setContextUsed(ctx);
            if (!ctx.length) {
              setResults([{ provider: 'nexus', ok: true, text: 'Não encontrei nada na sua memória que corresponda a isso. Adicione itens na aba Memória ou continue a conversa — eu vou guardando o que for importante.', ms: 0 }]);
              setBusy(false);
              return;
            }
            const types = health?.types || {};
            const compact = ctx.map(i => {
              const meta = types[i.type] || {};
              return `• ${TYPE_ICON[i.type] || '✨'} ${meta.label || i.type} · ${fmtDate(i.createdAt)}${i.importance > 1 ? ' · ' + '★'.repeat(i.importance) : ''}\n  ${i.title ? i.title + ' — ' : ''}${i.text}`;
            }).join('\n\n');
            const llm = (health?.providers?.gpt?.configured ? 'gpt' : health?.providers?.claude?.configured ? 'claude' : null);
            if (llm) {
              const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: llm, messages: [
                { role: 'system', content: `Você é o NEXUS Memory Assist. Responda em português usando APENAS o contexto da memória do usuário abaixo. Cite as datas e tipos. Se não encontrar, diga honestamente.\n\n${compact}` },
                { role: 'user', content: text },
              ] })}).then(rr => rr.json());
              setResults(r.results || []); setContextUsed(ctx);
            } else {
              setResults([{ provider: 'memory', ok: true, text: compact, ms: 0 }]);
            }
            setBusy(false);
            return;
          }
          if (route.mode === 'panel') effectiveMode = 'panel';
          else effectiveMode = 'nexus';
        } else {
          effectiveMode = 'nexus';
        }
      }

      const actualMode = effectiveMode === 'chat' || effectiveMode === 'auto' ? (health?.providers?.gpt?.configured ? 'gpt' : 'claude') : effectiveMode;
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: actualMode, messages: next }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Falha no NEXUS');
      setResults(data.results || []);
      if (data.synthesis?.ok) setSynthesis(data.synthesis);
      if (data.context?.length) setContextUsed(data.context);
      const suggestions = parseSuggested(data.synthesis?.text);
      if (suggestions.length) setSuggestedMemory(suggestions);
    } catch (e) {
      setResults([{ provider: 'nexus', ok: false, error: e.message }]);
    } finally { setBusy(false); }
  }

  async function commitSuggested(s) {
    const created = await saveManual({ text: s.text, type: s.type, importance: 2 });
    if (created) {
      setSuggestedMemory(arr => arr.filter(x => x !== s));
      hintToast(`Guardado como ${health?.types?.[s.type]?.label || 'insight'}.`, 'ok');
    }
  }

  function clear() { setMessages([]); setResults([]); setSynthesis(null); setSuggestedMemory([]); setContextUsed([]); setRouteInfo(null); }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        let data;
        try { data = JSON.parse(text); } catch { data = text.split(/\n\s*\n/).map(s => ({ role: 'user', content: s })); }
        const r = await fetch('/api/memory/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, dryRun: true }) });
        if (!r.ok) return hintToast('Não foi possível analisar.', 'bad');
        const d = await r.json();
        setImportPreview(d.items || []);
        if (!d.items?.length) hintToast('Nenhum item identificado. Tente um arquivo mais rico.', 'bad');
      } catch { hintToast('Arquivo inválido.', 'bad'); }
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!importPreview.length) return;
    const sample = importPreview.map(x => ({ text: x.text, type: x.type, importance: x.importance, tags: x.tags, title: x.title }));
    const r = await fetch('/api/memory/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: sample, dryRun: false }) });
    if (!r.ok) return hintToast('Erro ao importar.', 'bad');
    const d = await r.json();
    hintToast(`${d.imported} itens importados.`, 'ok');
    setImportPreview([]); setShowImport(false);
    refreshAll();
  }

  const lastQuestion = useMemo(() => messages.filter(m => m.role === 'user').at(-1)?.content || '', [messages]);
  const typesMeta = health?.types || {};

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark"><Brain size={19}/></div><div><b>NEXUS</b><span>segundo cérebro · V4</span></div></div>
      <div className="tabsNav">{TABS.map(t => (
        <button key={t.id} className={`tabBtn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
          <t.icon size={16}/> {t.label}
        </button>
      ))}</div>
      <button className="new" onClick={() => tab === 'memory' ? setShowCapture(true) : clear()}><Plus size={16}/> {tab === 'memory' ? 'Capturar memória' : 'Nova conversa'}</button>

      <div className="sideLabel">MENTES</div>
      <div className="providerList">{Object.entries(PROVIDERS).map(([id,p])=>{
        const Logo = p.Logo;
        return (
          <div className="provider" key={id}>
            <span className="providerLogo">{id === 'notebooklm' ? <Logo size={14}/> : <Logo size={20}/>}</span>
            <div><b>{p.name}</b><small>{p.desc}</small></div>
            <i className={health?.providers?.[id]?.configured?'on':'off'} />
          </div>
        );
      })}</div>

      <div className="sideLabel">MEMÓRIA {health?.memory?.count != null && <em>{health.memory.count}</em>}</div>
      <div className="memoryCounts">
        {MEM_FILTERS.filter(f => f.id !== 'all').map(f => {
          const n = health?.memory?.types?.[f.id] || 0;
          return <div key={f.id} className={`mc ${memoryFilter === f.id ? 'on' : ''}`} onClick={() => { setTab('memory'); setMemoryFilter(f.id); }}>
            <span>{TYPE_ICON[f.id]}</span><b>{f.label}</b><i>{n}</i>
          </div>;
        })}
      </div>

      <div className="sidebarBottom">
        <button onClick={() => { setShowCapture(true); setCaptureType('insight'); }}><Lightbulb size={15}/> Capturar insight</button>
        <button onClick={() => setShowImport(true)}><Download size={15}/> Importar conversas</button>
        <button onClick={refreshAll}><RotateCcw size={15}/> Atualizar</button>
      </div>
    </aside>

    <main className="main">
      {tab === 'home' && (
        <section className="homeView scrollable">
          <header className="top"><div>
            <div className="eyebrow">HOME · O QUE PRECISO LEMBRAR HOJE</div>
            <h1>{home?.greeting || 'Olá'}.</h1>
            <p className="sub">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div><div className="topActions">
            <div className="statGrid">
              <div className="stat"><span>{home?.counts?.total || 0}</span><em>total</em></div>
              <div className="stat goal"><span>{home?.counts?.goals || 0}</span><em>objetivos</em></div>
              <div className="stat warn"><span>{home?.counts?.warnings || 0}</span><em>alertas</em></div>
              <div className="stat resume"><span>{home?.counts?.resume || 0}</span><em>retomar</em></div>
            </div>
          </div></header>

          {home?.aiBrief && <article className="aiBrief"><div className="synthHead"><span>✦ RESUMO DO DIA</span></div><div className="synthText">{home.aiBrief}</div></article>}

          <div className="homeGrid">
            <div className="homeCol">
              <div className="sectionTitle"><Target size={14}/> Objetivos em andamento <span>{home?.activeGoals?.length || 0}</span></div>
              {!home?.activeGoals?.length && <div className="emptyHint">Sem objetivos ativos. Defina um ao tomar decisões importantes.</div>}
              {home?.activeGoals?.map(g => (
                <div key={g.id} className="homeRow goalRow" style={{ borderColor: `${typesMeta.goal?.color}22` }}>
                  <div className="pill" style={{ background: `${typesMeta.goal?.color}18`, color: typesMeta.goal?.color }}><Target size={12}/> {g.importance || 1}★</div>
                  <div className="hrBody">{g.title && <h5>{g.title}</h5>}{g.text}<small>{fmtDate(g.createdAt)}</small></div>
                  <button onClick={() => resolveMemory(g)}><CheckCircle2 size={14}/></button>
                </div>
              ))}

              <div className="sectionTitle mt"><Flag size={14}/> Para retomar depois <span>{home?.resume?.length || 0}</span></div>
              {!home?.resume?.length && <div className="emptyHint">Nada na fila. Adicione como "↩️ Retomar" para não esquecer.</div>}
              {home?.resume?.map(g => (
                <div key={g.id} className="homeRow" style={{ borderColor: `${typesMeta.resume_later?.color}22` }}>
                  <div className="pill" style={{ background: `${typesMeta.resume_later?.color}18`, color: typesMeta.resume_later?.color }}><ArrowRight size={12}/> retomar</div>
                  <div className="hrBody">{g.title && <h5>{g.title}</h5>}{g.text}<small>{fmtDate(g.createdAt)}</small></div>
                  <button onClick={() => resolveMemory(g)}><CheckCircle2 size={14}/></button>
                </div>
              ))}
            </div>

            <div className="homeCol">
              <div className="sectionTitle"><AlertTriangle size={14}/> Alertas e contradições <span>{(home?.warnings?.length || 0) + (home?.contradictions?.length || 0)}</span></div>
              {[...(home?.warnings || []), ...(home?.contradictions || [])].slice(0, 6).map(g => (
                <div key={g.id} className="homeRow warnRow" style={{ borderColor: `${(g.type === 'warning' ? typesMeta.warning : typesMeta.contradiction)?.color}22` }}>
                  <div className="pill" style={{ background: `${(g.type === 'warning' ? typesMeta.warning : typesMeta.contradiction)?.color}18`, color: (g.type === 'warning' ? typesMeta.warning : typesMeta.contradiction)?.color }}>
                    {g.type === 'warning' ? <AlertTriangle size={12}/> : <Zap size={12}/>} {g.type === 'warning' ? 'alerta' : 'contradição'}
                  </div>
                  <div className="hrBody">{g.title && <h5>{g.title}</h5>}{g.text}<small>{fmtDate(g.createdAt)}</small></div>
                </div>
              ))}

              <div className="sectionTitle mt"><Lightbulb size={14}/> Decisões recentes <span>{home?.recentDecisions?.length || 0}</span></div>
              {!home?.recentDecisions?.length && <div className="emptyHint">Nenhuma decisão registrada nas últimas 3 semanas.</div>}
              {home?.recentDecisions?.map(g => (
                <div key={g.id} className="homeRow" style={{ borderColor: `${typesMeta.decision?.color}22` }}>
                  <div className="pill" style={{ background: `${typesMeta.decision?.color}18`, color: typesMeta.decision?.color }}><CheckCircle2 size={12}/> decidido</div>
                  <div className="hrBody">{g.title && <h5>{g.title}</h5>}{g.text}<small>{fmtDate(g.createdAt)}</small></div>
                </div>
              ))}
            </div>

            <div className="homeCol wide">
              <div className="sectionTitle"><Clock size={14}/> Linha do tempo <span>{timeline.length}</span></div>
              <div className="timeline">
                {!timeline.length && <div className="emptyHint">Sem eventos ainda. Converse ou guarde memórias.</div>}
                {timeline.slice(0, 20).map(e => {
                  const color = e.type && typesMeta[e.type]?.color;
                  return (
                    <div key={e.id} className="tlItem">
                      <div className="tlDot" style={{ background: color || '#6e62df' }}/>
                      <div className="tlBody">
                        <small>{fmtDate(e.date)} · {e.kind === 'conversation' ? 'conversa' : typesMeta[e.type]?.label || 'memória'}</small>
                        <p>{e.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'chat' && (
        <>
          <header className="top"><div>
            <div className="eyebrow">CHAT · CAMADA PESSOAL ACIMA DAS IAs</div>
            <h1>{routeInfo ? `→ Modo ${routeInfo.mode.toUpperCase()} · ${routeInfo.reason || ''}` : (lastQuestion || 'O que está na sua cabeça?')}</h1>
          </div><div className="topActions">
            <span className="status"><span/> local + APIs · {MODES.find(m => m.id === mode)?.label}</span>
            <button onClick={clear} title="Nova conversa"><RotateCcw size={15}/></button>
          </div></header>

          <section className="modebar">
            {MODES.map(m => (
              <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)} title={m.hint}>
                {m.id === 'auto' ? <Wand2 size={15}/> : m.id === 'panel' ? <Users size={15}/> : m.id === 'nexus' ? <Sparkles size={15}/> : <MessageSquare size={15}/>} {m.label}
              </button>
            ))}
            <div className="modeHint">
              {mode === 'auto' ? 'NEXUS roteia: Chat (GPT) / Painel (4 IAs) / Memória' :
               mode === 'nexus' ? 'quatro análises → comparação → síntese' :
               mode === 'panel' ? 'quatro respostas independentes' :
               `conversa direta com ${PROVIDERS[mode]?.name || mode}`}
            </div>
          </section>

          <section className="chat">
            {!messages.length && <div className="hero">
              <div className="orb"><Sparkles/></div>
              <h2>Não é só um chat.</h2>
              <p>É uma camada pessoal acima das suas IAs. No modo Auto, o NEXUS decide quando basta uma IA, quando vale o Painel completo, ou quando a resposta está na sua memória.</p>
              <div className="suggestions">
                <button onClick={() => setInput('Qual é a diferença entre Python e JavaScript?')}>Pergunta simples (Auto → GPT)</button>
                <button onClick={() => setInput('Estou pensando em abandonar meu projeto.')}>Questão pessoal (Auto → Painel)</button>
                <button onClick={() => setInput('O que eu decidi sobre meu projeto naquela conversa de duas semanas atrás?')}>Consulta à memória (Auto → Memória)</button>
                <button onClick={() => setInput('Quero tomar uma decisão importante.')}>Decisão importante</button>
              </div>
            </div>}

            {messages.map((m,i)=><div className={`msg ${m.role}`} key={i}><div className={`avatar ${m.role}`}>{m.role === 'user' ? 'Você' : 'Nexus'}</div><div className={m.role === 'user' ? 'bubbleUser' : 'bubbleAI'}>{m.content}</div></div>)}

            {contextUsed.length > 0 && (
              <div className="contextBar">
                <span><Database size={12}/> Contexto da memória ({contextUsed.length}):</span>
                <div className="contextChips">{contextUsed.map((c,i)=><span className="cchip" key={i} style={{ borderColor: `${typesMeta[c.type]?.color}55`, color: typesMeta[c.type]?.color }}>{TYPE_ICON[c.type]} {(c.title || c.text).slice(0, 42)}</span>)}</div>
              </div>
            )}

            {busy && <div className="thinking"><Sparkles size={15}/> {mode === 'auto' && !routeInfo ? 'Roteando' : 'Consultando'}<span>•••</span></div>}

            {results.length > 0 && <div className="panelResults">{results.map(r => {
              const Logo = PROVIDERS[r.provider]?.Logo;
              return (
              <article className={`result ${r.ok?'':'failed'}`} key={r.provider}>
                <div className="resultHead">
                  <b className="resultProvider">
                    {Logo ? (r.provider === 'notebooklm' ? <Logo size={13}/> : <Logo size={15}/>) :
                     r.provider === 'memory' ? <Database size={14} style={{color:'#a49bff'}}/> :
                     r.provider === 'nexus' ? <Sparkles size={14} style={{color:'#a49bff'}}/> : null}
                    <span>{PROVIDERS[r.provider]?.name || (r.provider === 'memory' ? 'Memória' : r.provider === 'nexus' ? 'NEXUS' : r.provider)}</span>
                  </b>
                  <small>{r.ok ? `${r.ms} ms` : 'não respondeu'}</small>
                </div>
                <p>{r.ok ? r.text : r.error}</p>
                {r.ok && <button className="save" onClick={() => saveManual({ text: r.text.slice(0, 800), type: 'insight', importance: 1 }).then(() => hintToast('Guardado como insight.'))}><Lightbulb size={13}/> guardar</button>}
              </article>
              );
            })}</div>}

            {synthesis && <article className="synthesis">
              <div className="synthHead"><span>✦ SÍNTESE DO NEXUS</span><small>{synthesis.ms} ms</small></div>
              <div className="synthText">{synthesis.text}</div>
              <button onClick={() => saveManual({ text: synthesis.text.slice(0, 1200), type: 'insight', importance: 2 }).then(() => hintToast('Síntese guardada.'))}><Target size={14}/> Salvar como insight</button>
            </article>}

            {suggestedMemory.length > 0 && <div className="suggested">
              <div className="sectionTitle"><SparklesIcon size={14}/> Memória sugerida pelo NEXUS <span>{suggestedMemory.length}</span></div>
              <div className="suggestedGrid">{suggestedMemory.map((s,i) => {
                const meta = typesMeta[s.type] || {};
                return <div key={i} className="sugCard" style={{ borderColor: `${meta.color}33` }}>
                  <div className="pill" style={{ background: `${meta.color}18`, color: meta.color }}>{TYPE_ICON[s.type] || '✨'} {meta.label || s.type}</div>
                  <p>{s.text}</p>
                  <button className="primary" onClick={() => commitSuggested(s)}><Plus size={14}/> Guardar</button>
                </div>;
              })}</div>
            </div>}
          </section>

          <footer className="composer">
            <div className="composerBox">
              <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Digite alguma coisa — o NEXUS sabe quando basta GPT, quando vale o Painel, ou quando é a memória que responde." rows="1"/>
              <button onClick={send} disabled={busy||!input.trim()}><Send size={18}/></button>
            </div>
            <small>Enter envia · Shift+Enter quebra linha · modo atual: <b>{MODES.find(x=>x.id===mode)?.label}</b></small>
          </footer>
        </>
      )}

      {tab === 'memory' && (
        <section className="memoryView scrollable">
          <header className="top">
            <div>
              <div className="eyebrow">MEMÓRIA · INSIGHTS, DECISÕES, OBJETIVOS, PADRÕES</div>
              <h1>Sua memória pessoal</h1>
              <p className="sub">{health?.memory?.count || 0} itens · {timeline.length} eventos na linha do tempo</p>
            </div>
            <div className="topActions">
              <div className="searchBox"><Search size={14}/><input value={memorySearch} onChange={e=>setMemorySearch(e.target.value)} placeholder="Buscar na memória..."/></div>
              <div className="seg">
                <button className={memoryView === 'list' ? 'on' : ''} onClick={()=>setMemoryView('list')} title="Lista"><List size={14}/></button>
                <button className={memoryView === 'bubbles' ? 'on' : ''} onClick={()=>setMemoryView('bubbles')} title="Bolhas"><LayoutGrid size={14}/></button>
              </div>
              <div className="seg">
                <button className={memorySort === 'date' ? 'on' : ''} onClick={()=>setMemorySort('date')}><Clock size={13}/> data</button>
                <button className={memorySort === 'importance' ? 'on' : ''} onClick={()=>setMemorySort('importance')}><Flag size={13}/> importância</button>
              </div>
            </div>
          </header>

          <div className="memFilters">
            {MEM_FILTERS.map(f => (
              <button key={f.id} className={memoryFilter === f.id ? 'on' : ''} onClick={() => setMemoryFilter(f.id)}>
                {f.id !== 'all' && <span>{TYPE_ICON[f.id]}</span>} {f.label}
              </button>
            ))}
          </div>

          {memoryView === 'list' && (
            <div className="memGrid">
              {!memory.length && <div className="emptyHint big">Nada aqui. Comece uma conversa, guarde insights ou importe um conversations.json.</div>}
              {memory.map(item => (
                <MemoryCard key={item.id} item={item} types={typesMeta}
                  onResolve={resolveMemory}
                  onDelete={i => deleteMemory(i.id)}
                  onEdit={i => { setEditing(i); setEditDraft({ text: i.text, type: i.type, importance: i.importance, tags: i.tags || [], title: i.title }); }}
                />
              ))}
            </div>
          )}

          {memoryView === 'bubbles' && <BubbleCloud items={memory} onPick={(it) => { setEditing(it); setEditDraft({ text: it.text, type: it.type, importance: it.importance, tags: it.tags || [], title: it.title }); }}/>}
        </section>
      )}
    </main>

    {showCapture && (
      <div className="overlay" onMouseDown={() => setShowCapture(false)}>
        <div className="modal" onMouseDown={e => e.stopPropagation()}>
          <button className="close" onClick={() => setShowCapture(false)}><X/></button>
          <div className="eyebrow">CAPTURAR</div>
          <h3>Guardar uma coisa importante</h3>
          <p>Escreva o que não quer perder e escolha o tipo certo.</p>
          <div className="typeGrid">
            {MEM_FILTERS.filter(f => f.id !== 'all').map(f => (
              <button key={f.id} className={`tg ${captureType === f.id ? 'on' : ''}`} style={{ borderColor: `${typesMeta[f.id]?.color}55`, color: typesMeta[f.id]?.color }} onClick={() => setCaptureType(f.id)}>
                {TYPE_ICON[f.id]} {f.label}
              </button>
            ))}
          </div>
          <input className="titleInput" placeholder="Título curto (opcional)" value={captureTitle} onChange={e => setCaptureTitle(e.target.value)}/>
          <textarea value={captureText} onChange={e => setCaptureText(e.target.value)} placeholder="Ex.: Eu preciso validar mockups antes de codar."/>
          <div className="modalRow">
            <div className="seg">
              {[1,2,3].map(n => <button key={n} className={captureImp === n ? 'on' : ''} onClick={() => setCaptureImp(n)}>★{n}</button>)}
            </div>
            <button className="primary" onClick={() => {
              saveManual({ text: captureText, type: captureType, importance: captureImp, tags: [], title: captureTitle }).then(it => {
                if (it) { hintToast('Guardado.'); setShowCapture(false); setCaptureText(''); setCaptureTitle(''); setCaptureImp(1); }
              });
            }}><Lightbulb size={15}/> Guardar na memória</button>
          </div>
        </div>
      </div>
    )}

    {editing && (
      <div className="overlay" onMouseDown={() => { setEditing(null); setEditDraft(null); }}>
        <div className="modal" onMouseDown={e => e.stopPropagation()}>
          <button className="close" onClick={() => { setEditing(null); setEditDraft(null); }}><X/></button>
          <div className="eyebrow">EDITAR</div>
          <h3>Editar item da memória</h3>
          <div className="typeGrid">
            {MEM_FILTERS.filter(f => f.id !== 'all').map(f => (
              <button key={f.id} className={`tg ${editDraft?.type === f.id ? 'on' : ''}`} style={{ borderColor: `${typesMeta[f.id]?.color}55`, color: typesMeta[f.id]?.color }} onClick={() => setEditDraft({ ...editDraft, type: f.id })}>
                {TYPE_ICON[f.id]} {f.label}
              </button>
            ))}
          </div>
          <input className="titleInput" placeholder="Título curto" value={editDraft?.title || ''} onChange={e => setEditDraft({ ...editDraft, title: e.target.value })}/>
          <textarea value={editDraft?.text || ''} onChange={e => setEditDraft({ ...editDraft, text: e.target.value })}/>
          <div className="modalRow">
            <div className="seg">
              {[1,2,3].map(n => <button key={n} className={editDraft?.importance === n ? 'on' : ''} onClick={() => setEditDraft({ ...editDraft, importance: n })}>★{n}</button>)}
            </div>
            <button className="primary" onClick={submitEdit}><Wand2 size={15}/> Salvar alterações</button>
          </div>
        </div>
      </div>
    )}

    {showImport && (
      <div className="overlay" onMouseDown={() => setShowImport(false)}>
        <div className="modal wideModal" onMouseDown={e => e.stopPropagation()}>
          <button className="close" onClick={() => setShowImport(false)}><X/></button>
          <div className="eyebrow">IMPORTAR</div>
          <h3>Trazer histórico ou conversations.json</h3>
          <p>Envie um arquivo JSON (array de mensagens ou exportação) ou TXT. O NEXUS extrai até 20 itens realmente importantes.</p>
          <label className="dropArea">
            <Upload size={22}/>
            <b>Solte ou clique para selecionar</b>
            <small>JSON · TXT · até ~60k caracteres</small>
            <input type="file" accept=".json,.txt,application/json,text/plain" onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); }} hidden/>
          </label>
          {importPreview.length > 0 && (
            <>
              <div className="sectionTitle">Prévia · {importPreview.length} itens detectados</div>
              <div className="preGrid">{importPreview.map((p,i) => (
                <div key={i} className="preItem" style={{ borderColor: `${typesMeta[p.type]?.color}33` }}>
                  <div className="pill" style={{ background: `${typesMeta[p.type]?.color}18`, color: typesMeta[p.type]?.color }}>{TYPE_ICON[p.type]} {typesMeta[p.type]?.label || p.type} {p.importance > 1 && '★'.repeat(p.importance)}</div>
                  <p>{(p.title || p.text).slice(0, 220)}</p>
                </div>
              ))}</div>
              <div className="modalRow end">
                <button onClick={() => setImportPreview([])}>Limpar prévia</button>
                <button className="primary" onClick={confirmImport}><Download size={15}/> Importar {importPreview.length} itens</button>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
