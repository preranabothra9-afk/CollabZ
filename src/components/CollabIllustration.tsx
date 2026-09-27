/**
 * CollabZ — "shared mind" illustration.
 *
 * Replaces the blurred mesh-orb backgrounds with a single flat, warm drawing:
 * one workspace card with three model nodes wired into it, plus a pinned
 * insight. Colours are theme tokens so it repaints with Linen/Obsidian/Nebula.
 */
export function CollabIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 340"
      fill="none"
      className={className}
      role="img"
      aria-label="Three AI models connected to one shared workspace"
    >
      {/* soft warm ground shapes — flat, no blur */}
      <circle cx="210" cy="178" r="136" fill="var(--color-ember)" opacity="0.06" />
      <circle cx="86" cy="92" r="52" fill="var(--color-leaf)" opacity="0.09" />
      <circle cx="346" cy="108" r="44" fill="var(--color-ember-soft)" opacity="0.12" />

      {/* connectors: models → workspace */}
      <g stroke="var(--color-line-2)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 9">
        <path d="M96 152 C118 152 116 180 130 184" />
        <path d="M324 152 C302 152 304 180 290 184" />
        <path d="M210 86 C210 106 210 112 210 130" />
        <path d="M210 272 C210 252 210 248 210 250" />
      </g>

      {/* ── workspace card ──────────────────────────────────────── */}
      <rect
        x="130" y="130" width="160" height="120" rx="26"
        fill="var(--color-panel)" stroke="var(--color-line-2)" strokeWidth="2.5"
      />
      <rect x="152" y="156" width="72" height="11" rx="5.5" fill="var(--color-cream)" opacity="0.82" />
      <rect x="152" y="176" width="116" height="8" rx="4" fill="var(--color-faint)" opacity="0.5" />
      <rect x="152" y="192" width="92" height="8" rx="4" fill="var(--color-faint)" opacity="0.38" />
      <rect x="152" y="214" width="58" height="18" rx="9" fill="var(--color-ember)" opacity="0.16" />
      <rect x="160" y="221" width="42" height="4" rx="2" fill="var(--color-ember)" opacity="0.7" />

      {/* live dot on the card */}
      <circle cx="266" cy="150" r="7" fill="var(--color-leaf)" />
      <circle cx="266" cy="150" r="12" fill="var(--color-leaf)" opacity="0.22" />

      {/* ── model nodes ─────────────────────────────────────────── */}
      <g>
        <circle cx="62" cy="152" r="34" fill="var(--color-panel)" stroke="var(--color-ember)" strokeWidth="2.5" />
        <path d="M62 138 L70 163 L54 163 Z" fill="var(--color-ember)" opacity="0.85" />
      </g>
      <g>
        <circle cx="358" cy="152" r="34" fill="var(--color-panel)" stroke="var(--color-ember-soft)" strokeWidth="2.5" />
        <rect x="344" y="144" width="28" height="6" rx="3" fill="var(--color-ember-soft)" opacity="0.85" />
        <rect x="344" y="156" width="18" height="6" rx="3" fill="var(--color-ember-soft)" opacity="0.5" />
      </g>
      <g>
        <circle cx="210" cy="56" r="30" fill="var(--color-panel)" stroke="var(--color-leaf)" strokeWidth="2.5" />
        <circle cx="210" cy="56" r="9" fill="var(--color-leaf)" opacity="0.85" />
        <circle cx="210" cy="56" r="15" fill="none" stroke="var(--color-leaf)" strokeWidth="2" opacity="0.45" />
      </g>

      {/* pinned insight card, bottom right */}
      <g>
        <rect
          x="286" y="272" width="106" height="50" rx="16"
          fill="var(--color-panel)" stroke="var(--color-line)" strokeWidth="2"
        />
        <circle cx="306" cy="288" r="5" fill="var(--color-ember)" />
        <rect x="317" y="285" width="58" height="6" rx="3" fill="var(--color-cream)" opacity="0.6" />
        <rect x="302" y="302" width="74" height="6" rx="3" fill="var(--color-faint)" opacity="0.4" />
      </g>

      {/* small caption card, bottom left */}
      <g>
        <rect
          x="30" y="268" width="92" height="44" rx="15"
          fill="var(--color-panel)" stroke="var(--color-line)" strokeWidth="2"
        />
        <rect x="46" y="282" width="46" height="6" rx="3" fill="var(--color-cream)" opacity="0.5" />
        <rect x="46" y="294" width="60" height="6" rx="3" fill="var(--color-faint)" opacity="0.35" />
      </g>

      {/* grounded shadow */}
      <ellipse cx="210" cy="332" rx="118" ry="9" fill="var(--color-ember)" opacity="0.05" />
    </svg>
  );
}

export default CollabIllustration;
