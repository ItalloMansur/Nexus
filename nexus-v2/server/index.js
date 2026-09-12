import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '.nexus-data');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const TIMELINE_FILE = path.join(DATA_DIR, 'timeline.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const app = express();
app.use(express.json({ limit: '20mb' }));

const PORT = Number(process.env.PORT || 8787);
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

const PROVIDERS = ['gpt', 'claude', 'v0', 'notebooklm'];
const roles = {
  gpt: 'Raciocine sobre o problema, trade-offs, riscos, alternativas e próximos passos concretos.',
  claude: 'Observe contexto, nuances, contradições, premissas e aspectos que o usuário pode não estar percebendo.',
  v0: 'Pense como especialista em produto e implementação: UX, escopo, arquitetura e como transformar a ideia em algo construível.',
  notebooklm: 'Priorize as fontes/documentos do usuário. Diferencie evidência encontrada de inferência e não invente informação ausente nas fontes.'
};

const MEMORY_TYPES = ['decision', 'idea', 'pattern', 'warning', 'goal', 'reminder', 'resume_later', 'contradiction', 'insight'];
const TYPE_META = {
  decision:      { label: 'Decisão',       icon: '✅', color: '#52d2ad' },
  idea:          { label: 'Ideia',         icon: '💡', color: '#ffd166' },
  pattern:       { label: 'Padrão',        icon: '🔁', color: '#7eb8ff' },
  warning:       { label: 'Alerta',        icon: '⚠️', color: '#ff8a8a' },
  goal:          { label: 'Objetivo',      icon: '🎯', color: '#b491ff' },
  reminder:      { label: 'Lembrete',      icon: '📌', color: '#ffb86b' },
  resume_later:  { label: 'Retomar depois',icon: '↩️', color: '#8ad6ff' },
  contradiction: { label: 'Contradição',   icon: '⚡', color: '#ff6ba6' },
  insight:       { label: 'Insight',       icon: '✨', color: '#c4b5fd' },
};

let memoryItems = readJSON(MEMORY_FILE, []);
let conversations = readJSON(CONVERSATIONS_FILE, []);
let timeline = readJSON(TIMELINE_FILE, []);

function saveMemory() { writeJSON(MEMORY_FILE, memoryItems); }
function saveConversations() { writeJSON(CONVERSATIONS_FILE, conversations); }
function saveTimeline() { writeJSON(TIMELINE_FILE, timeline); }

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function nowISO() { return new Date().toISOString(); }

function configured(provider) {
  if (provider === 'gpt') return Boolean(openai && process.env.OPENAI_MODEL);
  if (provider === 'claude') return Boolean(anthropic && process.env.ANTHROPIC_MODEL);
  if (provider === 'v0') return Boolean(process.env.V0_API_KEY && process.env.V0_MODEL);
  if (provider === 'notebooklm') return Boolean(process.env.NOTEBOOKLM_BRIDGE_URL);
  return false;
}

function normalizeMessages(messages = []) {
  return messages
    .filter(m => m && ['user', 'assistant', 'system'].includes(m.role) && typeof m.content === 'string' && m.content.trim())
    .slice(-60)
    .map(m => ({ role: m.role, content: m.content.trim() }));
}

function tokenize(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreMatch(item, queryTokens) {
  const haystack = tokenize([item.text, item.title, (item.tags || []).join(' ')].join(' '));
  let score = 0;
  for (const t of queryTokens) if (haystack.includes(t)) score += 1;
  const freq = haystack.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
  for (const t of queryTokens) if (freq[t]) score += freq[t] * 0.3;
  if (score > 0 && item.importance) score += item.importance * 0.4;
  return score;
}

function searchMemory(query = '', { limit = 15, types } = {}) {
  if (!query.trim()) {
    let items = [...memoryItems];
    if (types?.length) items = items.filter(i => types.includes(i.type));
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
  }
  const tokens = tokenize(query);
  const scored = memoryItems
    .filter(i => !types?.length || types.includes(i.type))
    .map(i => ({ item: i, score: scoreMatch(i, tokens) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.item.createdAt) - new Date(a.item.createdAt));
  return scored.slice(0, limit).map(x => x.item);
}

function memoryBlockWithContext(items = []) {
  if (!items.length) return '';
  const lines = items.map(i => {
    const meta = TYPE_META[i.type] || {};
    const date = new Date(i.createdAt).toLocaleDateString('pt-BR');
    const tagStr = (i.tags?.length ? ` [${i.tags.join(', ')}]` : '');
    return `- [${date}] (${meta.label || i.type})${tagStr} ${i.text}`;
  });
  return `\n\nCONTEXTO DA MEMÓRIA PESSOAL (mais relevante primeiro):\n${lines.join('\n')}`;
}

async function callGPT(messages) {
  if (!openai || !process.env.OPENAI_MODEL) throw new Error('OpenAI não configurada. Defina OPENAI_API_KEY e OPENAI_MODEL.');
  const response = await openai.responses.create({ model: process.env.OPENAI_MODEL, input: messages });
  return response.output_text || '';
}

async function callClaude(messages) {
  if (!anthropic || !process.env.ANTHROPIC_MODEL) throw new Error('Anthropic não configurada. Defina ANTHROPIC_API_KEY e ANTHROPIC_MODEL.');
  const system = messages.find(m => m.role === 'system')?.content;
  const input = messages.filter(m => m.role !== 'system');
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL,
    max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 4096),
    ...(system ? { system } : {}),
    messages: input
  });
  return (response.content || []).filter(x => x.type === 'text').map(x => x.text).join('');
}

async function callV0(messages) {
  if (!process.env.V0_API_KEY || !process.env.V0_MODEL) throw new Error('v0 não configurado. Defina V0_API_KEY e V0_MODEL conforme sua conta/API.');
  const response = await fetch('https://api.v0.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.V0_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.V0_MODEL, messages })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `v0 HTTP ${response.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('v0 respondeu sem conteúdo de texto.');
  return typeof text === 'string' ? text : JSON.stringify(text);
}

async function callNotebookLM(messages) {
  if (!process.env.NOTEBOOKLM_BRIDGE_URL) {
    throw new Error('NotebookLM precisa de um bridge. Não há uma API pública geral de chat equivalente às APIs GPT/Claude/v0.');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.NOTEBOOKLM_BRIDGE_TOKEN) headers.Authorization = `Bearer ${process.env.NOTEBOOKLM_BRIDGE_TOKEN}`;
  const response = await fetch(process.env.NOTEBOOKLM_BRIDGE_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ messages, notebookId: process.env.NOTEBOOKLM_NOTEBOOK_ID || undefined })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || `NotebookLM bridge HTTP ${response.status}`);
  const text = data?.text || data?.output || data?.answer || data?.content;
  if (!text) throw new Error('NotebookLM bridge respondeu sem texto.');
  return typeof text === 'string' ? text : JSON.stringify(text);
}

const callers = { gpt: callGPT, claude: callClaude, v0: callV0, notebooklm: callNotebookLM };

async function askProvider(provider, messages) {
  const started = Date.now();
  try {
    const text = await callers[provider](messages);
    return { provider, ok: true, text, ms: Date.now() - started };
  } catch (error) {
    return { provider, ok: false, text: '', error: error?.message || 'Falha desconhecida', ms: Date.now() - started };
  }
}

function providerSystem(provider, memory = '') {
  return `Você é ${provider.toUpperCase()}, uma das mentes do NEXUS. ${roles[provider]} Não fale pelos outros modelos. Responda em português claro e seja útil.${memory}`;
}

function detectIntentHeuristic(text = '') {
  const t = text.toLowerCase();
  const memoryKeywords = ['lembr', 'memória', 'decidí', 'decidi ', 'decisão', 'objetivo', 'padrão', 'contradi', 'retomar', 'aquela conversa', 'duas semanas', 'semana passada', 'ontem', 'antes eu', 'antigamente', 'o que eu', 'minha decisão', 'meus objetivo', 'meu projeto', 'anot', 'salvei', 'guardad'];
  const panelKeywords = ['abandonar', 'desistir', 'preciso de ajuda', 'não sei o que fazer', 'estou pensando em', 'medo', 'ansiedad', 'triste', 'frustrad', 'importante', 'crucial', 'decisão difícil', 'carreira', 'vida', 'relacionamento', 'me sinto', 'vale a pena'];
  let scoreMem = 0, scorePan = 0;
  for (const k of memoryKeywords) if (t.includes(k)) scoreMem += 1;
  for (const k of panelKeywords) if (t.includes(k)) scorePan += 1;
  if (scoreMem >= 2 || /(lembr|memória|decid[ia]|decisão|objetivo|padrão|semana passada|ontem|antes)/i.test(t)) return { mode: 'memory', confidence: scoreMem };
  if (scorePan >= 2) return { mode: 'panel', confidence: scorePan };
  return { mode: 'chat', confidence: 0 };
}

async function classifyIntent(text) {
  const heuristic = detectIntentHeuristic(text);
  const llm = configured('gpt') || configured('claude');
  if (!llm) return { mode: heuristic.mode, reason: `heurística (mem=${heuristic.confidence}, pan=${heuristic.confidence})`, provider: null };
  const provider = configured('gpt') ? 'gpt' : 'claude';
  const systemPrompt = `Você é o roteador do NEXUS. Classifique a pergunta do usuário em EXATAMENTE uma das três categorias, retornando APENAS JSON no formato {"mode":"chat|panel|memory","reason":"curta justificativa em português"}.
REGRAS:
- chat = pergunta factual, técnica, explicação, código, comparação simples, curiosidade geral. Uma única IA resolve.
- panel = questão pessoal, emocional, decisão de vida, projeto ambicioso, dilema, sensibilidade, contexto humano importante. Merece o painel completo.
- memory = o usuário quer recuperar algo do próprio passado: decisões antigas, objetivos, conversas anteriores, o que ele pensou/sentiu/decidiu antes. É consulta à memória pessoal.`;
  const result = await askProvider(provider, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `PERGUNTA: "${text}"` }
  ]);
  if (!result.ok) return { mode: heuristic.mode, reason: `fallback heurística: ${result.error}`, provider };
  try {
    const parsed = JSON.parse(result.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
    if (['chat', 'panel', 'memory'].includes(parsed.mode)) return { ...parsed, provider };
  } catch { /* fallthrough */ }
  return { mode: heuristic.mode, reason: `fallback heurística (resposta LLM inválida)`, provider };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: 'v4-memory-core',
    providers: Object.fromEntries(PROVIDERS.map(p => [p, { configured: configured(p), role: roles[p] }])),
    memory: {
      count: memoryItems.length,
      conversations: conversations.length,
      types: Object.fromEntries(MEMORY_TYPES.map(t => [t, memoryItems.filter(m => m.type === t).length]))
    },
    types: TYPE_META,
  });
});

app.post('/api/chat', async (req, res) => {
  const { mode = 'nexus', messages = [], memory: memoryParam = [] } = req.body || {};
  const clean = normalizeMessages(messages);
  if (!clean.length) return res.status(400).json({ error: 'Envie pelo menos uma mensagem.' });

  const lastUser = clean.filter(m => m.role === 'user').at(-1)?.content || '';
  const relevant = searchMemory(lastUser, { limit: 10 });
  const explicitItems = Array.isArray(memoryParam)
    ? memoryParam.map(x => typeof x === 'string' ? { id: uid(), type: 'insight', text: x, createdAt: nowISO(), importance: 1 } : x)
    : [];
  const combined = [...relevant, ...explicitItems];
  const mem = memoryBlockWithContext(combined);

  if (!['gpt', 'claude', 'v0', 'notebooklm', 'panel', 'nexus'].includes(mode)) {
    return res.status(400).json({ error: 'Modo inválido.' });
  }

  if (['gpt', 'claude', 'v0', 'notebooklm'].includes(mode)) {
    const result = await askProvider(mode, [{ role: 'system', content: providerSystem(mode, mem) }, ...clean.filter(m => m.role !== 'system')]);
    return res.json({ mode, results: [result], context: combined });
  }

  const results = await Promise.all(PROVIDERS.map(provider =>
    askProvider(provider, [
      { role: 'system', content: providerSystem(provider, mem) },
      ...clean.filter(m => m.role !== 'system')
    ])
  ));

  if (mode === 'panel') return res.json({ mode, results, context: combined });

  const successful = results.filter(r => r.ok && r.text);
  if (!successful.length) return res.status(502).json({ mode, results, context: combined, error: 'Nenhuma IA configurada respondeu.' });

  const question = clean.filter(m => m.role === 'user').at(-1)?.content || '';
  const dossier = successful.map(r => `### ${r.provider.toUpperCase()}\n${r.text}`).join('\n\n');
  const synthesisPrompt = [
    {
      role: 'system',
      content: `Você é o NEXUS, o orquestrador pessoal. Compare as análises recebidas. Não faça uma média: identifique convergências, divergências, contradições, riscos e o melhor próximo passo. Se a memória pessoal contradizer uma análise, destaque isso. Não invente fatos. Responda em português claro. No final, escreva exatamente a seção "MEMÓRIA SUGERIDA" e liste até 5 itens que realmente mereçam ser lembrados. Cada item na MEMÓRIA SUGERIDA deve começar com [TIPO] onde TIPO é um de: DECISAO, IDEIA, PADRAO, ALERTA, OBJETIVO, LEMBRETE, RETOMAR. Exemplo: "[OBJETIVO] Validar mockups antes de codar". Não salve nada automaticamente.${mem}`
    },
    { role: 'user', content: `PERGUNTA ORIGINAL:\n${question}\n\nANÁLISES DO PAINEL:\n${dossier}` }
  ];

  const preferred = configured('gpt') ? 'gpt' : configured('claude') ? 'claude' : null;
  const synthesis = preferred ? await askProvider(preferred, synthesisPrompt) : {
    provider: 'nexus', ok: false, text: '', error: 'Não há GPT ou Claude configurado para executar a síntese.', ms: 0
  };

  res.json({ mode, results, synthesis, context: combined });
});

app.post('/api/insights', async (req, res) => {
  const { transcript = '' } = req.body || {};
  if (!transcript.trim()) return res.status(400).json({ error: 'Transcrição vazia.' });
  if (!configured('claude')) return res.status(503).json({ error: 'Configure Claude para extração de insights.' });

  const typeList = MEMORY_TYPES.join('|');
  const prompt = `Extraia apenas insights pessoais realmente úteis desta conversa. Não invente fatos. Retorne APENAS JSON válido neste formato: [{"text":"...","type":"${typeList}","importance":1,"tags":["..."],"title":"título curto opcional"}]. Máximo 10 itens. Use importância de 1 a 3.\n\nCONVERSA:\n${transcript.slice(0, 40000)}`;
  const result = await askProvider('claude', [{ role: 'user', content: prompt }]);
  if (!result.ok) return res.status(502).json(result);

  try {
    const parsed = JSON.parse(result.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
    const insights = (Array.isArray(parsed) ? parsed : []).filter(i => i && typeof i.text === 'string').map(i => ({
      id: uid(),
      createdAt: nowISO(),
      text: i.text,
      type: MEMORY_TYPES.includes(i.type) ? i.type : 'insight',
      importance: Math.max(1, Math.min(3, Number(i.importance) || 1)),
      tags: Array.isArray(i.tags) ? i.tags.filter(t => typeof t === 'string').slice(0, 8) : [],
      title: typeof i.title === 'string' ? i.title : undefined,
      source: 'extracted',
    }));
    memoryItems = [...insights, ...memoryItems];
    saveMemory();
    for (const ins of insights) {
      timeline.push({ id: uid(), date: ins.createdAt, kind: 'memory_created', memoryId: ins.id, type: ins.type, text: ins.text.slice(0, 140) });
    }
    saveTimeline();
    return res.json({ ...result, insights });
  } catch (e) {
    return res.json({ ...result, insights: [], parseError: 'Claude não retornou JSON válido.' });
  }
});

app.post('/api/route', async (req, res) => {
  const { text = '', messages = [] } = req.body || {};
  const input = text || messages?.filter?.(m => m.role === 'user').at(-1)?.content || '';
  if (!input.trim()) return res.status(400).json({ error: 'Envie um texto para rotear.' });
  const classification = await classifyIntent(input);
  let memoryContext = [];
  if (classification.mode === 'memory') {
    memoryContext = searchMemory(input, { limit: 12 });
  }
  res.json({ ...classification, text: input, memoryContext });
});

app.get('/api/memory', (req, res) => {
  const { type, q, limit = 50, sort = 'date' } = req.query;
  let items;
  if (q) items = searchMemory(q, { limit: Number(limit), types: type ? [type].flat() : undefined });
  else items = [...memoryItems];
  if (type) items = items.filter(i => i.type === type);
  if (sort === 'importance') items.sort((a, b) => (b.importance || 1) - (a.importance || 1) || new Date(b.createdAt) - new Date(a.createdAt));
  else items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  items = items.slice(0, Number(limit));
  res.json({ items, total: memoryItems.length, types: TYPE_META });
});

app.post('/api/memory', (req, res) => {
  const { text, type = 'insight', importance = 1, tags = [], title } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'Texto é obrigatório.' });
  const item = {
    id: uid(),
    createdAt: nowISO(),
    text: String(text).slice(0, 5000),
    type: MEMORY_TYPES.includes(type) ? type : 'insight',
    importance: Math.max(1, Math.min(3, Number(importance) || 1)),
    tags: Array.isArray(tags) ? tags.filter(t => typeof t === 'string').slice(0, 8) : [],
    title: typeof title === 'string' && title.trim() ? title.slice(0, 140) : undefined,
    source: 'manual',
  };
  memoryItems.unshift(item);
  saveMemory();
  timeline.push({ id: uid(), date: item.createdAt, kind: 'memory_created', memoryId: item.id, type: item.type, text: item.text.slice(0, 140) });
  saveTimeline();
  res.json({ item });
});

app.put('/api/memory/:id', (req, res) => {
  const idx = memoryItems.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item não encontrado.' });
  const { text, type, importance, tags, title, resolved, resumeDate } = req.body || {};
  const before = memoryItems[idx];
  const merged = {
    ...before,
    ...(text != null ? { text: String(text).slice(0, 5000) } : {}),
    ...(type != null && MEMORY_TYPES.includes(type) ? { type } : {}),
    ...(importance != null ? { importance: Math.max(1, Math.min(3, Number(importance) || 1)) } : {}),
    ...(Array.isArray(tags) ? { tags: tags.filter(t => typeof t === 'string').slice(0, 8) } : {}),
    ...(title != null ? { title: String(title).slice(0, 140) } : {}),
    ...(resolved != null ? { resolved: Boolean(resolved), resolvedAt: Boolean(resolved) ? nowISO() : before.resolvedAt } : {}),
    ...(resumeDate != null ? { resumeDate } : {}),
    updatedAt: nowISO(),
  };
  memoryItems[idx] = merged;
  saveMemory();
  res.json({ item: merged });
});

app.delete('/api/memory/:id', (req, res) => {
  const idx = memoryItems.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item não encontrado.' });
  memoryItems.splice(idx, 1);
  saveMemory();
  res.json({ ok: true });
});

app.post('/api/memory/search', (req, res) => {
  const { q, limit = 15, types } = req.body || {};
  const items = searchMemory(q || '', { limit: Number(limit), types });
  res.json({ items });
});

app.get('/api/memory/home', async (req, res) => {
  const today = new Date();
  const daysSince = (iso) => Math.floor((today - new Date(iso)) / 86400000);
  const recent = memoryItems.filter(i => daysSince(i.createdAt) <= 14);
  const activeGoals = memoryItems.filter(i => i.type === 'goal' && !i.resolved).sort((a, b) => (b.importance || 1) - (a.importance || 1));
  const resume = memoryItems.filter(i => i.type === 'resume_later' && !i.resolved).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const warnings = memoryItems.filter(i => i.type === 'warning' && !i.resolved);
  const reminders = memoryItems.filter(i => i.type === 'reminder').filter(i => {
    if (!i.resumeDate) return daysSince(i.createdAt) <= 30;
    return new Date(i.resumeDate) <= today;
  });
  const recentDecisions = memoryItems.filter(i => i.type === 'decision' && daysSince(i.createdAt) <= 21).slice(0, 5);
  const patterns = memoryItems.filter(i => i.type === 'pattern' && !i.resolved);
  const contradictions = memoryItems.filter(i => i.type === 'contradiction' && !i.resolved);
  const timelineRecent = [...timeline].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  let greeting = 'Bom dia';
  const h = today.getHours();
  if (h >= 12 && h < 18) greeting = 'Boa tarde';
  else if (h >= 18) greeting = 'Boa noite';

  let aiBrief = null;
  const llm = configured('gpt') ? 'gpt' : configured('claude') ? 'claude' : null;
  if (llm && (activeGoals.length + resume.length + warnings.length + reminders.length) > 0) {
    const bullets = [
      ...activeGoals.slice(0, 4).map(g => `OBJETIVO ${g.importance || 1}★: ${g.text}`),
      ...resume.slice(0, 3).map(r => `RETOMAR: ${r.text}`),
      ...warnings.slice(0, 2).map(w => `ALERTA: ${w.text}`),
      ...reminders.slice(0, 3).map(r => `LEMBRETE: ${r.text}`),
    ].slice(0, 10).join('\n');
    const prompt = [
      { role: 'system', content: 'Você é o NEXUS Home. Cumprimente o usuário e destaque o que realmente importa hoje. Seja humano, conciso, em português. 4-7 linhas. Não liste tudo: priorize o que gera ação.' },
      { role: 'user', content: `${greeting}.\n\nITENS NA MEMÓRIA:\n${bullets}\n\nResumo para o usuário em linguagem natural, com carinho.` }
    ];
    const r = await askProvider(llm, prompt);
    if (r.ok) aiBrief = r.text;
  }

  res.json({
    greeting,
    today: today.toISOString(),
    aiBrief,
    counts: {
      total: memoryItems.length,
      recent: recent.length,
      goals: activeGoals.length,
      warnings: warnings.length,
      reminders: reminders.length,
      resume: resume.length,
    },
    activeGoals,
    resume,
    warnings,
    reminders,
    recentDecisions,
    patterns,
    contradictions,
    timelineRecent,
    types: TYPE_META,
  });
});

app.get('/api/memory/timeline', (req, res) => {
  const { limit = 100 } = req.query;
  const events = [...timeline].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, Number(limit));
  res.json({ events, total: timeline.length });
});

app.post('/api/conversations', (req, res) => {
  const { title = '', messages = [] } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Conversa vazia.' });
  const conv = {
    id: uid(),
    createdAt: nowISO(),
    title: String(title).slice(0, 140) || messages[0]?.content?.slice(0, 80) || 'Conversa',
    messages: normalizeMessages(messages),
  };
  conversations.unshift(conv);
  saveConversations();
  timeline.push({ id: uid(), date: conv.createdAt, kind: 'conversation', conversationId: conv.id, text: conv.title });
  saveTimeline();
  res.json({ conversation: conv });
});

app.get('/api/conversations', (req, res) => {
  const summary = conversations.slice(0, 50).map(c => ({
    id: c.id, createdAt: c.createdAt, title: c.title, messages: c.messages.length,
  }));
  res.json({ items: summary, total: conversations.length });
});

app.get('/api/conversations/:id', (req, res) => {
  const c = conversations.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Conversa não encontrada.' });
  res.json({ conversation: c });
});

app.post('/api/memory/import', async (req, res) => {
  const { format = 'auto', data, dryRun = false } = req.body || {};
  if (!data) return res.status(400).json({ error: 'Dados de importação ausentes.' });
  let items = [];

  if (Array.isArray(data) && data.every(x => x && (typeof x.content === 'string' || Array.isArray(x)))) {
    const allText = [];
    for (const m of data) {
      if (typeof m?.content === 'string') allText.push(`[${m.role || 'user'}] ${m.content}`);
    }
    const blob = allText.join('\n\n');
    if (configured('claude') && blob.length > 200) {
      const typeList = MEMORY_TYPES.join('|');
      const prompt = `Analise esta conversa/histórico e extraia itens de memória realmente importantes e acionáveis. Ignore saudações e conversa fiada. Retorne APENAS JSON: [{"text":"...","type":"${typeList}","importance":1,"tags":["..."],"title":"opcional"}]. Máximo 20 itens.\n\nHISTÓRICO:\n${blob.slice(0, 60000)}`;
      const r = await askProvider('claude', [{ role: 'user', content: prompt }]);
      if (r.ok) {
        try {
          const parsed = JSON.parse(r.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
          if (Array.isArray(parsed)) items = parsed;
        } catch { /* ignore */ }
      }
    } else if (blob.length) {
      items.push({ type: 'insight', text: blob.slice(0, 5000), importance: 1 });
    }
  }

  if (!items.length && Array.isArray(data)) {
    for (const raw of data) {
      if (typeof raw === 'string' && raw.trim()) items.push({ type: 'insight', text: raw, importance: 1 });
      else if (raw && typeof raw.text === 'string') items.push({ type: MEMORY_TYPES.includes(raw.type) ? raw.type : 'insight', text: raw.text, importance: raw.importance || 1, tags: raw.tags || [], title: raw.title });
    }
  }

  const normalized = items.filter(x => x?.text?.trim()).map(x => ({
    id: uid(),
    createdAt: nowISO(),
    text: String(x.text).slice(0, 5000),
    type: MEMORY_TYPES.includes(x.type) ? x.type : 'insight',
    importance: Math.max(1, Math.min(3, Number(x.importance) || 1)),
    tags: Array.isArray(x.tags) ? x.tags.filter(t => typeof t === 'string').slice(0, 8) : [],
    title: typeof x.title === 'string' && x.title.trim() ? x.title.slice(0, 140) : undefined,
    source: 'import',
  }));

  if (!dryRun) {
    memoryItems = [...normalized, ...memoryItems];
    saveMemory();
    for (const n of normalized) {
      timeline.push({ id: uid(), date: n.createdAt, kind: 'memory_created', memoryId: n.id, type: n.type, text: n.text.slice(0, 140) });
    }
    saveTimeline();
  }
  res.json({ imported: normalized.length, items: normalized, dryRun });
});

app.listen(PORT, () => console.log(`NEXUS V4 — Memory Core rodando em http://localhost:${PORT}`));
