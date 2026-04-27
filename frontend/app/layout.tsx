import { buildOpenGraph, buildTwitter, siteConfig } from '@/lib/seo';
import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.baseUrl),

  title: {
    template: '%s | Voz Ciudadana',
    default: siteConfig.defaultTitle,
  },
  description: siteConfig.defaultDescription,
  keywords: [
    'Voz Ciudadana',
    'Cintalapa de Figueroa',
    'Chiapas',
    'candidata mujer',
    'gobernanza municipal',
    'participación ciudadana',
    'campaña política Chiapas',
    'presidenta municipal',
  ],
  authors: [{ name: siteConfig.siteName, url: siteConfig.baseUrl }],
  creator: siteConfig.siteName,
  publisher: siteConfig.siteName,

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },

  openGraph: buildOpenGraph({
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
    path: '/',
  }),

  twitter: buildTwitter({
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
  }),

  alternates: {
    canonical: siteConfig.baseUrl,
  },

  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-dark-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },

  manifest: '/manifest.json',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'PoliticalParty',
  name: 'Voz Ciudadana',
  url: siteConfig.baseUrl,
  description:
    'Plataforma de campaña política para la candidata a presidenta municipal de Cintalapa de Figueroa, Chiapas. Participación ciudadana, propuestas de gobierno y agenda comunitaria.',
  areaServed: {
    '@type': 'AdministrativeArea',
    name: 'Cintalapa de Figueroa, Chiapas, México',
  },
  sameAs: [],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="bg-background" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#711B2C" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${montserrat.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
