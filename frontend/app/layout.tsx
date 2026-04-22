import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'Voz Ciudadana — Cintalapa tiene voz de mujer',
  description:
    'Plataforma oficial de gobernanza municipal de Cintalapa de Figueroa, Chiapas. Nací aquí, crecí aquí, y juntas haremos historia.',
  keywords: ['Voz Ciudadana', 'Cintalapa', 'Chiapas', 'gobernanza municipal', 'candidata mujer'],
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="bg-background">
      <body className={`${montserrat.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
