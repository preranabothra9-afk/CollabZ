import { useStore } from '../store';
import { X, Copy, Trash2, ClipboardCheck, Bookmark } from 'lucide-react';
import React, { useState } from 'react';

export default function SavedResponses() {
  // Selectors: this drawer stays mounted while models stream, so a whole-store
  // subscription would re-render it on every token.
  const savedResponses = useStore((s) => s.savedResponses);
  const deleteSavedResponse = useStore((s) => s.deleteSavedResponse);
  const isSavedResponsesOpen = useStore((s) => s.isSavedResponsesOpen);
  const setSavedResponsesOpen = useStore((s) => s.setSavedResponsesOpen);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (!isSavedResponsesOpen) return null;

  return (
    <div className="w-full bg-panel/90 backdrop-blur-sm flex flex-col h-full z-10 text-sand">
      {/* Header */}
      <div className="p-4 border-b border-line/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark size={13} className="text-ember" />
            <h2 className="font-semibold text-cream text-[12px]">Pinned</h2>
            <span className="text-[13px] text-faint font-mono bg-panel-2/60 px-1.5 py-0.5 rounded">{savedResponses.length}</span>
          </div>
          <button type="button" onClick={() => setSavedResponsesOpen(false)} className="p-1.5 hover:bg-panel-2 rounded-lg hover:text-cream transition-all cursor-pointer text-faint"><X size={14} /></button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {savedResponses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-faint">
            <Bookmark size={20} className="text-faint/40 mb-3" />
            <p className="text-[14px] font-semibold text-sand">No pinned responses</p>
            <p className="text-[13px] text-faint mt-1 px-4">Bookmark AI responses from chat to access them here.</p>
          </div>
        ) : (
          savedResponses.map((item) => (
            <div key={item.id} className="bg-panel-2/50 border border-line/50 rounded-xl p-3 space-y-2 transition-all hover:border-line-2 group/card">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-mono font-semibold bg-ember/10 text-ember-soft px-2 py-0.5 rounded-md border border-ember/15 uppercase">{item.modelName}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <button type="button" onClick={() => handleCopy(item.responseContent, item.id)} className="p-1 hover:bg-line/60 rounded-md hover:text-cream transition-all cursor-pointer text-faint">
                    {copiedId === item.id ? <ClipboardCheck size={10} className="text-leaf" /> : <Copy size={10} />}
                  </button>
                  <button type="button" onClick={() => deleteSavedResponse(item.id)} className="p-1 hover:bg-rust/10 rounded-md hover:text-rust transition-all cursor-pointer text-faint"><Trash2 size={10} /></button>
                </div>
              </div>
              <div className="bg-ink/40 p-2 rounded-lg border border-line/30 text-[13px] italic text-faint truncate">"{item.prompt}"</div>
              <div className="text-[13px] text-cream/80 leading-relaxed whitespace-pre-wrap max-h-28 overflow-y-auto">{item.responseContent}</div>
              <div className="text-[12px] text-faint font-mono">{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
