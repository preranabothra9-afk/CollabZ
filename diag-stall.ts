import { config } from 'dotenv';
config();
import { io as ioc, Socket } from 'socket.io-client';

const BASE = process.env.STALL_BASE_URL || 'http://localhost:3100';
const MODELS = (process.env.STALL_MODELS || 'gemini-2.5-flash,gpt-oss-120b,qwen3.8-27b').split(',');

type Track = {
  chunks: number;
  aiChunks: number;
  firstChunkMs: number | null;
  lastChunkMs: number | null;
  maxGapMs: number;
  statuses: string[];
  finished: 'completed' | 'failed' | 'stopped' | null;
  finishedMs: number | null;
  contentChars: number;
};

const t0 = Date.now();
const elapsed = () => Date.now() - t0;
const tracks: Record<string, Track> = {};
const timeline: string[] = [];
const packetLog: { ms: number; ev: string }[] = [];

function ensure(key: string): Track {
  if (!tracks[key]) {
    tracks[key] = {
      chunks: 0, aiChunks: 0, firstChunkMs: null, lastChunkMs: null,
      maxGapMs: 0, statuses: [], finished: null, finishedMs: null, contentChars: 0
    };
  }
  return tracks[key];
}

async function api(path: string, options: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${body.error || body.message || JSON.stringify(body).slice(0, 200)}`);
  return body;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('ADMIN_EMAIL/ADMIN_PASSWORD missing from env');

  console.log(`target: ${BASE}`);
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const token = login.token as string;
  const user = login.user || { id: login.userId, name: login.name, avatar: login.avatar };
  console.log(`logged in as ${user.name}`);

  const ws = await api('/workspaces', { method: 'POST', body: JSON.stringify({ name: 'zz-stall-diagnosis', description: 'temp' }) }, token);
  const workspaceId = ws.workspace?.id || ws.id;
  const conv = await api('/conversations', { method: 'POST', body: JSON.stringify({ workspaceId, title: 'stall-test' }) }, token);
  const conversationId = conv.conversation?.id || conv.id;
  console.log(`temp workspace=${workspaceId} conversation=${conversationId}`);

  const socket: Socket = ioc(BASE, { auth: { token }, transports: ['websocket'], reconnection: false });

  socket.on('connect_error', (err) => console.log(`connect_error: ${err.message}`));

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (e) => reject(e));
    setTimeout(() => reject(new Error('socket connect timeout')), 15000);
  });
  console.log('socket connected');

  // Catch every inbound event name to detect which families stop flowing.
  const tracked = new Set<string>([
    'message-created', 'model-status-update', 'model-stream-chunk', 'model-stream-complete',
    'model-stream-failed', 'model-stream-stopped', 'ai-stream-chunk', 'ai-stream-end', 'ai-stream-start', 'error-alert'
  ]);
  socket.onAny((ev, ...args) => {
    const ms = elapsed();
    if (tracked.has(ev)) packetLog.push({ ms, ev });
    const a: any = args[0] || {};
    const key = a.modelKey;

    if (ev === 'model-status-update' || ev === 'ai-stream-start') {
      if (key) { ensure(key).statuses.push(`${ev}@${ms}ms`); timeline.push(`+${ms}ms ${ev} ${key}`); }
    }
    if (ev === 'model-stream-chunk' || ev === 'ai-stream-chunk') {
      if (key) {
        const tr = ensure(key);
        if (tr.firstChunkMs === null) { tr.firstChunkMs = ms; timeline.push(`+${ms}ms first chunk ${key}`); }
        else tr.maxGapMs = Math.max(tr.maxGapMs, ms - tr.lastChunkMs!);
        tr.lastChunkMs = ms;
        tr.contentChars += (a.chunk || '').length;
        if (ev === 'model-stream-chunk') tr.chunks++; else tr.aiChunks++;
      }
    }
    if (ev === 'model-stream-complete' || ev === 'model-stream-failed' || ev === 'model-stream-stopped') {
      if (key) {
        const tr = ensure(key);
        tr.finished = ev === 'model-stream-complete' ? 'completed' : ev === 'model-stream-stopped' ? 'stopped' : 'failed';
        tr.finishedMs = ms;
        timeline.push(`+${ms}ms ${ev} ${key}`);
      }
    }
    if (ev === 'error-alert') timeline.push(`+${ms}ms error-alert: ${JSON.stringify(a).slice(0, 120)}`);
  });

  socket.emit('join-workspace', {
    workspaceId, userId: user.id, userName: user.name, avatar: user.avatar
  });
  await sleep(800);

  const startedAt = elapsed();
  socket.emit('submit-prompt', {
    workspaceId, conversationId,
    promptText: 'Explain async/await in JavaScript in two sentences.',
    selectedModels: MODELS,
    userId: user.id, userName: user.name, userAvatar: user.avatar
  });
  console.log('prompt submitted; watching events for 45s...');

  // Watch for progress until everything finishes or timeout.
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await sleep(500);
    const allDone = MODELS.every((m) => ensure(m).finished);
    if (allDone) break;
  }

  console.log('\n=== PER MODEL ===');
  for (const m of MODELS) {
    const tr = ensure(m);
    const gap = tr.maxGapMs;
    console.log(
      `${m.padEnd(16)} chunks=${String(tr.chunks).padStart(3)}/${String(tr.aiChunks).padStart(3)}(legacy/ai) ` +
      `first=${String(tr.firstChunkMs ?? '-').padStart(5)}ms last=${String(tr.lastChunkMs ?? '-').padStart(5)}ms ` +
      `maxGap=${gap}ms content=${tr.contentChars}ch status=${tr.finished ?? 'STILL RUNNING'}@${tr.finishedMs ?? '-'}ms`
    );
  }

  console.log('\n=== TIMELINE ===');
  console.log(timeline.slice(0, 60).join('\n'));

  const eventFamilies = new Map<string, number>();
  for (const p of packetLog) eventFamilies.set(p.ev, (eventFamilies.get(p.ev) || 0) + 1);
  console.log('\n=== EVENT COUNTS ===');
  console.log(Array.from(eventFamilies.entries()).map(([k, v]) => `${k}=${v}`).join('  '));
  console.log(`\nwatched ${elapsed()}ms (prompt started +${startedAt}ms)`);

  socket.disconnect();
  try { await api(`/workspaces/${workspaceId}`, { method: 'DELETE' }, token); console.log('temp workspace deleted'); }
  catch (e: any) { console.log(`cleanup failed (leftover temp workspace): ${e.message}`); }
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
