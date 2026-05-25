'use client';

// Blocking theme script: runs synchronously before any CSS or React paint.
// Reads theme & accent from localStorage (mirrored by setTheme/setPrimaryColor)
// so the very first pixel is already correct — no FOUC on reload.
// Falls back to app defaults when localStorage is empty (first-ever load).
const THEME_INIT_SCRIPT =
  '(function(){try{' +
  "var t=localStorage.getItem('typstflow-theme')||'dark';" +
  "var c=localStorage.getItem('typstflow-primary-color')||'#8B5CF6';" +
  'document.documentElement.classList.add(t);' +
  "document.documentElement.style.setProperty('--accent',c);" +
  "document.documentElement.style.setProperty('--accent-glow',c.startsWith('#')?c+'15':'rgba(139,92,246,0.15)');" +
  '}catch(e){}})();';

const themeInitHtml = { __html: THEME_INIT_SCRIPT };

export function ThemeInitScript() {
  // SSR emits the script into <head>; the browser runs it once before hydration.
  // Skip client render so React 19 does not warn about <script> in components.
  if (typeof window !== 'undefined') {
    return null;
  }

  return <script id="theme-init" dangerouslySetInnerHTML={themeInitHtml} />;
}
