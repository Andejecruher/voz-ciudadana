import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vozciudadana.mx'
const OG_IMAGE_URL = `${BASE_URL}/images/og-image.png`

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    template: '%s | Voz Ciudadana',
    default: 'Voz Ciudadana — Cintalapa tiene voz de mujer',
  },
  description:
    'Candidata de Cintalapa de Figueroa, Chiapas. Agua, seguridad y campo próspero para cada familia. Nací aquí, crecí aquí y juntas haremos historia.',
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
  authors: [{ name: 'Voz Ciudadana', url: BASE_URL }],
  creator: 'Voz Ciudadana',
  publisher: 'Voz Ciudadana',

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },

  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: BASE_URL,
    siteName: 'Voz Ciudadana',
    title: 'Voz Ciudadana — Cintalapa tiene voz de mujer',
    description:
      'Candidata de Cintalapa de Figueroa, Chiapas. Agua, seguridad y campo próspero para cada familia. Nací aquí, crecí aquí y juntas haremos historia.',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'Voz Ciudadana — Cintalapa de Figueroa, Chiapas',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Voz Ciudadana — Cintalapa tiene voz de mujer',
    description:
      'Candidata de Cintalapa de Figueroa, Chiapas. Agua, seguridad y campo próspero para cada familia.',
    images: [OG_IMAGE_URL],
  },

  alternates: {
    canonical: BASE_URL,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'PoliticalParty',
  name: 'Voz Ciudadana',
  url: BASE_URL,
  description:
    'Plataforma de campaña política para la candidata a presidenta municipal de Cintalapa de Figueroa, Chiapas. Participación ciudadana, propuestas de gobierno y agenda comunitaria.',
  areaServed: {
    '@type': 'AdministrativeArea',
    name: 'Cintalapa de Figueroa, Chiapas, México',
  },
  sameAs: [],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="bg-background" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#6B1A3A" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${montserrat.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
