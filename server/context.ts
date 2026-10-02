import { db } from './database';
import { Message } from '../src/types';

// ---------------------------------------------------------------------------
// Persistent AI context: claims + room history.
//
// Everything here is deliberately model-agnostic. The AI layer accepts a single
// prompt string for every transport (Google SDK and OpenAI-compatible alike),
// so this module's only job is to *compose that string* well: ground it in what
// was actually said before, bound it tightly, and forbid the model from filling
// gaps with invention.
// ---------------------------------------------------------------------------

export interface ExtractedClaim {
  text: string;
}

/** How many claims a single response may contribute. */
const MAX_CLAIMS_PER_RESPONSE = 4;
/** Claim sentence length bounds, in characters. */
const MIN_CLAIM_LENGTH = 28;
const MAX_CLAIM_LENGTH = 220;
/** How much history and memory goes into a room context. */
const MAX_CONTEXT_MESSAGES = 6;
const MAX_CONTEXT_CLAIMS = 10;
const MAX_EXCERPT_CHARS = 380;
/** Hard ceiling so the preamble can never swamp a small context window. */
const MAX_CONTEXT_CHARS = 3200;

// Sentences starting with these are conversational furniture or meta commentary,
// not statements about the subject matter.
const NON_CLAIM_OPENERS = [
  'here', 'note', 'let', 'please', 'sure', 'absolutely', 'certainly', 'of course',
  'i ', "i'", 'you ', 'your ', 'yours', 'we ', 'our ', 'my ', 'me ', 'us ',
  'tip', 'happy', 'glad', 'unfortunately', 'apolog', 'disclaimer', 'warning',
  'caution', 'summary', 'conclusion', 'caveat', 'reminder', 'ps:', 'p.s.',
  // Question words: these open headings ("How it works") or questions, neither
  // of which is a claim about the subject matter.
  'how', 'why', 'what', 'when', 'where', 'who', 'which', 'whose',
  // AI self-descriptions ("As an AI, ...") always precede a hedge, never a claim.
  'as an ai', 'as a language', 'as a model',
];

// Capability refusals are meta-commentary about what the assistant can or cannot
// look up, not assertions about the subject. Storing one would poison the room's
// memory with a statement about the model rather than the project.
const REFUSAL_PHRASES = [
  'do not have access', 'don\'t have access', 'cannot confirm', 'can\'t confirm',
  'cannot verify', 'can\'t verify', 'as an ai', 'language model', 'real-time',
  'up-to-date', 'up to date', 'internal project details', 'specific details',
  'beyond my knowledge', 'outside my knowledge', 'no information', 'not aware of',
];

// Base verb vocabulary. A claim asserts something, so it needs a finite verb.
// Matching is done against simple stem variants (run/runs/ran/running). The list
// is deliberately broad: it only gates "does this read as an assertion rather
// than a heading or fragment", while the length band, opener list and heading
// stripping carry the real filtering. Gaps here silently drop real claims, which
// in turn starves the contradiction graph — so coverage matters.
const BASE_VERBS = new Set([
  'be', 'have', 'do', 'use', 'make', 'get', 'take', 'give', 'say', 'tell',
  'provide', 'support', 'allow', 'enable', 'require', 'need', 'scale', 'run',
  'store', 'send', 'return', 'generate', 'create', 'build', 'handle', 'process',
  'produce', 'reduce', 'increase', 'improve', 'mean', 'expect', 'recommend',
  'consider', 'suggest', 'help', 'work', 'operate', 'contain', 'include',
  'offer', 'deliver', 'achieve', 'ensure', 'fetch', 'parse', 'validate',
  'authenticate', 'encrypt', 'cache', 'queue', 'emit', 'broadcast', 'persist',
  'extract', 'compose', 'assemble', 'route', 'forward', 'proxy', 'accept',
  'reject', 'rejects', 'avoid', 'prevent', 'guarantee', 'maintain', 'preserve',
  'replace', 'remove', 'delete', 'update', 'modify', 'trigger', 'invoke',
  'request', 'respond', 'answer', 'expose', 'represent', 'describe', 'explain',
  'assume', 'appear', 'seem', 'remain', 'become', 'start', 'stop', 'begin',
  'default', 'behave', 'perform', 'execute', 'compile', 'deploy', 'serve',
  // Conjugations of "to be" and common auxiliaries or modals. Without these a
  // plain assertion like "Postgres is the primary store" has no recognised
  // finite verb and was wrongly discarded as a fragment.
  'is', 'are', 'was', 'were', 'am', 'been', 'being',
  'has', 'had', 'does', 'did',
  'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must',
  // High-frequency general verbs. The vocabulary only gates "does this read as
  // an assertion rather than a heading", so generous coverage is safe: the
  // length band, opener list and heading stripping carry the real filtering.
  'add', 'apply', 'base', 'believe', 'bring', 'carry', 'cause', 'change',
  'compare', 'confirm', 'cost', 'cover', 'curb', 'cut', 'depend', 'derive',
  'double', 'drive', 'drop', 'exist', 'expand', 'face', 'fall', 'find',
  'focus', 'follow', 'fuel', 'gain', 'grow', 'happen', 'hold', 'identify',
  'involve', 'know', 'last', 'lead', 'limit', 'link', 'lower', 'manage',
  'meet', 'move', 'note', 'own', 'pass', 'pick', 'plan', 'protect', 'prove',
  'raise', 'reach', 'receive', 'recognize', 'report', 'result', 'rise', 'see',
  'seek', 'select', 'set', 'share', 'shield', 'shift', 'show', 'solve',
  'spend', 'stand', 'stay', 'supply', 'surpass', 'survive', 'target', 'tend',
  'test', 'track', 'treat', 'turn', 'understand', 'vary', 'view', 'want',
  'watch', 'win', 'write', 'yield',
  // Common verbs across technical and general prose. Each missing entry here
  // silently drops a claim, so this list errs toward inclusion.
  'listen', 'talk', 'speak', 'read', 'learn', 'teach', 'play', 'ask', 'answer',
  'call', 'connect', 'disconnect', 'attach', 'detach', 'open', 'close', 'load',
  'unload', 'save', 'restore', 'backup', 'recover', 'fail', 'succeed', 'retry',
  'abort', 'cancel', 'pause', 'resume', 'restart', 'shutdown', 'launch', 'init',
  'install', 'configure', 'setup', 'initialize', 'register', 'login', 'logout',
  'authenticate', 'authorize', 'permit', 'deny', 'grant', 'assign', 'allocate',
  'deallocate', 'allocate', 'reserve', 'release', 'lock', 'unlock', 'commit',
  'rollback', 'flush', 'refresh', 'sync', 'synchronize', 'replicate', 'shard',
  'partition', 'index', 'query', 'insert', 'update', 'select', 'join', 'migrate',
  'transform', 'convert', 'translate', 'encode', 'decode', 'compress', 'decompress',
  'upload', 'download', 'transfer', 'stream', 'buffer', 'batch', 'schedule',
  'poll', 'subscribe', 'unsubscribe', 'publish', 'consume', 'handle', 'retry',
  'skip', 'ignore', 'discard', 'keep', 'retain', 'evict', 'expire', 'invalidate',
  'verify', 'check', 'assert', 'guarantee', 'promise', 'resolve', 'fulfill',
  'complete', 'finish', 'end', 'terminate', 'exit', 'quit', 'halt', 'suspend',
  'wake', 'sleep', 'idle', 'busy', 'wait', 'block', 'await', 'notify', 'alert',
  'log', 'trace', 'debug', 'monitor', 'observe', 'measure', 'count', 'calculate',
  'compute', 'evaluate', 'assess', 'review', 'approve', 'reject', 'submit',
  'cancel', 'postpone', 'delay', 'defer', 'prioritize', 'queue', 'schedule',
  'limit', 'cap', 'throttle', 'rate', 'regulate', 'control', 'govern', 'enforce',
  'detect', 'report', 'flag', 'raise', 'throw', 'catch', 'handle', 'recover',
  'integrate', 'interface', 'interact', 'communicate', 'collaborate', 'share',
  'exchange', 'negotiate', 'agree', 'disagree', 'conflict', 'contradict',
  'match', 'differ', 'diverge', 'align', 'correlate', 'associate', 'relate',
  'belong', 'compose', 'comprise', 'consist', 'constitute', 'form', 'shape',
  'design', 'architect', 'structure', 'organize', 'arrange', 'order', 'sort',
  'group', 'cluster', 'gather', 'collect', 'accumulate', 'aggregate', 'summarize',
  'condense', 'simplify', 'clarify', 'explain', 'elaborate', 'detail', 'outline',
  'sketch', 'draft', 'prototype', 'implement', 'develop', 'program', 'code',
  'test', 'debug', 'fix', 'repair', 'patch', 'mend', 'correct', 'rectify',
  'optimize', 'tune', 'refine', 'polish', 'clean', 'purge', 'prune', 'trim',
  'expand', 'extend', 'stretch', 'grow', 'scale', 'shrink', 'reduce', 'minimize',
  'maximize', 'amplify', 'boost', 'enhance', 'degrade', 'worsen', 'improve',
  'function', 'operate', 'perform', 'behave', 'react', 'respond', 'adapt',
  'adjust', 'calibrate', 'align', 'tune', 'conform', 'comply', 'violate',
  'satisfy', 'meet', 'fulfil', 'accomplish', 'achieve', 'attain', 'reach',
  'begin', 'commence', 'initiate', 'launch', 'inaugurate', 'establish',
  'found', 'create', 'originate', 'spawn', 'derive', 'evolve', 'develop',
  'listen', 'watch', 'observe', 'witness', 'experience', 'feel', 'sense',
  'perceive', 'notice', 'detect', 'discover', 'find', 'uncover', 'reveal',
  'expose', 'disclose', 'conceal', 'hide', 'mask', 'obscure', 'encrypt',
  'decrypt', 'hash', 'salt', 'sign', 'seal', 'stamp', 'certify', 'attest',
]);

function stem(word: string): string[] {
  const w = word.toLowerCase();
  const variants = new Set<string>([w]);
  if (w.endsWith('ies') && w.length > 4) { variants.add(w.slice(0, -3) + 'y'); variants.add(w.slice(0, -3)); }
  // "-ied" past tense of carry/ferry-style verbs: "carried" -> "carry".
  if (w.endsWith('ied') && w.length > 4) variants.add(w.slice(0, -3) + 'y');
  if (w.endsWith('es') && w.length > 3) variants.add(w.slice(0, -2));
  if (w.endsWith('s') && w.length > 2) variants.add(w.slice(0, -1));
  if (w.endsWith('ed') && w.length > 3) {
    variants.add(w.slice(0, -2));
    variants.add(w.slice(0, -1));
    // "deployed" -> "deploy" (silent e), "planned" -> "plan" (doubled consonant).
    const withoutEd = w.slice(0, -2);
    variants.add(withoutEd + 'e');
    if (withoutEd.length > 2 && withoutEd[withoutEd.length - 1] === withoutEd[withoutEd.length - 2]) {
      variants.add(withoutEd.slice(0, -1));
    }
  }
  if (w.endsWith('ing') && w.length > 4) {
    const withoutIng = w.slice(0, -3);
    variants.add(withoutIng);
    variants.add(withoutIng + 'e');
    // "running" -> "run", "listening" already covered by the plain stem.
    if (withoutIng.length > 2 && withoutIng[withoutIng.length - 1] === withoutIng[withoutIng.length - 2]) {
      variants.add(withoutIng.slice(0, -1));
    }
  }
  return [...variants];
}

function hasFiniteVerb(sentence: string): boolean {
  const tokens = sentence.toLowerCase().split(/[^a-z']+/).filter(Boolean);
  for (const token of tokens) {
    for (const variant of stem(token)) {
      if (BASE_VERBS.has(variant)) return true;
    }
  }
  return false;
}

/** Strips markdown structure so sentence splitting sees prose, not markup. */
function stripMarkdown(text: string): string {
  return text
    // Remove fenced code blocks wholesale — code is not a claim.
    .replace(/```[\s\S]*?```/g, ' ')
    // Inline code.
    .replace(/`[^`\n]*`/g, ' ')
    // Keep link text, drop the target.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Images.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    // Emphasis, bold, strikethrough markers.
    .replace(/[*_~]+/g, '')
    // Headings and list markers at line starts. Headings are dropped outright;
    // list markers are replaced with a sentinel so the extractor can excuse a
    // bullet item's (usually absent) trailing period while still rejecting
    // headings and fragments.
    .replace(/^\s{0,4}(#{1,6}\s*|([-*+]|\d+[.)])\s+)/gm, (_m, _heading, list) => (list ? '\u0001' : ' '))
    // Blockquotes and horizontal rules.
    .replace(/^\s{0,4}>{1,}\s*/gm, '')
    .replace(/^\s{0,4}[-*_]{3,}\s*$/gm, ' ')
    .trim();
}

/** Splits into candidate sentence strings, keeping terminal punctuation. */
function splitSentences(text: string): string[] {
  const lines = text.split(/\n+/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Split on sentence terminators that are followed by whitespace or end-of-line.
    const pieces = trimmed.split(/(?<=[.!?])\s+/);
    for (const piece of pieces) {
      const p = piece.trim();
      if (p) out.push(p);
    }
  }
  return out;
}

function normalizeClaim(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts meaningful, quotable claims from a completed AI response.
 *
 * Purely heuristic and deterministic: no extra model call, identical behaviour
 * across every provider. A sentence becomes a claim when it reads as a complete
 * declarative assertion about the subject matter — it has a finite verb, ends
 * with a period or exclamation mark, is neither a question nor a heading nor
 * conversational filler, and is within a useful length band.
 */
export function extractClaims(responseText: string): ExtractedClaim[] {
  if (!responseText || typeof responseText !== 'string') return [];

  const prose = stripMarkdown(responseText);
  const candidates = splitSentences(prose);
  const seen = new Set<string>();
  const claims: ExtractedClaim[] = [];

  for (const raw of candidates) {
    if (claims.length >= MAX_CLAIMS_PER_RESPONSE) break;

    // A list marker survives stripping as a sentinel: bullet items normally
    // omit their trailing period, so they are excused the terminal-punctuation
    // rule below. The finite-verb, length and opener checks still keep
    // headings and sentence fragments out.
    const isListItem = raw.startsWith('\u0001');
    const text = normalizeClaim(raw).replace(/^\u0001\s*/, '');
    if (text.length < MIN_CLAIM_LENGTH || text.length > MAX_CLAIM_LENGTH) continue;

    const lower = text.toLowerCase();

    // Must be declarative: ends a sentence, and is not a question or a lead-in.
    if (!isListItem && !/[.!?]$/.test(text)) continue;
    if (lower.endsWith('?')) continue;
    if (text.endsWith(':') || text.endsWith(';')) continue;
    // Headings and labels survive markdown stripping without punctuation.
    if (!hasFiniteVerb(text)) continue;

    if (NON_CLAIM_OPENERS.some((opener) => lower.startsWith(opener))) continue;

    // A capability refusal ("I do not have access to ... internal project
    // details") would otherwise become a claim and poison the room's memory.
    if (REFUSAL_PHRASES.some((phrase) => lower.includes(phrase))) continue;

    const key = lower.replace(/[^a-z0-9 ]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);

    claims.push({ text });
  }

  return claims;
}

/** Truncates at a word boundary so excerpts never cut mid-word. */
function excerpt(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const slice = clean.slice(0, limit);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…';
}

function firstCompletedResponse(message: Message): { modelName: string; content: string } | null {
  const responses = Object.values(message.modelResponses || {});
  const completed = responses.find((r) => r && r.status === 'completed' && r.content && r.content.trim());
  if (!completed) return null;
  return { modelName: completed.modelName, content: completed.content };
}

/**
 * Assembles a bounded, model-agnostic context preamble for a room, then appends
 * the new prompt the user actually submitted.
 *
 * Only real, stored messages and claims are ever quoted, and the preamble says
 * so explicitly — the model is told to answer the new prompt, treat the quoted
 * history as the sole source of truth about "what was discussed", and never
 * invent beyond it.
 */
export async function buildRoomContext(
  conversationId: string,
  newPrompt: string
): Promise<{ prompt: string; hasContext: boolean }> {
  const [recent, claims] = await Promise.all([
    db.getMessages(conversationId, { limit: MAX_CONTEXT_MESSAGES + 6 }),
    db.getClaims(conversationId, MAX_CONTEXT_CLAIMS + 6),
  ]);

  // Only messages that actually produced an answer can teach the room anything.
  const withAnswers = recent.messages
    .filter(firstCompletedResponse)
    .slice(-MAX_CONTEXT_MESSAGES);

  const recentClaims = claims.slice(0, MAX_CONTEXT_CLAIMS);

  // Nothing to ground on yet — first prompt in the room gets a clean slate.
  if (withAnswers.length === 0 && recentClaims.length === 0) {
    return { prompt: newPrompt, hasContext: false };
  }

  const lines: string[] = [
    '## Ongoing room context',
    '',
    'The room below has an ongoing discussion. Treat the quoted history as the ONLY',
    'source of truth about what was previously said. Use it to keep your answer',
    'consistent where it is relevant, and NEVER invent, guess, or allude to earlier',
    'messages beyond what is quoted here.',
  ];

  if (recentClaims.length > 0) {
    lines.push('', '### Established claims from earlier AI responses');
    for (const claim of recentClaims) {
      lines.push(`- ${excerpt(claim.text, MAX_CLAIM_LENGTH)} — *${claim.modelName}*`);
    }
  }

  if (withAnswers.length > 0) {
    lines.push('', '### Recent messages');
    for (const message of withAnswers) {
      const response = firstCompletedResponse(message)!;
      lines.push(`**${message.senderName}** asked: ${excerpt(message.promptText, MAX_EXCERPT_CHARS)}`);
      lines.push(`**${response.modelName}** answered: ${excerpt(response.content, MAX_EXCERPT_CHARS)}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## New prompt to answer now');
  lines.push('');
  lines.push(newPrompt.trim());

  // Trim oldest context until the preamble fits the budget. Claims are kept
  // (they are the distilled memory); messages are dropped from the top.
  let context = lines.join('\n');
  while (context.length > MAX_CONTEXT_CHARS) {
    const trimmed = context.split('\n').slice(1).join('\n');
    if (trimmed.length >= context.length) break;
    context = trimmed;
  }

  return { prompt: context, hasContext: true };
}
