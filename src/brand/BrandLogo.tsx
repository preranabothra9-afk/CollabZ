import React from 'react';

/**
 * CollabZ Brand Logo Components
 * 
 * Inline SVG logo components for zero-latency rendering and full CSS control.
 * Three variants: Full (logo + text), Icon (mark only), Compact (small sidebar).
 */

interface LogoProps {
  className?: string;
  size?: number;
}

/** CollabZ neural mark — the icon symbol used across all logo variants */
function SynapseMark({ size = 36, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 36"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="s-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id="s-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#4338ca" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#s-bg)" />
      <rect width="36" height="36" rx="10" stroke="url(#s-grad)" strokeWidth="0.75" opacity="0.4" />
      <path d="M10 26 L18 8 L26 26" stroke="url(#s-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M10 26 L26 26" stroke="url(#s-grad)" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <path d="M13 17 Q18 21 23 17" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.65" />
      <path d="M11.5 22 Q18 26 24.5 22" stroke="#4338ca" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.45" />
      <circle cx="18" cy="8" r="3" fill="url(#s-grad)" />
      <circle cx="10" cy="26" r="2.5" fill="#6366f1" />
      <circle cx="26" cy="26" r="2.5" fill="#4338ca" />
      <circle cx="18" cy="8" r="1.2" fill="white" opacity="0.95" />
      <circle cx="10" cy="26" r="1" fill="white" opacity="0.85" />
      <circle cx="26" cy="26" r="1" fill="white" opacity="0.85" />
    </svg>
  );
}

/** Full logo — icon mark + "CollabZ" wordmark + subtitle */
export function BrandLogoFull({ subtitle = 'Multi-Agent Sandbox' }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <SynapseMark size={34} />
      <div>
        <h1 className="font-bold text-cream tracking-tight leading-none text-sm">
          Collab<span className="text-ember">Z</span>
        </h1>
        <span className="text-[13px] text-ember-soft font-mono tracking-wider uppercase font-semibold">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

/** Icon-only logo — compact mark for collapsed spaces or small surfaces */
export function BrandLogoIcon({ size = 32 }: { size?: number }) {
  return <SynapseMark size={size} />;
}

/** Compact logo — icon + brand name only, no subtitle */
export function BrandLogoCompact() {
  return (
    <div className="flex items-center gap-2 select-none">
      <SynapseMark size={28} />
      <span className="font-bold text-cream tracking-tight text-[13px]">
        Collab<span className="text-ember">Z</span>
      </span>
    </div>
  );
}

/** Animated loader logo — pulsing neural synapse for loading states */
export function BrandLoader() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse ring */}
      <div className="absolute w-16 h-16 rounded-full border border-ember/25 animate-ping" style={{ animationDuration: '2s' }} />
      <div className="absolute w-14 h-14 rounded-full border border-ember-2/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
      {/* Core icon with glow */}
      <div className="relative">
        <div className="absolute inset-0 blur-lg opacity-40">
          <SynapseMark size={48} />
        </div>
        <SynapseMark size={48} />
      </div>
    </div>
  );
}

export { SynapseMark };
