'use client'

import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const NAV_LINKS = [
  { label: 'Propuestas', href: '#propuestas' },
  { label: 'Eventos', href: '#eventos' },
  { label: 'Galería', href: '#galeria' },
  { label: 'Equipo', href: '#equipo' },
]

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm' : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Check className="w-4 h-4 text-primary-foreground stroke-3" />
          </div>
          <div className="flex flex-col leading-none">
            <span
              className={cn(
                'font-black text-lg tracking-tight transition-colors',
                scrolled ? 'text-primary' : 'text-white'
              )}
            >
              Voz Ciudadana
            </span>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-widest transition-colors',
                scrolled ? 'text-muted-foreground' : 'text-white/70'
              )}
            >
              Cintalapa de Figueroa, Chiapas
            </span>
          </div>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className={cn(
                'text-sm font-semibold transition-colors hover:text-primary',
                scrolled ? 'text-secondary' : 'text-white/80'
              )}
            >
              {label}
            </a>
          ))}
          <a
            href="#sumate"
            className="bg-primary hover:bg-primary-hover text-white text-sm font-bold px-5 py-2 rounded-full transition-colors"
          >
            Súmate
          </a>
        </nav>

        {/* Mobile burger */}
        <button
          className={cn('md:hidden', scrolled ? 'text-foreground' : 'text-white')}
          onClick={() => setOpen((o) => !o)}
          aria-label="Menú"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-white border-t border-border px-6 py-4 space-y-3"
          >
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className="block text-secondary font-semibold py-1"
              >
                {label}
              </a>
            ))}
            <a
              href="#sumate"
              onClick={() => setOpen(false)}
              className="block w-full text-center bg-primary hover:bg-primary-hover text-white font-bold px-5 py-2 rounded-full mt-2"
            >
              Súmate a la Voz Ciudadana
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
