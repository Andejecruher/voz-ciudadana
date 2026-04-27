'use client';

import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

export function VisionSection() {
  return (
    <section className="py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Photo */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden aspect-4/5 max-w-md mx-auto">
              <img
                src="/images/candidata-vision.jpg"
                alt="Candidata escuchando a la comunidad en Cintalapa"
                className="w-full h-full object-cover"
              />
              {/* Decorative guinda border accent */}
              <div className="absolute inset-0 ring-1 ring-primary/20 rounded-2xl" />
            </div>
            {/* Floating stat card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="absolute -bottom-6 -right-4 md:right-0 bg-primary rounded-2xl px-6 py-4 shadow-xl shadow-primary/30"
            >
              <div className="text-3xl font-black text-white">Raíz</div>
              <div className="text-white/70 text-sm font-medium">cintalapaneca de corazón</div>
            </motion.div>
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="pt-8 md:pt-0"
          >
            <span className="text-primary text-sm font-bold uppercase tracking-widest mb-4 block">
              Nuestra visión para Cintalapa
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-foreground leading-tight text-balance mb-8">
              Un compromiso <span className="text-primary">desde la raíz.</span>
            </h2>

            {/* Quote block */}
            <div className="relative bg-muted rounded-2xl p-8 mb-8">
              <Quote className="absolute top-4 left-4 w-8 h-8 text-primary/20" />
              <blockquote className="text-xl font-semibold text-foreground leading-relaxed italic pl-4">
                &ldquo;Soy una cintalapaneca de raíz. Mi compromiso con Voz Ciudadana es escucharte
                para transformar.&rdquo;
              </blockquote>
              <div className="mt-4 pl-4 flex items-center gap-3">
                <div className="w-8 h-0.5 bg-primary" />
                <span className="text-secondary font-bold text-sm uppercase tracking-wide">
                  Candidata — Cintalapa de Figueroa, Chiapas
                </span>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-6">
              Nacida y criada en Cintalapa de Figueroa, con una trayectoria forjada entre la gente y
              para la gente. Voz Ciudadana no son promesas vacías — es un compromiso en acción,
              construido escuchando directamente a cada barrio, a cada familia de nuestra tierra
              chiapaneca.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              {[
                { num: '12+', label: 'Barrios de Cintalapa' },
                { num: '100+', label: 'Asambleas populares' },
                { num: '5K+', label: 'Voces escuchadas' },
              ].map(({ num, label }) => (
                <div
                  key={label}
                  className="flex-1 text-center py-4 border border-border rounded-xl"
                >
                  <div className="text-2xl font-black text-primary">{num}</div>
                  <div className="text-xs text-muted-foreground font-medium mt-1">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
