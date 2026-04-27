'use client';

import { motion } from 'framer-motion';
import { Briefcase, Droplets, GraduationCap, HeartPulse, Home, Shield, Wheat } from 'lucide-react';

const PROPUESTAS = [
  {
    icon: Droplets,
    title: 'Voz por el Agua',
    desc: 'Garantizar agua potable limpia y continua en todos los barrios de Cintalapa, desde la Candelaria hasta Santo Domingo.',
    featured: true,
  },
  {
    icon: Shield,
    title: 'Voz por la Seguridad',
    desc: 'Más presencia comunitaria, alumbrado público en zonas de riesgo y coordinación vecinal para Cintalapa.',
    featured: true,
  },
  {
    icon: Wheat,
    title: 'Voz por el Campo',
    desc: 'Apoyo a productores agrícolas, precios justos para cosechas y acceso a créditos para el campo chiapaneco.',
    featured: true,
  },
  {
    icon: HeartPulse,
    title: 'Salud Cercana',
    desc: 'Clínicas comunitarias con médicos de planta, medicamentos gratuitos y brigadas de salud en cada colonia.',
  },
  {
    icon: GraduationCap,
    title: 'Educación de Calidad',
    desc: 'Becas escolares, computadoras e internet en escuelas públicas de Cintalapa para nuestros hijos.',
  },
  {
    icon: Briefcase,
    title: 'Empleo Local',
    desc: 'Apoyos a emprendedores de Cintalapa, microcréditos y ferias de empleo en el municipio.',
  },
  {
    icon: Home,
    title: 'Vivienda Digna',
    desc: 'Regularización de predios, apoyos para mejora de vivienda y urbanización en colonias periféricas.',
  },
];

export function PropuestasSection() {
  return (
    <section id="propuestas" className="py-24 px-6 bg-muted">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="text-primary text-sm font-bold uppercase tracking-widest mb-3 block">
            Nuestras Propuestas
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-foreground text-balance">
            Un programa de gobierno
            <br />
            <span className="text-primary">hecho con Cintalapa.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
            Cada propuesta nació de escuchar directamente a los barrios y comunidades de Cintalapa
            de Figueroa. Son compromisos reales, no promesas de campaña.
          </p>
        </motion.div>

        {/* Featured 3 */}
        <div className="grid sm:grid-cols-3 gap-6 mb-6">
          {PROPUESTAS.filter((p) => p.featured).map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white rounded-2xl p-7 border-2 border-primary/20 hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-5 transition-colors">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-black text-foreground text-lg mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Rest */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PROPUESTAS.filter((p) => !p.featured).map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="bg-white rounded-2xl p-6 border border-border hover:border-primary/40 hover:shadow-md transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-4 transition-colors">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-black text-foreground text-base mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
