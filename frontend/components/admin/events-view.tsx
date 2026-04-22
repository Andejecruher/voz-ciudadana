'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  MapPin,
  Clock,
  Users,
  X,
  CheckCircle2,
  Loader2,
  CalendarDays,
  LayoutList,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Send,
  Filter,
  Megaphone,
  TreePine,
  ShieldCheck,
  Droplets,
} from 'lucide-react'
import { es } from 'date-fns/locale'
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'mitin' | 'vecinal' | 'brigada' | 'foro'

interface AdminEvento {
  id: string
  title: string
  location: string
  barrio: string
  date: Date
  time: string
  confirmados: number
  description: string
  type: EventType
  responsible: string
  needs: string[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; color: string; bg: string; dot: string; icon: React.ReactNode }
> = {
  mitin: {
    label: 'Mitin',
    color: 'text-white',
    bg: 'bg-primary',
    dot: 'bg-primary',
    icon: <Megaphone className="w-3 h-3" />,
  },
  vecinal: {
    label: 'Reunión vecinal',
    color: 'text-foreground',
    bg: 'bg-[#6B7280]',
    dot: 'bg-[#6B7280]',
    icon: <Users className="w-3 h-3" />,
  },
  brigada: {
    label: 'Brigada',
    color: 'text-white',
    bg: 'bg-[#166534]',
    dot: 'bg-[#166534]',
    icon: <TreePine className="w-3 h-3" />,
  },
  foro: {
    label: 'Foro temático',
    color: 'text-white',
    bg: 'bg-[#1E40AF]',
    dot: 'bg-[#1E40AF]',
    icon: <ShieldCheck className="w-3 h-3" />,
  },
}

const BARRIOS = [
  'La Candelaria',
  'Santo Domingo',
  'El Mirador',
  'Colonia Morelos',
  'Centro',
  'La Joya',
  'Ejido La Esperanza',
  'Barrio Nuevo',
  'San Isidro',
  'Colonia Las Palmas',
]

const RESPONSABLES = [
  'Coordinación General',
  'Brigada Norte',
  'Brigada Sur',
  'Brigada Centro',
  'Equipo de Salud',
  'Equipo de Campo',
  'Relaciones Comunitarias',
]

const NOW = new Date()

const INITIAL_EVENTS: AdminEvento[] = [
  {
    id: 'e1',
    title: 'Asamblea La Candelaria',
    location: 'Parque Central, Barrio La Candelaria',
    barrio: 'La Candelaria',
    date: new Date(NOW.getFullYear(), NOW.getMonth(), 8),
    time: '11:00',
    confirmados: 87,
    type: 'mitin',
    responsible: 'Coordinación General',
    description: 'Gran mitin con la candidata en el corazón de La Candelaria.',
    needs: ['Agua potable en 3 calles sin servicio', 'Alumbrado público dañado desde enero', 'Bacheo urgente en Calle Hidalgo'],
  },
  {
    id: 'e2',
    title: 'Caminata Santo Domingo',
    location: 'Barrio Santo Domingo, entrada principal',
    barrio: 'Santo Domingo',
    date: new Date(NOW.getFullYear(), NOW.getMonth(), 14),
    time: '10:00',
    confirmados: 54,
    type: 'vecinal',
    responsible: 'Brigada Norte',
    description: 'Recorrido de proximidad por las calles de Santo Domingo.',
    needs: ['Falta drenaje en calle lateral', 'Solicitan parque infantil'],
  },
  {
    id: 'e3',
    title: 'Foro por el Agua — Centro',
    location: 'Salón Ejidal, Centro de Cintalapa',
    barrio: 'Centro',
    date: new Date(NOW.getFullYear(), NOW.getMonth(), 14),
    time: '18:00',
    confirmados: 31,
    type: 'foro',
    responsible: 'Equipo de Campo',
    description: 'Mesa de diálogo sobre el acceso al agua potable.',
    needs: ['Tubería rota sin reparar 6 meses', 'Agua turbia en colonias bajas'],
  },
  {
    id: 'e4',
    title: 'Brigada de Salud — El Mirador',
    location: 'Explanada Barrio El Mirador',
    barrio: 'El Mirador',
    date: new Date(NOW.getFullYear(), NOW.getMonth(), 21),
    time: '09:00',
    confirmados: 120,
    type: 'brigada',
    responsible: 'Equipo de Salud',
    description: 'Consultas médicas gratuitas y talleres de salud comunitaria.',
    needs: ['Sin médico en la clínica local', 'Piden medicamentos gratuitos'],
  },
  {
    id: 'e5',
    title: 'Reunión Ejido La Esperanza',
    location: 'Casa de usos múltiples, Ejido La Esperanza',
    barrio: 'Ejido La Esperanza',
    date: new Date(NOW.getFullYear(), NOW.getMonth(), 26),
    time: '16:00',
    confirmados: 43,
    type: 'vecinal',
    responsible: 'Brigada Sur',
    description: 'Diálogo con ejidatarios sobre apoyo al campo.',
    needs: ['Caminos rurales sin mantenimiento', 'Sin crédito para semilla este ciclo'],
  },
  {
    id: 'e6',
    title: 'Gran Mitin de Cierre — La Joya',
    location: 'Plaza Principal, La Joya',
    barrio: 'La Joya',
    date: new Date(NOW.getFullYear(), NOW.getMonth(), 28),
    time: '19:00',
    confirmados: 250,
    type: 'mitin',
    responsible: 'Coordinación General',
    description: 'Mitin masivo de cierre de fase territorial.',
    needs: ['Solicitud de sonido y equipo', 'Seguridad perimetral'],
  },
]

type FormState = {
  title: string
  barrio: string
  location: string
  date: string
  time: string
  type: EventType
  responsible: string
  description: string
}

const EMPTY_FORM: FormState = {
  title: '',
  barrio: '',
  location: '',
  date: '',
  time: '',
  type: 'vecinal',
  responsible: '',
  description: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventsView() {
  const [events, setEvents] = useState<AdminEvento[]>(INITIAL_EVENTS)
  const [currentMonth, setCurrentMonth] = useState(new Date(NOW.getFullYear(), NOW.getMonth(), 1))
  const [selectedEvent, setSelectedEvent] = useState<AdminEvento | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar')
  const [filterBarrio, setFilterBarrio] = useState<string>('all')
  const [filterResponsable, setFilterResponsable] = useState<string>('all')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchBarrio = filterBarrio === 'all' || e.barrio === filterBarrio
      const matchResp = filterResponsable === 'all' || e.responsible === filterResponsable
      return matchBarrio && matchResp
    })
  }, [events, filterBarrio, filterResponsable])

  // Calendar grid
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const startPadding = (getDay(startOfMonth(currentMonth)) + 6) % 7 // Mon-start

  function eventsForDay(day: Date) {
    return filteredEvents.filter((e) => isSameDay(e.date, day))
  }

  // Sort agenda by date
  const agendaEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [filteredEvents])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.barrio || !form.date || !form.time || !form.responsible) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 900))
    const [year, month, day] = form.date.split('-').map(Number)
    setEvents((prev) => [
      ...prev,
      {
        id: `e${Date.now()}`,
        title: form.title,
        barrio: form.barrio,
        location: form.location || form.barrio + ', Cintalapa',
        date: new Date(year, month - 1, day),
        time: form.time,
        confirmados: 0,
        type: form.type,
        responsible: form.responsible,
        description: form.description,
        needs: [],
      },
    ])
    setLoading(false)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setShowModal(false)
      setForm(EMPTY_FORM)
    }, 1500)
  }

  function setField(field: keyof FormState, val: string) {
    setForm((p) => ({ ...p, [field]: val }))
  }

  function sendReminder() {
    setReminderSent(true)
    setTimeout(() => setReminderSent(false), 3000)
  }

  const cfg = selectedEvent ? EVENT_TYPE_CONFIG[selectedEvent.type] : null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-card flex-shrink-0 flex-wrap gap-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Month nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-black text-foreground capitalize min-w-[160px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={filterBarrio}
              onChange={(e) => setFilterBarrio(e.target.value)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Todos los barrios</option>
              {BARRIOS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              value={filterResponsable}
              onChange={(e) => setFilterResponsable(e.target.value)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Todos los responsables</option>
              {RESPONSABLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'calendar'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendario
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'agenda'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Agenda
            </button>
          </div>

          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 ml-1">
            {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', val.dot)} />
                <span className="text-[11px] text-muted-foreground">{val.label}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={() => setShowModal(true)}
            size="sm"
            className="bg-primary hover:bg-primary-hover text-primary-foreground gap-1.5 ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Programar
          </Button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex">
        {/* Calendar / Agenda */}
        <div className={cn('flex-1 overflow-y-auto', selectedEvent ? 'lg:flex-[1_1_0]' : '')}>
          {viewMode === 'calendar' ? (
            <div className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground uppercase py-2">
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {/* Padding cells */}
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} className="min-h-[100px] rounded-xl" />
                ))}

                {daysInMonth.map((day) => {
                  const dayEvents = eventsForDay(day)
                  const today = isToday(day)
                  const hasSelected = selectedEvent && isSameDay(day, selectedEvent.date)

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'min-h-[100px] rounded-xl border p-2 transition-colors',
                        today ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
                        hasSelected && 'ring-2 ring-primary ring-offset-1'
                      )}
                    >
                      <div className={cn(
                        'text-xs font-black mb-1.5 w-6 h-6 rounded-full flex items-center justify-center',
                        today ? 'bg-primary text-primary-foreground' : 'text-foreground'
                      )}>
                        {format(day, 'd')}
                      </div>

                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const c = EVENT_TYPE_CONFIG[ev.type]
                          return (
                            <button
                              key={ev.id}
                              onClick={() => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}
                              className={cn(
                                'w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded-md truncate flex items-center gap-1 transition-opacity hover:opacity-80',
                                c.bg, c.color
                              )}
                            >
                              {c.icon}
                              <span className="truncate">{ev.title}</span>
                            </button>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-muted-foreground font-semibold pl-1">
                            +{dayEvents.length - 3} más
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* ── Agenda / Timeline view ── */
            <div className="p-5 space-y-3 max-w-3xl">
              {agendaEvents.length === 0 && (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                  <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">Sin eventos para este filtro</p>
                </div>
              )}
              {agendaEvents.map((evento, i) => {
                const c = EVENT_TYPE_CONFIG[evento.type]
                const isSelected = selectedEvent?.id === evento.id
                return (
                  <motion.button
                    key={evento.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedEvent(isSelected ? null : evento)}
                    className={cn(
                      'w-full text-left bg-card border rounded-2xl p-4 flex gap-4 transition-all hover:border-primary/30',
                      isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border'
                    )}
                  >
                    {/* Date badge */}
                    <div className="flex-shrink-0 w-12 text-center">
                      <div className={cn('rounded-xl py-2 px-1', c.bg)}>
                        <div className={cn('text-[10px] font-bold uppercase leading-none', c.color, 'opacity-80')}>
                          {format(evento.date, 'MMM', { locale: es })}
                        </div>
                        <div className={cn('text-xl font-black leading-none mt-0.5', c.color)}>
                          {format(evento.date, 'd')}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', c.bg, c.color)}>
                          {c.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{evento.responsible}</span>
                      </div>
                      <h3 className="font-black text-foreground text-sm mb-1">{evento.title}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Clock className="w-3 h-3" />
                          {evento.time.replace(':', ':').padStart(5, '0').replace(/(\d{2}):(\d{2})/, (_, h, m) => `${parseInt(h) < 12 ? h : parseInt(h) - 12 || 12}:${m} ${parseInt(h) < 12 ? 'a.m.' : 'p.m.'}`)}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{evento.barrio}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <Users className="w-3 h-3" />
                          {evento.confirmados} confirmados
                        </div>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        <AnimatePresence>
          {selectedEvent && cfg && (
            <motion.aside
              key={selectedEvent.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25 }}
              className="w-full lg:w-[360px] border-l border-border bg-card overflow-y-auto flex-shrink-0"
            >
              {/* Panel header */}
              <div className={cn('px-5 py-4 flex items-start justify-between gap-3', cfg.bg)}>
                <div className="min-w-0">
                  <div className={cn('text-[10px] font-bold uppercase mb-1 flex items-center gap-1.5', cfg.color, 'opacity-80')}>
                    {cfg.icon}
                    {cfg.label}
                  </div>
                  <h2 className={cn('font-black text-sm leading-snug', cfg.color)}>
                    {selectedEvent.title}
                  </h2>
                  <p className={cn('text-[11px] mt-0.5', cfg.color, 'opacity-70')}>
                    {format(selectedEvent.date, "EEEE d 'de' MMMM", { locale: es })} · {selectedEvent.time.replace(/(\d{1,2}):(\d{2})/, (_, h, m) => `${parseInt(h) > 12 ? parseInt(h) - 12 : h}:${m} ${parseInt(h) < 12 ? 'a.m.' : 'p.m.'}`)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className={cn('p-1 rounded-lg hover:bg-black/10 transition-colors flex-shrink-0 mt-0.5', cfg.color)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Location */}
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">{selectedEvent.location}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Cintalapa de Figueroa, Chiapas</div>
                  </div>
                </div>

                {/* Responsible */}
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div className="text-xs">
                    <span className="text-muted-foreground">Responsable: </span>
                    <span className="font-semibold text-foreground">{selectedEvent.responsible}</span>
                  </div>
                </div>

                {/* Confirmados counter */}
                <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-primary leading-none">{selectedEvent.confirmados}</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">Confirmados vía WhatsApp</div>
                  </div>
                </div>

                {/* Description */}
                {selectedEvent.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedEvent.description}</p>
                )}

                {/* Needs reported */}
                {selectedEvent.needs.length > 0 && (
                  <div>
                    <div className="text-xs font-black text-foreground uppercase tracking-wide mb-2.5">
                      Necesidades reportadas por la zona
                    </div>
                    <div className="space-y-2">
                      {selectedEvent.needs.map((need, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 bg-muted/60 rounded-lg px-3 py-2.5"
                        >
                          <Droplets className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-foreground leading-relaxed">{need}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reminder button */}
                <div className="pt-1">
                  <Button
                    onClick={sendReminder}
                    disabled={reminderSent}
                    className={cn(
                      'w-full gap-2 transition-all',
                      reminderSent
                        ? 'bg-[#166534] hover:bg-[#166534] text-white'
                        : 'bg-[#25D366] hover:bg-[#20bc5a] text-white'
                    )}
                  >
                    {reminderSent ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Recordatorio enviado
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar recordatorio masivo
                      </>
                    )}
                  </Button>
                  {reminderSent && (
                    <p className="text-[11px] text-muted-foreground text-center mt-2">
                      Mensaje enviado a {selectedEvent.confirmados} contactos vía WhatsApp
                    </p>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ─── New event modal ─── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="bg-card rounded-2xl max-w-lg w-full shadow-2xl border border-border overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
                <div>
                  <h3 className="font-black text-foreground">Programar Encuentro</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nuevo evento territorial en Cintalapa
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6">
                {saved ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-10 text-center"
                  >
                    <CheckCircle2 className="w-12 h-12 text-primary mb-3" />
                    <p className="font-black text-foreground text-lg">Evento programado</p>
                    <p className="text-sm text-muted-foreground mt-1">Ya aparece en el calendario territorial</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="ev-title" className="text-sm">Nombre del encuentro *</Label>
                      <Input
                        id="ev-title"
                        placeholder="Ej: Asamblea Barrio La Candelaria"
                        value={form.title}
                        onChange={(e) => setField('title', e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="ev-barrio" className="text-sm">Barrio / Ejido *</Label>
                        <select
                          id="ev-barrio"
                          value={form.barrio}
                          onChange={(e) => setField('barrio', e.target.value)}
                          required
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">Seleccionar...</option>
                          {BARRIOS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ev-type" className="text-sm">Tipo de evento *</Label>
                        <select
                          id="ev-type"
                          value={form.type}
                          onChange={(e) => setField('type', e.target.value as EventType)}
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ev-loc" className="text-sm">Ubicación exacta</Label>
                      <Input
                        id="ev-loc"
                        placeholder="Ej: Parque Central, calle Hidalgo #12"
                        value={form.location}
                        onChange={(e) => setField('location', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="ev-date" className="text-sm">Fecha *</Label>
                        <Input
                          id="ev-date"
                          type="date"
                          value={form.date}
                          onChange={(e) => setField('date', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ev-time" className="text-sm">Hora *</Label>
                        <Input
                          id="ev-time"
                          type="time"
                          value={form.time}
                          onChange={(e) => setField('time', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ev-resp" className="text-sm">Responsable de brigada *</Label>
                      <select
                        id="ev-resp"
                        value={form.responsible}
                        onChange={(e) => setField('responsible', e.target.value)}
                        required
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Seleccionar responsable...</option>
                        {RESPONSABLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ev-desc" className="text-sm">
                        Objetivo del evento{' '}
                        <span className="text-muted-foreground font-normal">(opcional)</span>
                      </Label>
                      <Textarea
                        id="ev-desc"
                        placeholder="Describe el objetivo del encuentro..."
                        rows={2}
                        className="resize-none"
                        value={form.description}
                        onChange={(e) => setField('description', e.target.value)}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || !form.title || !form.barrio || !form.date || !form.time || !form.responsible}
                      className="w-full bg-primary hover:bg-primary-hover text-primary-foreground"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Programar Encuentro
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
