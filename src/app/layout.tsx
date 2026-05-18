import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TypstFlow - Visual Report Designer',
  description: 'Create premium PDF reports with Typst',
  icons: {
    icon: '/icon.png',
  },
};

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Static inline script, no user-supplied data
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans select-none">{children}</body>
    </html>
  );
}
