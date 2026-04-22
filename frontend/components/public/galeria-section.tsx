'use client'

import { motion } from 'framer-motion'

const GALLERY_ITEMS = [
  { src: '/images/galeria-1.jpg', alt: 'Modelando fuerza - Charla - Taller', span: 'col-span-2' },
  { src: '/images/galeria-2.jpg', alt: 'Entrega de canastas alimentarias a familias', span: '' },
  { src: '/images/galeria-3.jpg', alt: 'Entrega de despensa a escuelas', span: '' },
  { src: '/images/galeria-4.jpg', alt: 'Ayuda a personas con discapacidad', span: '' },
  { src: '/images/galeria-5.jpg', alt: 'Banderazo de arranque de los programas alimentarios', span: '' },
]

export function GaleriaSection() {
  return (
    <section id="galeria" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="text-primary text-sm font-bold uppercase tracking-widest mb-3 block">
            Galería
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-foreground text-balance">
            El trabajo{' '}
            <span className="text-primary">en los barrios.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
            Cada imagen es un testimonio de la presencia real y el compromiso con la gente de Cintalapa.
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-4 auto-rows-[200px]">
          {GALLERY_ITEMS.map(({ src, alt, span }, i) => (
            <motion.div
              key={src}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`relative rounded-2xl overflow-hidden group ${span}`}
            >
              <img
                src={src}
                alt={alt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-sidebar/0 group-hover:bg-sidebar/40 transition-all duration-300 flex items-end p-4">
                <span className="text-white text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {alt}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
