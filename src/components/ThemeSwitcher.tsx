import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { THEMES, type Theme } from '../stores/uiStore';
import { Sun, Moon, Sparkles, Check } from 'lucide-react';

const THEME_ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  nebula: Sparkles,
};

const POPOVER_WIDTH = 264;

interface Props {
  /** "icon" — bare icon button (sidebar header, admin rail). */
  /** "floating" — frosted round button for public-page corners. */
  /** "panel" — bordered header button, matches solid header controls. */
  variant?: 'icon' | 'floating' | 'panel';
  className?: string;
}

/**
 * Three-way appearance switcher (Linen / Obsidian / Nebula).
 * The picker is `position: fixed` and clamped to the viewport so it is never
 * clipped by an `overflow-hidden` parent such as the collapsed sidebar rail.
 */
export default function ThemeSwitcher({ variant = 'icon', className = '' }: Props) {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const CurrentIcon = THEME_ICONS[theme];

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    const top = Math.min(r.bottom + 8, window.innerHeight - 230);
    const left = Math.max(12, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 12));
    setPos({ top, left });
  }, [open]);

  // Close on Escape / viewport resize
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

  // Each variant owns its full box styling. Mixing padding/rounding overrides
  // in via `className` would collide with these and depend on Tailwind's
  // output order, so callers should not try to restyle a variant.
  const triggerClass =
    variant === 'floating'
      ? `flex items-center justify-center w-10 h-10 rounded-xl glass border border-line-2 shadow-lg text-sand hover:text-cream cursor-pointer transition-colors ${className}`
      : variant === 'panel'
        ? `flex items-center justify-center p-2.5 rounded-xl bg-panel/80 border border-line/60 text-sand hover:text-cream hover:border-line-2 transition-all cursor-pointer shrink-0 relative disabled:opacity-50 ${className}`
        : `p-2 rounded-lg text-sand hover:text-cream hover:bg-panel-2 transition-all cursor-pointer shrink-0 relative ${className}`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        title={`Appearance: ${THEMES.find((t) => t.id === theme)?.name} — click to change`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <CurrentIcon size={variant === 'floating' ? 17 : 16} />      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setOpen(false)} />

          <div
            className="fixed z-[160] w-[264px] bg-panel-2 border border-line-2 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="px-3.5 py-2.5 border-b border-line">
              <p className="text-[13px] font-mono font-bold uppercase tracking-widest text-faint">
                Appearance
              </p>
            </div>

            <div className="p-2 space-y-1">
              {THEMES.map((t) => {
                const isActive = t.id === theme;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTheme(t.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-ember/12 ring-1 ring-ember/30'
                        : 'hover:bg-line'
                    }`}
                  >
                    {/* 3-stripe swatch preview */}
                    <span
                      className="shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-line-2 flex"
                      title={t.name}
                    >
                      {t.swatch.map((c, i) => (
                        <span key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
                      ))}
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-cream">{t.name}</span>
                      <span className="block text-[13px] text-faint truncate">{t.blurb}</span>
                    </span>

                    {isActive && <Check size={14} className="shrink-0 text-ember" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
