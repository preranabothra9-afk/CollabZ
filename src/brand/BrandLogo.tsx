import React from 'react';

/**
 * MindSync Brand Logo Components
 * 
 * Inline SVG logo components for zero-latency rendering and full CSS control.
 * Three variants: Full (logo + text), Icon (mark only), Compact (small sidebar).
 */

interface LogoProps {
  className?: string;
  size?: number;
}

/** MindSync mark — the "M" icon symbol used across all logo variants */
export function MindMark({ size = 36, className }: LogoProps) {
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
        <linearGradient id="ms-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id="ms-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#4338ca" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#ms-bg)" />
      <rect width="36" height="36" rx="10" stroke="url(#ms-grad)" strokeWidth="0.75" opacity="0.4" />
      {/* The "M" — two uprights joined by a central notch */}
      <path d="M10 27 L10 9 L18 20 L26 9 L26 27" stroke="url(#ms-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Baseline tying the two uprights together */}
      <path d="M10 27 L26 27" stroke="url(#ms-grad)" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      {/* Sync oscillation — the double-wave ripple beneath the mark */}
      <path d="M12.5 32 Q15.5 29.5 18 32 Q20.5 34.5 23.5 32" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
      {/* Node highlights at the three peaks */}
      <circle cx="18" cy="20" r="3" fill="url(#ms-grad)" />
      <circle cx="10" cy="9" r="2.5" fill="#6366f1" />
      <circle cx="26" cy="9" r="2.5" fill="#4338ca" />
      <circle cx="18" cy="20" r="1.2" fill="white" opacity="0.95" />
      <circle cx="10" cy="9" r="1" fill="white" opacity="0.85" />
      <circle cx="26" cy="9" r="1" fill="white" opacity="0.85" />
    </svg>
  );
}

/** Full logo — icon mark + "MindSync" wordmark + subtitle */
export function BrandLogoFull({ subtitle = 'Multi-Agent Sandbox' }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <MindMark size={34} />
      <div>
        <h1 className="font-bold text-cream tracking-tight leading-none text-sm">
          Mind<span className="text-ember">Sync</span>
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
  return <MindMark size={size} />;
}

/** Compact logo — icon + brand name only, no subtitle */
export function BrandLogoCompact() {
  return (
    <div className="flex items-center gap-2 select-none">
      <MindMark size={28} />
      <span className="font-bold text-cream tracking-tight text-[13px]">
        Mind<span className="text-ember">Sync</span>
      </span>
    </div>
  );
}

/** Animated loader logo — pulsing mark for loading states */
export function BrandLoader() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse ring */}
      <div className="absolute w-16 h-16 rounded-full border border-ember/25 animate-ping" style={{ animationDuration: '2s' }} />
      <div className="absolute w-14 h-14 rounded-full border border-ember-2/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
      {/* Core icon with glow */}
      <div className="relative">
        <div className="absolute inset-0 blur-lg opacity-40">
          <MindMark size={48} />
        </div>
        <MindMark size={48} />
      </div>
    </div>
  );
}
