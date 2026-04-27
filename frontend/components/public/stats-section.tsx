'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Users, MessageSquare, CheckCircle, MapPin } from 'lucide-react';

const STATS = [
  {
    icon: Users,
    value: 24850,
    label: 'Ciudadanos registrados',
    suffix: '+',
  },
  {
    icon: MessageSquare,
    value: 8320,
    label: 'Problemas reportados',
    suffix: '',
  },
  {
    icon: CheckCircle,
    value: 3140,
    label: 'Casos resueltos',
    suffix: '',
  },
  {
    icon: MapPin,
    value: 47,
    label: 'Colonias activas',
    suffix: '',
  },
];

function useCountUp(target: number, duration = 2000, active: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, active]);

  return count;
}

function StatCard({
  icon: Icon,
  value,
  label,
  suffix,
  index,
}: (typeof STATS)[0] & { index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const count = useCountUp(value, 2000, inView);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex flex-col items-center text-center p-8 bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div className="text-4xl font-bold text-foreground tabular-nums">
        {count.toLocaleString('es-MX')}
        {suffix}
      </div>
      <div className="text-muted-foreground text-sm mt-2 leading-relaxed">{label}</div>
    </motion.div>
  );
}

export function StatsSection() {
  return (
    <section className="py-20 px-6 bg-sidebar">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="text-primary-light text-sm font-semibold uppercase tracking-widest mb-3 block">
            Estadísticas de Escucha
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-sidebar-foreground text-balance">
            Miles de voces, un solo proyecto
          </h2>
          <p className="text-sidebar-foreground/50 mt-3 max-w-lg mx-auto leading-relaxed">
            Cada registro, cada reporte y cada solución forma parte de un registro histórico de
            participación ciudadana.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} {...stat} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
