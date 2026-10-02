import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, type SearchResult } from '../store';
import { Search, X, Loader2, CornerDownRight } from 'lucide-react';
import Portal from '../hooks/Portal';

const PANEL_WIDTH = 380;

/**
 * Searches a room's prompts and model responses. Results are compact hits;
 * clicking one pages history in until the message is present, then scrolls to
 * it with a highlight ring (see ChatArea).
 */
export default function SearchPanel() {
  // Selectors keep this from re-rendering on every stream chunk.
  const activeConversation = useStore((s) => s.activeConversation);
  const searchHistory = useStore((s) => s.searchHistory);
  const jumpToMessage = useStore((s) => s.jumpToMessage);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const disabled = !activeConversation;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    const top = Math.min(r.bottom + 8, window.innerHeight - 340);
    const left = Math.max(12, Math.min(r.left, window.innerWidth - PANEL_WIDTH - 12));
    setPos({ top, left });
  }, [open]);

  // Focus the input on open
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Reset state when switching rooms
  useEffect(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, [activeConversation?.id]);

  // Debounced search execution
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      if (!activeConversation) return;
      const r = await searchHistory(activeConversation.id, q);
      setResults(r);
      setLoading(false);
    }, 280);
    return () => clearTimeout(t);
  }, [query, open, activeConversation?.id, searchHistory]);

  // Close on Escape / resize
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onResize = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const handlePick = (r: SearchResult) => {
    setOpen(false);
    jumpToMessage(r.id, r.createdAt);
  };

  const trimmed = query.trim();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border bg-panel-2 border-line text-sand hover:text-cream hover:border-line-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title={disabled ? 'Select a room to search' : 'Search this room'}
      >
        <Search size={13} />
        <span className="hidden sm:inline">Search</span>
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[150]" onClick={() => setOpen(false)} />

          <div
            className="fixed z-[160] bg-panel-2 border border-line-2 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col"
            style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH, maxHeight: 'min(60vh, 460px)' }}
          >
            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line">
              <Search size={14} className="text-faint shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search prompts and responses…"
                className="flex-1 min-w-0 bg-transparent text-sm text-cream placeholder-faint focus:outline-none"
              />
              {loading && <Loader2 size={13} className="animate-spin text-faint shrink-0" />}
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                  className="p-0.5 rounded text-faint hover:text-cream cursor-pointer shrink-0"
                  title="Clear"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2">
              {trimmed.length < 2 && (
                <p className="text-xs text-faint text-center py-6 px-4 leading-relaxed">
                  Type at least 2 characters to search this room's history.
                </p>
              )}

              {trimmed.length >= 2 && !loading && results.length === 0 && !error && (
                <p className="text-xs text-faint text-center py-6 px-4">
                  No matches for “<span className="text-sand">{trimmed}</span>”.
                </p>
              )}

              {error && (
                <p className="text-xs text-rust text-center py-6 px-4">{error}</p>
              )}

              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handlePick(r)}
                  className="w-full text-left px-2.5 py-2.5 rounded-xl hover:bg-line transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-faint shrink-0">
                      {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-ember/10 border border-ember/20 text-ember-soft shrink-0">
                      {r.matchedIn}
                    </span>
                    <CornerDownRight size={11} className="text-faint ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <p className="text-xs font-semibold text-cream line-clamp-1">{r.promptText}</p>
                  <p className="text-[11px] text-sand line-clamp-2 mt-0.5 leading-relaxed">{r.snippet}</p>
                </button>
              ))}
            </div>

            {results.length > 0 && (
              <div className="px-3 py-2 border-t border-line">
                <p className="text-[10px] font-mono text-faint">
                  {results.length} match{results.length === 1 ? '' : 'es'} — click to jump
                </p>
              </div>
            )}
          </div>
        </Portal>
      )}
    </>
  );
}
