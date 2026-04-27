'use client';

import { motion } from 'framer-motion';

const TEAM = [
  {
    name: 'Cintalapaneca de Corazón',
    role: 'Candidata Municipal — Voz Ciudadana',
    img: '/images/team-candidata.jpg',
    featured: true,
  },
  {
    name: 'Rosa Pérez Domínguez',
    role: 'Coordinadora de Campaña',
    img: '/images/team-1.jpg',
  },
  {
    name: 'Marisol Ruiz Flores',
    role: 'Propuestas y Programa de Gobierno',
    img: '/images/team-2.jpg',
  },
  {
    name: 'Guadalupe Torres Méndez',
    role: 'Comunicación Social',
    img: '/images/team-3.jpg',
  },
  {
    name: 'Fernanda Cruz Aguilar',
    role: 'Vinculación Ciudadana',
    img: '/images/team-4.jpg',
  },
];

export function TeamSection() {
  return (
    <section id="equipo" className="py-24 px-6 bg-muted">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="text-primary text-sm font-bold uppercase tracking-widest mb-3 block">
            Nuestro Equipo
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-foreground text-balance">
            Mujeres de Cintalapa <span className="text-primary">liderando el cambio.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
            Un equipo construido sobre convicción, preparación y amor profundo por Cintalapa de
            Figueroa.
          </p>
        </motion.div>

        <div className="flex flex-col md:flex-row gap-6 items-start justify-center">
          {/* Featured candidate card */}
          {TEAM.filter((t) => t.featured).map(({ name, role, img }) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative w-full md:w-64 rounded-2xl overflow-hidden shadow-lg group shrink-0"
            >
              <div className="aspect-3/4">
                <img
                  src={img}
                  alt={name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-sidebar via-sidebar/80 to-transparent p-6">
                <div className="inline-block bg-primary text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded mb-2">
                  Candidata
                </div>
                <h3 className="text-white font-black text-lg leading-tight">{name}</h3>
                <p className="text-white/60 text-sm">{role}</p>
              </div>
            </motion.div>
          ))}

          {/* Team grid */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {TEAM.filter((t) => !t.featured).map(({ name, role, img }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl overflow-hidden bg-white border border-border group shadow-sm"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={img}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-black text-foreground text-sm leading-tight">{name}</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">{role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
