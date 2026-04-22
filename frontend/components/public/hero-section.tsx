'use client'

import { motion } from 'framer-motion'
import { Check, ChevronDown, MessageCircle } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-end overflow-hidden bg-sidebar">
      {/* Candidate photo background */}
      <div className="absolute inset-0">
        <img
          src="/images/candidata-hero.jpg"
          alt="Candidata junto a la comunidad en el Parque Central de Cintalapa"
          className="w-full h-full object-cover object-top"
        />
        {/* Gradient overlay — guinda at bottom, dark at top */}
        <div className="absolute inset-0 bg-linear-to-t from-sidebar via-sidebar/70 to-sidebar/20" />
        <div className="absolute inset-0 bg-linear-to-r from-sidebar/60 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-24 pt-32">
        <div className="max-w-2xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-primary/30 border border-primary/50 rounded-full px-4 py-1.5 mb-6"
          >
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-white stroke-3" />
            </div>
            <span className="text-white/90 text-sm font-semibold tracking-wide">
              Voz Ciudadana · Cintalapa de Figueroa, Chiapas
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-5xl md:text-7xl font-black text-white leading-[1.05] text-balance mb-6"
          >
            Cintalapa tiene{' '}
            <span className="text-primary-light">voz de mujer.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-lg text-white/70 leading-relaxed mb-10 max-w-lg text-pretty"
          >
            Nací aquí, crecí aquí, y juntas haremos historia. Con Voz Ciudadana,
            cada familia de Cintalapa tendrá agua, seguridad y un campo próspero.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            {/* WhatsApp CTA */}
            <a
              href="https://wa.me/5551468932?text=Hola%2C+quiero+sumarme+a+Voz+Ciudadana"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-base px-8 py-3.5 rounded-full transition-colors shadow-lg shadow-green-700/30"
            >
              <MessageCircle className="w-5 h-5" />
              Súmate a la Voz Ciudadana
            </a>
            <a
              href="#propuestas"
              className="inline-flex items-center justify-center text-white/80 hover:text-white font-semibold text-base px-8 py-3.5 rounded-full border border-white/30 hover:border-white/60 transition-colors"
            >
              Ver propuestas
            </a>
          </motion.div>

          {/* Trust row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-wrap gap-x-8 gap-y-2 mt-12"
          >
            {[
              'Cintalapa de Figueroa',
              'Barrios y colonias unidas',
              'Escucha directa',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-white/50 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-light" />
                {item}
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Floating WhatsApp button */}
      <motion.a
        href="https://wa.me/5551468932?text=Hola%2C+quiero+sumarme+a+Voz+Ciudadana"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring' }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-xl shadow-green-700/40 transition-colors"
        aria-label="Contactar por WhatsApp"
      >
        <MessageCircle className="w-5 h-5 shrink-0" />
        <span className="hidden sm:inline">Súmate por WhatsApp</span>
      </motion.a>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30"
      >
        <span className="text-[10px] tracking-widest uppercase font-semibold">Conocer más</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </motion.div>
    </section>
  )
}
