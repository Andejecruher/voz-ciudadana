'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Download,
  History,
  X,
  Filter,
  CheckCircle2,
  Clock,
  ChevronUp,
  ChevronDown,
  MessageSquare,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { MOCK_CHATS, type Chat } from '@/lib/mock-data'

// Extended citizen list derived from mock chats + extra rows
const ALL_CITIZENS = [
  ...MOCK_CHATS.map((c) => ({
    id: c.citizen.id,
    name: c.citizen.name,
    phone: c.citizen.phone,
    barrio: c.citizen.colonia.split(',')[0].trim(),
    interests: c.citizen.interests,
    status: c.status === 'resuelto' ? 'verificado' : 'pendiente',
    registeredAt: c.citizen.registeredAt,
    messages: c.messages,
  })),
  {
    id: 'u7',
    name: 'Patricia Gómez Ruiz',
    phone: '9663344556',
    barrio: 'La Esperanza',
    interests: ['Educación', 'Salud'],
    status: 'verificado',
    registeredAt: '2025-01-08',
    messages: [],
  },
  {
    id: 'u8',
    name: 'Enrique Morales Castro',
    phone: '9669988776',
    barrio: 'Barrio Nuevo',
    interests: ['Agua Potable', 'Empleo Local'],
    status: 'pendiente',
    registeredAt: '2025-03-30',
    messages: [],
  },
  {
    id: 'u9',
    name: 'Graciela Vásquez Luna',
    phone: '9661234000',
    barrio: 'San Sebastián',
    interests: ['Campo y Agricultura'],
    status: 'verificado',
    registeredAt: '2025-02-14',
    messages: [],
  },
  {
    id: 'u10',
    name: 'Tomás Reyes Domínguez',
    phone: '9667654321',
    barrio: 'Los Ángeles',
    interests: ['Seguridad Pública', 'Empleo Local'],
    status: 'pendiente',
    registeredAt: '2025-04-01',
    messages: [],
  },
]

const BARRIOS = ['Todos los barrios', 'Centro', 'La Candelaria', 'Santo Domingo', 'El Mirador', 'Los Ángeles', 'La Joya', 'San Sebastián', 'Barrio Nuevo', 'Colonia Morelos', 'La Esperanza']

type SortKey = 'name' | 'barrio' | 'registeredAt'
type SortDir = 'asc' | 'desc'

function exportCSV(data: typeof ALL_CITIZENS) {
  const header = ['Nombre', 'Teléfono', 'Barrio', 'Intereses', 'Estatus', 'Fecha de registro']
  const rows = data.map((c) => [
    c.name,
    c.phone,
    c.barrio,
    c.interests.join(' | '),
    c.status,
    new Date(c.registeredAt).toLocaleDateString('es-MX'),
  ])
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ciudadanos-voz-ciudadana.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function CitizensView() {
  const [search, setSearch] = useState('')
  const [barrioFilter, setBarrioFilter] = useState('Todos los barrios')
  const [statusFilter, setStatusFilter] = useState<'all' | 'verificado' | 'pendiente'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('registeredAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [historyChat, setHistoryChat] = useState<(typeof ALL_CITIZENS)[0] | null>(null)

  const filtered = useMemo(() => {
    let data = ALL_CITIZENS.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        c.barrio.toLowerCase().includes(search.toLowerCase())
      const matchBarrio = barrioFilter === 'Todos los barrios' || c.barrio === barrioFilter
      const matchStatus = statusFilter === 'all' || c.status === statusFilter
      return matchSearch && matchBarrio && matchStatus
    })

    data = [...data].sort((a, b) => {
      let va = a[sortKey]
      let vb = b[sortKey]
      if (sortDir === 'asc') return va < vb ? -1 : va > vb ? 1 : 0
      return va > vb ? -1 : va < vb ? 1 : 0
    })

    return data
  }, [search, barrioFilter, statusFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
      : <ChevronDown className="w-3.5 h-3.5 text-primary" />
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-[1400px]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-black text-foreground">Directorio Ciudadano</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} voces registradas
            </p>
          </div>
          <Button
            onClick={() => exportCSV(filtered)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9 text-sm"
              placeholder="Buscar nombre, teléfono o barrio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={barrioFilter} onValueChange={setBarrioFilter}>
            <SelectTrigger className="w-52 h-9 text-sm">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BARRIOS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            {(['all', 'verificado', 'pendiente'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize',
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {s === 'all' ? 'Todos' : s === 'verificado' ? 'Verificado' : 'Pendiente'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th
                    className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      Nombre <SortIcon col="name" />
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Teléfono
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort('barrio')}
                  >
                    <div className="flex items-center gap-1.5">
                      Barrio <SortIcon col="barrio" />
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Intereses
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Estatus
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort('registeredAt')}
                  >
                    <div className="flex items-center gap-1.5">
                      Registro <SortIcon col="registeredAt" />
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">
                      Sin resultados para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {filtered.map((citizen, i) => (
                  <motion.tr
                    key={citizen.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                          {citizen.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground">{citizen.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{citizen.phone}</td>
                    <td className="px-4 py-3 text-foreground">{citizen.barrio}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {citizen.interests.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium bg-primary/8 text-primary px-2 py-0.5 rounded-full border border-primary/20"
                          >
                            {tag}
                          </span>
                        ))}
                        {citizen.interests.length > 2 && (
                          <span className="text-[10px] text-muted-foreground px-1">
                            +{citizen.interests.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {citizen.status === 'verificado' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Verificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(citizen.registeredAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setHistoryChat(citizen)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
                        disabled={citizen.messages.length === 0}
                        title={citizen.messages.length === 0 ? 'Sin mensajes' : 'Ver historial'}
                      >
                        <History className="w-3.5 h-3.5" />
                        Ver historial
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* History Dialog */}
      <AnimatePresence>
        {historyChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setHistoryChat(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-card rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-border"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                    {historyChat.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-foreground">{historyChat.name}</h3>
                    <p className="text-xs text-muted-foreground">{historyChat.barrio} · {historyChat.phone}</p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryChat(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Historial de conversación
                </span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {historyChat.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Este ciudadano no tiene mensajes registrados.
                  </p>
                ) : (
                  historyChat.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex',
                        msg.role === 'outbound' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                          msg.role === 'outbound'
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted text-foreground rounded-bl-sm border border-border'
                        )}
                      >
                        <p className="leading-relaxed">{msg.text}</p>
                        <p className={cn('text-[10px] mt-1', msg.role === 'outbound' ? 'text-primary-foreground/50 text-right' : 'text-muted-foreground')}>
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
