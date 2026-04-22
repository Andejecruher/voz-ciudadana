'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Phone,
  MapPin,
  Calendar,
  Tag,
  ChevronDown,
  Clock,
  Building2,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DEPARTMENTS, STATUS_CONFIG, type Chat, type ChatStatus } from '@/lib/mock-data'

interface CitizenProfileProps {
  chat: Chat | null
  onClose?: () => void
}

const STATUS_OPTIONS: { value: ChatStatus; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'resuelto', label: 'Resuelto' },
]

export function CitizenProfile({ chat, onClose }: CitizenProfileProps) {
  const [department, setDepartment] = useState(chat?.citizen.department ?? '')
  const [status, setStatus] = useState<ChatStatus>(chat?.status ?? 'nuevo')

  if (!chat) {
    return (
      <div className="w-72 flex-shrink-0 border-l border-border bg-card flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
        Selecciona una conversación para ver el perfil ciudadano.
      </div>
    )
  }

  const { citizen } = chat
  const cfg = STATUS_CONFIG[status]

  return (
    <motion.div
      key={chat.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="w-72 flex-shrink-0 border-l border-border bg-card flex flex-col overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Perfil Ciudadano</span>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Avatar & name */}
      <div className="flex flex-col items-center py-6 px-5 border-b border-border">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mb-3">
          {citizen.name.charAt(0)}
        </div>
        <h3 className="font-bold text-foreground text-center">{citizen.name}</h3>
        <span className="text-xs text-muted-foreground font-medium mt-1">
          Voz Registrada de {citizen.colonia}
        </span>
        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full mt-1.5', cfg.bg, cfg.color)}>
          {cfg.label}
        </span>
      </div>

      {/* Info */}
      <div className="px-5 py-4 space-y-3 border-b border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Datos de Contacto
        </h4>
        {[
          { icon: Phone, value: citizen.phone },
          { icon: MapPin, value: citizen.colonia },
          {
            icon: Calendar,
            value: new Date(citizen.registeredAt).toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          },
        ].map(({ icon: Icon, value }) => (
          <div key={value} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm text-foreground">{value}</span>
          </div>
        ))}
      </div>

      {/* Interests */}
      <div className="px-5 py-4 border-b border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Tag className="w-3.5 h-3.5" />
          Temas de interés
        </h4>
        <div className="flex flex-wrap gap-2">
          {citizen.interests.map((interest) => (
            <span
              key={interest}
              className="text-xs bg-primary/5 text-foreground px-2.5 py-1 rounded-full border border-border"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>

      {/* Assign department */}
      <div className="px-5 py-4 border-b border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5" />
          Asignar a departamento
        </h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between text-sm"
            >
              <span className={cn(!department && 'text-muted-foreground')}>
                {department || 'Sin asignar'}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {DEPARTMENTS.map((dept) => (
              <DropdownMenuItem
                key={dept}
                onClick={() => setDepartment(dept)}
                className={cn(department === dept && 'bg-primary/10 text-primary')}
              >
                {dept}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Change status */}
      <div className="px-5 py-4 border-b border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Cambiar estado
        </h4>
        <div className="flex flex-col gap-2">
          {STATUS_OPTIONS.map(({ value, label }) => {
            const optCfg = STATUS_CONFIG[value]
            return (
              <button
                key={value}
                onClick={() => setStatus(value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors',
                  status === value
                    ? `${optCfg.bg} ${optCfg.color} border-transparent`
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full', optCfg.dot)} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Interaction history */}
      <div className="px-5 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Historial
        </h4>
        <div className="space-y-2">
          {chat.messages.slice(-3).map((msg) => (
            <div key={msg.id} className="text-xs text-muted-foreground flex gap-2">
              <span className="flex-shrink-0 text-foreground/40">{msg.time}</span>
              <span className="truncate">{msg.text}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
