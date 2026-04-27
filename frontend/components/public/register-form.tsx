'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Phone, User, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export function RegisterForm() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    barrio: '',
    interests: [] as string[],
  });
  const [touched, setTouched] = useState({ phone: false });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-accent" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">¡Tu voz fue registrada!</h3>
        <p className="text-muted-foreground max-w-xs leading-relaxed">
          Gracias, <strong>{form.name}</strong>. Tu voz de <strong>{form.barrio}</strong> ya es
          parte de Voz Ciudadana. Te contactaremos pronto.
        </p>
      </motion.div>
    );
  }

  return (
    <section id="registro" className="py-20 px-6 bg-background">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-3 block">
            Formulario de Registro
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground text-balance">
            Registra tu Voz
          </h2>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Es gratuito, seguro y solo toma 2 minutos. Tu voz de Cintalapa importa.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6"
        >
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground font-medium">
              Nombre completo
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="Tu nombre y apellido"
                className="pl-10"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Phone / WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground font-medium">
              WhatsApp / Teléfono celular
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="10 dígitos"
                className={cn(
                  'pl-10 transition-colors',
                  phoneError && 'border-destructive focus-visible:ring-destructive/50',
                  !phoneError &&
                    touched.phone &&
                    phoneValid &&
                    'border-accent focus-visible:ring-accent/50',
                )}
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                maxLength={10}
                required
              />
              {!phoneError && touched.phone && phoneValid && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
              )}
            </div>
            {phoneError && (
              <p className="text-destructive text-xs">Ingresa un número de 10 dígitos válido.</p>
            )}
          </div>

          {/* Barrio de Cintalapa */}
          <div className="space-y-2">
            <Label htmlFor="barrio" className="text-foreground font-medium">
              Barrio de Cintalapa
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Select onValueChange={(val) => setForm((p) => ({ ...p, barrio: val }))}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Selecciona tu barrio" />
                </SelectTrigger>
                <SelectContent>
                  {BARRIOS_CINTALAPA.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Interests */}
          <div className="space-y-3">
            <Label className="text-foreground font-medium">
              Temas que te importan{' '}
              <span className="text-muted-foreground font-normal text-xs">
                (Selecciona todos los que apliquen)
              </span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {INTERESES.map(({ id, label }) => (
                <label
                  key={id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150',
                    form.interests.includes(id)
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border hover:border-primary/50 text-muted-foreground',
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={form.interests.includes(id)}
                    onCheckedChange={() => toggleInterest(id)}
                    className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground text-base"
            disabled={!form.name || !phoneValid || !form.barrio || loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registrando tu voz...
              </>
            ) : (
              'Registrar mi Voz'
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Al registrarte, aceptas que tu información sea usada exclusivamente para fines de
            representación ciudadana y gobernanza municipal en Cintalapa de Figueroa, Chiapas.
          </p>
        </motion.form>
      </div>
    </section>
  );
}
