import React, { useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Send, CheckSquare, Square, Eye, Users, Zap } from 'lucide-react';

export default function PromptBox() {
  const { collaborativePromptText, sendPromptTextChange, sendTypingStatus, submitPrompt, selectedModels, toggleModel, whoIsEditing } = useStore();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    sendPromptTextChange(value);
    sendTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTypingStatus(false), 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collaborativePromptText.trim()) return;
    submitPrompt(collaborativePromptText.trim());
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStatus(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFormSubmit(e); }
  };

  useEffect(() => { return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }; }, []);

  // First three are the default comparison set: Google, OpenAI and Alibaba labs,
  // all available on a genuine free tier. Llama is listed last because Groq
  // gates it behind a paid plan.
  const models = [
    { key: 'gemini-3.5-flash', label: 'Gemini 3.5', activeColor: 'bg-blue-500/10 text-cat-blue border-blue-500/25' },
    { key: 'gpt-oss-120b', label: 'GPT-OSS 120B', activeColor: 'bg-emerald-500/10 text-leaf border-emerald-500/25' },
    { key: 'qwen3.8-27b', label: 'Qwen3.8 27B', activeColor: 'bg-violet-500/10 text-cat-violet border-violet-500/25' },
    { key: 'gpt-oss-20b', label: 'GPT-OSS 20B', activeColor: 'bg-amber-500/10 text-warn border-amber-500/25' },
    { key: 'mistral-small', label: 'Mistral Small', activeColor: 'bg-sky-500/10 text-cat-indigo border-sky-500/25' },
    { key: 'deepseek-r1', label: 'DeepSeek R1', activeColor: 'bg-rose-500/10 text-rust border-rose-500/25' },
    { key: 'llama-3.3-70b', label: 'Llama 3.3 70B (paid)', activeColor: 'bg-amber-500/10 text-warn border-amber-500/25' },
  ];

  return (
    <div className="p-3 sm:p-4 bg-panel/80 backdrop-blur-sm border-t border-line/60 z-10 shrink-0">
      <form onSubmit={handleFormSubmit} className="max-w-4xl mx-auto space-y-2.5">
        {whoIsEditing && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-ember/5 rounded-lg border border-ember/10">
            <Users size={11} className="text-ember animate-pulse" />
            <span className="text-[13px] font-mono text-ember font-semibold animate-pulse">{whoIsEditing} is editing...</span>
          </div>
        )}

        {/* Model Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-mono uppercase tracking-widest text-faint mr-0.5 flex items-center gap-1 select-none font-bold"><Eye size={10} />Compare:</span>
          {models.map((mod) => {
            const isSelected = selectedModels.includes(mod.key);
            return (
              <button key={mod.key} type="button" onClick={() => toggleModel(mod.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${isSelected ? mod.activeColor : 'bg-panel-2/50 border-line/50 text-faint hover:text-sand hover:border-line-2'}`} title={mod.label}>
                {isSelected ? <CheckSquare size={11} className="text-current" /> : <Square size={11} className="text-faint" />}
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>

        {/* Input */}
        <div className="relative bg-panel/95 border border-line/60 rounded-xl overflow-hidden focus-within:border-ember/40 focus-within:shadow-[0_0_0_3px_rgba(79,70,229,0.08)] transition-all">
          <textarea rows={2} value={collaborativePromptText} onChange={handleInputChange} onKeyDown={handleKeyDown}
            placeholder="Type a prompt... Press Enter to compare AI agents."
            className="w-full bg-transparent px-4 py-3 text-[12px] text-cream placeholder-faint/60 focus:outline-none resize-none leading-relaxed min-h-[46px] scrollbar-none" />
          <div className="px-4 py-2 border-t border-line/40 bg-panel-2/30 flex items-center justify-between">
            <span className="text-[13px] text-faint font-mono hidden sm:flex items-center gap-1"><Zap size={9} className="text-ember/50" />Enter to send &middot; Shift+Enter new line</span>
            <button type="submit" disabled={!collaborativePromptText.trim()}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${collaborativePromptText.trim() ? 'bg-gradient-to-br from-ember to-ember-2 text-white shadow-md shadow-ember/20 active:scale-95' : 'bg-panel-2 text-faint cursor-not-allowed'}`}>
              <Send size={13} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
