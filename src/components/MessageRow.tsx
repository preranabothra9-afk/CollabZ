import { memo, useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, ClipboardCheck, Bookmark, BookmarkCheck, ShieldCheck, Zap, Bot, Square, Pencil, X, Send, Trash2 } from 'lucide-react';
import type { Message } from '../types';

interface MessageRowProps {
  msg: Message;
  isEditing: boolean;
  highlight: boolean;
  pinnedKeys: Set<string>;
  copiedMap: Record<string, boolean>;
  onStartEditing: (id: string) => void;
  onCancelEditing: () => void;
  onCopy: (text: string, refKey: string) => void;
  onPinToggle: (prompt: string, modelName: string, content: string, senderName: string) => void;
  onStop: (messageId: string, modelKey: string) => void;
  onSubmitPrompt: (text: string) => void;
  /** Removes this whole row — the prompt and every response card. */
  onDelete: (messageId: string) => void;
}

/**
 * One prompt + its AI response cards.
 *
 * Memoized on purpose: the socket emits a chunk per token, and each chunk swaps
 * the streaming Message object in the store. Every other message keeps its
 * identity, so React.memo lets the rest of the feed skip re-rendering (and
 * skip re-parsing markdown) while a model is still streaming.
 */
function MessageRowImpl({
  msg,
  isEditing,
  highlight,
  pinnedKeys,
  copiedMap,
  onStartEditing,
  onCancelEditing,
  onCopy,
  onPinToggle,
  onStop,
  onSubmitPrompt,
  onDelete,
}: MessageRowProps) {
  const [editText, setEditText] = useState(msg.promptText);

  // A row still being generated can't be removed — the completion handler
  // would write it straight back. The server enforces this too (HTTP 409).
  const isBusy = Object.values(msg.modelResponses).some(
    (r) => r.status === 'streaming' || r.status === 'pending'
  );

  const handleStartEdit = () => {
    setEditText(msg.promptText);
    onStartEditing(msg.id);
  };

  // Sends the edited prompt as a fresh request, keeping the original message as history.
  const handleResend = () => {
    const text = editText.trim();
    if (!text || text === msg.promptText.trim()) {
      onCancelEditing();
      return;
    }
    onSubmitPrompt(text);
    onCancelEditing();
  };

  const modelsKeys = Object.keys(msg.modelResponses);
  const gridCols = modelsKeys.length === 1 ? 'grid-cols-1' : modelsKeys.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3';

  return (
    <div id={`msg-${msg.id}`} className={`space-y-4 rounded-2xl transition-all ${highlight ? 'ring-2 ring-ember/60 p-3 -m-3 animate-fadeIn' : ''}`}>
      {/* User Prompt */}
      <div className="flex items-start gap-2.5 max-w-2xl ml-auto flex-row-reverse group/msg">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ember to-ember-2 text-on-ember font-bold flex items-center justify-center text-[13px] shrink-0 mt-0.5 shadow-md shadow-ember/10">
          {msg.senderAvatar === 'SYSTEM' ? '⚙' : msg.senderAvatar}
        </div>
        <div className="flex flex-col items-end min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[13px] text-faint font-mono">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-[14px] font-semibold text-cream">{msg.senderName}</span>
          </div>
          {isEditing ? (
            /* Inline editor: modify the prompt and resend it */
            <div className="w-full max-w-xl bg-panel-2/90 border border-ember/40 rounded-xl rounded-tr-sm p-2.5 flex flex-col gap-2 shadow-md">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={4}
                autoFocus
                className="w-full bg-panel/70 border border-line/50 rounded-lg p-2 text-[13px] text-cream font-medium leading-relaxed resize-y focus:outline-none focus:border-ember/50"
                placeholder="Edit your prompt..."
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancelEditing();
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleResend();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-faint font-mono">Ctrl+Enter to resend</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={onCancelEditing}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-medium border border-line/50 bg-panel-2/60 text-faint hover:text-cream hover:border-line-2 transition-all cursor-pointer">
                    <X size={11} /> Cancel
                  </button>
                  <button type="button" onClick={handleResend}
                    disabled={!editText.trim() || editText.trim() === msg.promptText.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-ember text-on-ember hover:bg-ember-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    <Send size={11} /> Edit & resend
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative inline-block">
              <p className="text-[12px] text-cream font-medium leading-relaxed bg-panel-2/80 hover:bg-panel-2 transition-all p-3 rounded-xl rounded-tr-sm border border-line/60 inline-block shadow-sm whitespace-pre-wrap break-words pr-14">
                {msg.promptText}
              </p>
              <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-all">
                <button type="button" onClick={handleStartEdit} title="Edit and resend"
                  className="p-1 rounded-md text-faint hover:text-ember hover:bg-line/60 transition-all cursor-pointer">
                  <Pencil size={11} />
                </button>
                <button type="button" onClick={() => onCopy(msg.promptText, `${msg.id}_prompt`)} title="Copy"
                  className="p-1 rounded-md text-faint hover:text-cream hover:bg-line/60 transition-all cursor-pointer">
                  {copiedMap[`${msg.id}_prompt`] ? <ClipboardCheck size={11} className="text-leaf" /> : <Copy size={11} />}
                </button>
                <button type="button" onClick={() => onDelete(msg.id)} disabled={isBusy}
                  title={isBusy ? 'Wait for the response to finish before removing' : 'Remove this prompt and its response'}
                  className="p-1 rounded-md text-faint hover:text-rust hover:bg-line/60 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Response Cards */}
      <div className={`grid gap-4 ${gridCols} w-full`}>
        {modelsKeys.map((modelKey) => {
          const response = msg.modelResponses[modelKey];
          const textRefKey = `${msg.id}_${modelKey}`;
          const customPinned = pinnedKeys.has(`${msg.promptText.trim()}|${response.modelName.trim()}`);

          return (
            <div key={modelKey} className={`bg-panel/90 backdrop-blur-sm rounded-xl flex flex-col overflow-hidden transition-all duration-300 border ${response.status === 'streaming' ? 'border-ember/40 ws-streaming-glow' : (response.status === 'completed' || response.status === 'stopped') ? 'border-line/50 hover:border-line-2 hover:shadow-md' : 'border-line/50'}`}>
              {/* Card Header */}
              <div className="px-4 py-2.5 bg-panel-2/40 border-b border-line/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${response.status === 'streaming' ? 'bg-ember/15 text-ember' : response.status === 'stopped' ? 'bg-amber-500/15 text-warn' : response.status === 'completed' ? 'bg-leaf/10 text-leaf' : 'bg-panel-2 text-faint'}`}><Bot size={12} /></div>
                  <div>
                    <span className="text-[14px] font-semibold text-cream block leading-tight">{response.modelName}</span>
                    {response.status === 'streaming' && <span className="text-[12px] font-mono text-ember animate-pulse">streaming</span>}
                    {response.status === 'stopped' && <span className="text-[12px] font-mono text-warn">stopped by you</span>}
                    {response.status === 'pending' && <span className="text-[12px] font-mono text-faint">queued</span>}
                  </div>
                </div>
                {response.status === 'streaming' && (
                  <button type="button" onClick={() => onStop(msg.id, modelKey)} title="Stop this model"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-rust/40 bg-rust/5 text-rust hover:bg-rust/15 text-[12px] font-mono font-bold uppercase transition-all cursor-pointer">
                    <Square size={9} /> Stop
                  </button>
                )}
                {(response.status === 'completed' || response.status === 'stopped') && (
                  <div className="flex items-center gap-1.5">
                    {response.durationMs && (
                      <span className="text-[13px] font-mono text-sand px-1.5 py-0.5 bg-ink/50 border border-line/50 rounded-md flex items-center gap-0.5"><Zap size={9} className="text-ember" />{response.durationMs}ms</span>
                    )}
                    <button type="button" onClick={() => onCopy(response.content, textRefKey)} className="p-1 hover:bg-line/60 rounded-md text-faint hover:text-cream transition-all cursor-pointer" title="Copy">
                      {copiedMap[textRefKey] ? <ClipboardCheck size={11} className="text-leaf" /> : <Copy size={11} />}
                    </button>
                    <button type="button" onClick={() => onPinToggle(msg.promptText, response.modelName, response.content, msg.senderName)}
                      className={`p-1 hover:bg-line/60 rounded-md transition-all cursor-pointer ${customPinned ? 'text-ember' : 'text-faint hover:text-cream'}`} title={customPinned ? 'Unpin' : 'Pin'}>
                      {customPinned ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 flex-1 text-[12px] leading-relaxed max-h-[400px] overflow-y-auto">
                {response.status === 'pending' && (
                  <div className="space-y-2 py-1">
                    <div className="h-3 bg-line/50 rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-line/50 rounded w-5/6 animate-pulse" style={{ animationDelay: '0.15s' }} />
                    <div className="h-3 bg-line/50 rounded w-2/3 animate-pulse" style={{ animationDelay: '0.3s' }} />
                  </div>
                )}
                {response.status === 'failed' && (
                  <div className="bg-rust/5 text-rust border border-rust/15 rounded-lg p-3 text-[14px] flex flex-col gap-1">
                    <span className="font-semibold uppercase tracking-wider text-[13px]">Model Failure</span>
                    <p className="font-mono text-[13px]">{response.error || 'Connection timed out.'}</p>
                  </div>
                )}
                {(response.status === 'streaming' || response.status === 'completed' || response.status === 'stopped') && response.content && (
                  <div className="markdown-body select-text antialiased"><ReactMarkdown>{response.content}</ReactMarkdown></div>
                )}
                {response.status === 'stopped' && !response.content && (
                  <p className="text-[13px] text-faint font-mono italic">Stopped before any text was received.</p>
                )}
                {response.status === 'streaming' && <span className="inline-block w-1.5 h-4 bg-ember ml-0.5 animate-pulse rounded-full" />}
              </div>

              {/* Footer */}
              <div className="px-4 py-1.5 bg-panel-2/30 border-t border-line/40 flex items-center justify-between text-[12px] text-faint font-mono">
                <span className="flex items-center gap-1"><ShieldCheck size={8} className="text-leaf" />SSL</span>
                <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-leaf" />SECURE</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MessageRow = memo(MessageRowImpl);
export default MessageRow;
