'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Check, Clock, MapPin, Phone, User, X } from 'lucide-react'
import { useState } from 'react'

const EVENTOS = [
  {
    id: 'e1',
    fecha: 'Sáb 10 May',
    hora: '11:00 a.m.',
    titulo: 'Encuentro Ciudadano en La Candelaria',
    lugar: 'Parque Central, Barrio La Candelaria, Cintalapa',
    desc: 'Gran encuentro con la candidata en el corazón de La Candelaria. Presenta tus propuestas y escucha el plan de gobierno para tu barrio.',
    cupo: 'Aforo libre',
  },
  {
    id: 'e2',
    fecha: 'Dom 18 May',
    hora: '10:00 a.m.',
    titulo: 'Caminata por Santo Domingo',
    lugar: 'Barrio Santo Domingo, Cintalapa',
    desc: 'Recorrido de proximidad por las calles de Santo Domingo. La candidata estará presente para escuchar directamente las necesidades del barrio.',
    cupo: '300 lugares',
  },
  {
    id: 'e3',
    fecha: 'Vie 23 May',
    hora: '6:00 p.m.',
    titulo: 'Foro por el Agua — Colonia Centro',
    lugar: 'Salón Ejidal, Centro de Cintalapa',
    desc: 'Mesa de diálogo sobre el acceso al agua potable con expertos, vecinas y autoridades. Tu voz define las soluciones.',
    cupo: '150 lugares',
  },
  {
    id: 'e4',
    fecha: 'Sáb 31 May',
    hora: '9:00 a.m.',
    titulo: 'Jornada de Salud en El Mirador',
    lugar: 'Explanada Barrio El Mirador, Cintalapa',
    desc: 'Consultas médicas gratuitas, vacunación y talleres de salud comunitaria para toda la familia de Cintalapa.',
    cupo: 'Aforo libre',
  },
]

interface RegistroState {
  name: string
  phone: string
}

export function EventosSection() {
  const [selectedEvento, setSelectedEvento] = useState<string | null>(null)
  const [registro, setRegistro] = useState<RegistroState>({ name: '', phone: '' })
  const [registrados, setRegistrados] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const evento = EVENTOS.find((e) => e.id === selectedEvento)

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault()
    if (!registro.name || !registro.phone || !selectedEvento) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    setRegistrados((prev) => new Set([...prev, selectedEvento]))
    setSelectedEvento(null)
    setRegistro({ name: '', phone: '' })
  }

  return (
    <section id="eventos" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="text-primary text-sm font-bold uppercase tracking-widest mb-3 block">
            Próximos Encuentros
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-foreground text-balance">
            Estamos en tu barrio.
            <br />
            <span className="text-primary">Ven a conocernos.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
            La candidata visita personalmente cada comunidad de Cintalapa. Regístrate y asiste al encuentro más cercano a ti.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {EVENTOS.map(({ id, fecha, hora, titulo, lugar, desc, cupo }, i) => {
            const yaRegistrado = registrados.has(id)
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-muted rounded-2xl p-6 border border-border hover:border-primary/30 transition-all duration-200 flex gap-5"
              >
                {/* Date badge */}
                <div className="shrink-0 w-16 text-center">
                  <div className="bg-primary rounded-xl py-3 px-2">
                    <div className="text-white text-[10px] font-bold uppercase tracking-wider leading-tight">
                      {fecha.split(' ')[0]}
                    </div>
                    <div className="text-white text-2xl font-black leading-none mt-1">
                      {fecha.split(' ')[1]}
                    </div>
                    <div className="text-white/70 text-[10px] font-semibold uppercase">
                      {fecha.split(' ')[2]}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-foreground text-base mb-1">{titulo}</h3>
                  <div className="flex flex-col gap-1 mb-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {hora}
                      <span className="mx-1 text-border">·</span>
                      <span className="text-secondary font-semibold">{cupo}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{lugar}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">{desc}</p>
                  {yaRegistrado ? (
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                      <Check className="w-4 h-4 stroke-3" />
                      ¡Registrado!
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedEvento(id)}
                      className="bg-primary hover:bg-primary-hover text-white text-sm font-bold px-5 py-2 rounded-full transition-colors"
                    >
                      Asistir
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Registration modal */}
      <AnimatePresence>
        {selectedEvento && evento && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setSelectedEvento(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <span className="text-primary text-xs font-bold uppercase tracking-wide">
                      Registro de asistencia
                    </span>
                  </div>
                  <h3 className="font-black text-foreground text-lg">{evento.titulo}</h3>
                  <p className="text-muted-foreground text-sm mt-1">{evento.fecha} · {evento.hora}</p>
                </div>
                <button
                  onClick={() => setSelectedEvento(null)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegistro} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Tu nombre completo"
                    required
                    value={registro.name}
                    onChange={(e) => setRegistro((p) => ({ ...p, name: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="Teléfono (10 dígitos)"
                    required
                    maxLength={10}
                    value={registro.phone}
                    onChange={(e) => setRegistro((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-3" />
                      Confirmar asistencia
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
