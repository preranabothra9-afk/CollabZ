import { useEffect } from 'react';
import { PAGE_TITLES, DEFAULT_TITLE } from './brand.config';

/**
 * Dynamic page title hook.
 * 
 * Sets the document title based on the current route path.
 * Falls back to the default brand title if no mapping is found.
 * 
 * @param path - The current route path
 * @param customTitle - Optional override title for dynamic content
 */
export function usePageTitle(path: string, customTitle?: string) {
  useEffect(() => {
    if (customTitle) {
      document.title = customTitle;
    } else {
      document.title = PAGE_TITLES[path] || DEFAULT_TITLE;
    }
  }, [path, customTitle]);
}
