'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, User, Phone, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const BARRIOS_CINTALAPA = [
  'Centro',
  'La Candelaria',
  'Santo Domingo',
  'El Mirador',
  'Los Ángeles',
  'La Joya',
  'San Sebastián',
  'Barrio Nuevo',
  'Colonia Morelos',
  'La Esperanza',
  'Ejido Cintalapa',
  'Otro',
];

const INTERESES = [
  { id: 'agua', label: 'Agua Potable' },
  { id: 'seguridad', label: 'Seguridad Pública' },
  { id: 'campo', label: 'Campo y Agricultura' },
  { id: 'salud', label: 'Salud' },
  { id: 'educacion', label: 'Educación' },
  { id: 'empleo', label: 'Empleo y Economía' },
];

function validatePhone(phone: string) {
  return /^[0-9]{10}$/.test(phone.replace(/\s/g, ''));
}

export function SumateSection() {
  const [form, setForm] = useState({ name: '', phone: '', barrio: '', interests: [] as string[] });
  const [touched, setTouched] = useState({ phone: false });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const phoneValid = validatePhone(form.phone);
  const phoneError = touched.phone && form.phone.length > 0 && !phoneValid;

  function toggleInterest(id: string) {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter((i) => i !== id)
        : [...prev.interests, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !phoneValid || !form.barrio) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1400));
    setLoading(false);
    setDone(true);
  }

  return (
    <section id="sumate" className="relative py-24 px-6 overflow-hidden bg-sidebar">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="md:sticky md:top-24"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Check className="w-5 h-5 text-white stroke-[3]" />
              </div>
              <div>
                <div className="text-white font-black text-xl leading-none">Voz Ciudadana</div>
                <div className="text-white/50 text-xs font-semibold uppercase tracking-widest">
                  Cintalapa de Figueroa, Chiapas
                </div>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight text-balance mb-6">
              Tu voz transforma <span className="text-primary-light">Cintalapa.</span>
            </h2>
            <p className="text-white/60 leading-relaxed mb-8 text-pretty">
              Únete al movimiento ciudadano más importante de Cintalapa de Figueroa. Recibe
              información directa sobre propuestas, eventos en tu barrio y la oportunidad de ser
              parte activa del cambio que Chiapas necesita.
            </p>

            <div className="space-y-3">
              {[
                'Información directa sobre eventos en tu barrio',
                'Acceso a propuestas y avances del gobierno municipal',
                'Participa en decisiones que afectan a Cintalapa',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary-light stroke-[3]" />
                  </div>
                  <span className="text-white/70 text-sm leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — full registration form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            {done ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl p-10 text-center shadow-2xl"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-black text-foreground mb-2">
                  ¡Tu voz fue registrada!
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Gracias, <strong>{form.name}</strong>. Tu voz de <strong>{form.barrio}</strong> ya
                  es parte de Voz Ciudadana. Te contactaremos pronto.
                </p>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl p-8 shadow-2xl space-y-5"
              >
                <div className="text-center mb-1">
                  <h3 className="text-xl font-black text-foreground">Registra tu Voz</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Gratuito · Seguro · 2 minutos
                  </p>
                </div>

                {/* Name */}
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Phone / WhatsApp */}
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="WhatsApp (10 dígitos)"
                    required
                    maxLength={10}
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))
                    }
                    onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                    className={cn(
                      'w-full pl-10 pr-9 py-3.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors',
                      phoneError
                        ? 'border-destructive focus:ring-destructive/30 focus:border-destructive'
                        : touched.phone && phoneValid
                          ? 'border-accent focus:ring-accent/30 focus:border-accent'
                          : 'border-border focus:ring-primary/30 focus:border-primary',
                    )}
                  />
                  {touched.phone && phoneValid && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                  )}
                  {phoneError && (
                    <p className="text-destructive text-xs mt-1 pl-1">
                      Ingresa un número de 10 dígitos válido.
                    </p>
                  )}
                </div>

                {/* Barrio select */}
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <select
                    required
                    value={form.barrio}
                    onChange={(e) => setForm((p) => ({ ...p, barrio: e.target.value }))}
                    className={cn(
                      'w-full pl-10 pr-4 py-3.5 border border-border rounded-xl text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
                      !form.barrio && 'text-muted-foreground',
                    )}
                  >
                    <option value="" disabled>
                      Barrio de Cintalapa
                    </option>
                    {BARRIOS_CINTALAPA.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Interests */}
                <div className="space-y-2.5">
                  <p className="text-sm font-semibold text-foreground">
                    Temas que te importan{' '}
                    <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {INTERESES.map(({ id, label }) => (
                      <label
                        key={id}
                        className={cn(
                          'flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all duration-150 text-sm',
                          form.interests.includes(id)
                            ? 'border-primary bg-primary/5 text-foreground font-medium'
                            : 'border-border hover:border-primary/40 text-muted-foreground',
                        )}
                      >
                        <Checkbox
                          id={id}
                          checked={form.interests.includes(id)}
                          onCheckedChange={() => toggleInterest(id)}
                          className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary flex-shrink-0"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !form.name || !phoneValid || !form.barrio}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-base py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5 stroke-[3]" />
                      Registrar mi Voz
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  Tu información es confidencial y solo se usa para fines de representación
                  ciudadana en Cintalapa de Figueroa, Chiapas.
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
