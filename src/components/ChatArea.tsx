import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import ReactMarkdown from 'react-markdown';
import { Copy, ClipboardCheck, Bookmark, BookmarkCheck, ArrowDown, Network, ShieldCheck, Zap, Bot } from 'lucide-react';

export default function ChatArea() {
  const { messages, activeConversation, saveResponse, savedResponses, deleteSavedResponse } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedIdMap, setCopiedIdMap] = useState<Record<string, boolean>>({});
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToBottom = () => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 300);
  };

  const handleCopyText = async (text: string, refKey: string) => {
    let ok = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch { ok = false; }
    if (!ok) { try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); document.body.removeChild(ta); } catch { /* noop */ } }
    if (!ok) return;
    setCopiedIdMap(prev => ({ ...prev, [refKey]: true }));
    setTimeout(() => setCopiedIdMap(prev => ({ ...prev, [refKey]: false })), 1500);
  };

  const isPinned = (prompt: string, modelName: string) => savedResponses.some(s => s.prompt.trim() === prompt.trim() && s.modelName.trim() === modelName.trim());

  const handlePinToggle = async (prompt: string, modelName: string, responseContent: string, senderName: string) => {
    const existing = savedResponses.find(s => s.prompt.trim() === prompt.trim() && s.modelName.trim() === modelName.trim());
    if (existing) await deleteSavedResponse(existing.id);
    else await saveResponse(prompt, modelName, responseContent, senderName);
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-sand p-6 select-none relative overflow-hidden">
        <div className="absolute inset-0 brand-dot-grid opacity-20 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-15 pointer-events-none" style={{ background: 'radial-gradient(circle, var(--color-ember), transparent 70%)', filter: 'blur(60px)' }} />
        <div className="relative flex flex-col items-center max-w-md text-center">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-2xl blur-xl opacity-30" style={{ background: 'var(--brand-gradient-accent)' }} />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-ember/15 to-ember/5 border border-ember/25 flex items-center justify-center text-ember"><Network size={24} /></div>
          </div>
          <h3 className="text-base font-semibold text-cream">Select a Workspace Room</h3>
          <p className="text-[12px] text-sand mt-2 leading-relaxed">Pick or create a room from the sidebar to start parallel AI diagnostics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative bg-transparent">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-8 scroll-smooth mx-auto max-w-5xl w-full">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-lg mx-auto relative">
            <div className="relative bg-panel/80 backdrop-blur-sm border border-line/60 p-8 rounded-2xl shadow-lg flex flex-col items-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-xl blur-lg opacity-25" style={{ background: 'var(--brand-gradient-accent)' }} />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-ember/15 to-ember/5 flex items-center justify-center border border-ember/25 text-ember animate-pulse"><Network size={20} /></div>
              </div>
              <h4 className="text-sm font-semibold text-cream">Room Ready</h4>
              <p className="text-[12px] text-sand mt-2 max-w-xs leading-relaxed">Type your prompt below, toggle models to compare, and broadcast parallel streams in real time.</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const modelsKeys = Object.keys(msg.modelResponses);
            const gridCols = modelsKeys.length === 1 ? 'grid-cols-1' : modelsKeys.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3';

            return (
              <div key={msg.id} className="space-y-4">
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
                    <div className="relative inline-block">
                      <p className="text-[12px] text-cream font-medium leading-relaxed bg-panel-2/80 hover:bg-panel-2 transition-all p-3 pr-8 rounded-xl rounded-tr-sm border border-line/60 inline-block shadow-sm whitespace-pre-wrap break-words">
                        {msg.promptText}
                      </p>
                      <button type="button" onClick={() => handleCopyText(msg.promptText, `${msg.id}_prompt`)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-md text-faint hover:text-cream hover:bg-line/60 opacity-0 group-hover/msg:opacity-100 transition-all cursor-pointer">
                        {copiedIdMap[`${msg.id}_prompt`] ? <ClipboardCheck size={11} className="text-leaf" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Response Cards */}
                <div className={`grid gap-4 ${gridCols} w-full`}>
                  {modelsKeys.map((modelKey) => {
                    const response = msg.modelResponses[modelKey];
                    const textRefKey = `${msg.id}_${modelKey}`;
                    const customPinned = isPinned(msg.promptText, response.modelName);

                    return (
                      <div key={modelKey} className={`bg-panel/90 backdrop-blur-sm rounded-xl flex flex-col overflow-hidden transition-all duration-300 border ${response.status === 'streaming' ? 'border-ember/40 ws-streaming-glow' : response.status === 'completed' ? 'border-line/50 hover:border-line-2 hover:shadow-md' : 'border-line/50'}`}>
                        {/* Card Header */}
                        <div className="px-4 py-2.5 bg-panel-2/40 border-b border-line/40 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${response.status === 'streaming' ? 'bg-ember/15 text-ember' : response.status === 'completed' ? 'bg-leaf/10 text-leaf' : 'bg-panel-2 text-faint'}`}><Bot size={12} /></div>
                            <div>
                              <span className="text-[14px] font-semibold text-cream block leading-tight">{response.modelName}</span>
                              {response.status === 'streaming' && <span className="text-[12px] font-mono text-ember animate-pulse">streaming</span>}
                            </div>
                          </div>
                          {response.status === 'completed' && (
                            <div className="flex items-center gap-1.5">
                              {response.durationMs && (
                                <span className="text-[13px] font-mono text-sand px-1.5 py-0.5 bg-ink/50 border border-line/50 rounded-md flex items-center gap-0.5"><Zap size={9} className="text-ember" />{response.durationMs}ms</span>
                              )}
                              <button type="button" onClick={() => handleCopyText(response.content, textRefKey)} className="p-1 hover:bg-line/60 rounded-md text-faint hover:text-cream transition-all cursor-pointer" title="Copy">
                                {copiedIdMap[textRefKey] ? <ClipboardCheck size={11} className="text-leaf" /> : <Copy size={11} />}
                              </button>
                              <button type="button" onClick={() => handlePinToggle(msg.promptText, response.modelName, response.content, msg.senderName)}
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
                          {(response.status === 'streaming' || response.status === 'completed') && (
                            <div className="markdown-body select-text antialiased"><ReactMarkdown>{response.content}</ReactMarkdown></div>
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
          })
        )}
      </div>

      {showScrollBottom && (
        <button type="button" onClick={scrollToBottom}
          className="absolute bottom-4 right-6 bg-gradient-to-br from-ember to-ember-2 text-on-ember rounded-xl p-2.5 shadow-lg shadow-ember/25 hover:scale-105 active:scale-95 transition-all cursor-pointer z-50 flex items-center justify-center">
          <ArrowDown size={14} />
        </button>
      )}
    </div>
  );
}
