import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into `document.body`.
 *
 * Panels anchored to header buttons use `position: fixed` with viewport
 * coordinates, but the workspace header carries `backdrop-blur`, and
 * `backdrop-filter` turns it into a containing block for fixed descendants.
 * A fixed panel inside the header is then positioned relative to the header
 * instead of the viewport, so it is shifted by the header's offset and clipped
 * by its bounds. Portaling to the body escapes that containing block entirely.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
