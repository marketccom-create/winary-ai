import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WINARY AI — Investissez intelligemment',
  description: 'Achetez des bots IA générateurs de revenus. Parrainez vos amis. Retirez via Mobile Money MTN & Moov.',
  keywords: 'investissement, IA, bots, revenus, Mobile Money, Bénin, MTN MoMo, Moov Money',
  authors: [{ name: 'WINARY AI' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WINARY AI',
  },
  openGraph: {
    title: 'WINARY AI — Investissez intelligemment',
    description: 'La plateforme d\'investissement IA du Bénin',
    type: 'website',
    locale: 'fr_BJ',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1A56DB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
