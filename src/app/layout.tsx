import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TypstFlow - Visual Report Designer',
  description: 'Create premium PDF reports with Typst',
  icons: {
    icon: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans select-none">{children}</body>
    </html>
  );
}
