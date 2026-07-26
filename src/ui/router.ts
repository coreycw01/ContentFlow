import { useEffect, useState } from 'react';

/** Minimal hash router — no dependency, no build weight. */
export function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const onChange = () => setRoute(window.location.hash.replace(/^#/, '') || '/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const navigate = (path: string) => {
  window.location.hash = path.startsWith('#') ? path.slice(1) : path;
};

/** Splits "/project/abc/script" into ["project", "abc", "script"]. */
export const segments = (route: string): string[] => route.split('/').filter(Boolean);
