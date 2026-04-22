'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Bot,
  Plug,
  Shield,
  Check,
  Trash2,
  Plus,
  Save,
  X,
  ChevronDown,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

// --- Mock team data ---
interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'moderador'
  active: boolean
  initials: string
}

const INITIAL_TEAM: TeamMember[] = [
  { id: 't1', name: 'Rosa Pérez Domínguez', email: 'rosa@vozcindadana.mx', role: 'admin', active: true, initials: 'RP' },
  { id: 't2', name: 'Marisol Ruiz Flores', email: 'marisol@vozcindadana.mx', role: 'moderador', active: true, initials: 'MR' },
  { id: 't3', name: 'Guadalupe Torres Méndez', email: 'guadalupe@vozcindadana.mx', role: 'moderador', active: false, initials: 'GT' },
]

const BARRIOS_DEFAULT = [
  'Centro', 'La Candelaria', 'Santo Domingo', 'El Mirador',
  'Los Ángeles', 'La Joya', 'San Sebastián', 'Barrio Nuevo',
  'Colonia Morelos', 'La Esperanza', 'Ejido Cintalapa',
]

const TABS = [
  { id: 'equipo', label: 'Equipo', icon: Users },
  { id: 'bot', label: 'Bot WhatsApp', icon: Bot },
  { id: 'integracion', label: 'Integración', icon: Plug },
]

export function SettingsView() {
  const [activeTab, setActiveTab] = useState('equipo')

  // Team state
  const [team, setTeam] = useState<TeamMember[]>(INITIAL_TEAM)
  const [addingMember, setAddingMember] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'moderador' as 'admin' | 'moderador' })

  // Bot state
  const [welcomeMsg, setWelcomeMsg] = useState(
    'Bienvenido/a a Voz Ciudadana Cintalapa. Soy el asistente del equipo de la candidata. ¿Cuál es tu nombre y en qué barrio vives? Con gusto te atendemos.'
  )
  const [barrios, setBarrios] = useState<string[]>(BARRIOS_DEFAULT)
  const [newBarrio, setNewBarrio] = useState('')
  const [botSaved, setBotSaved] = useState(false)

  // Integration state
  const [metaConnected, setMetaConnected] = useState(true)
  const [webhookUrl] = useState('https://vozcindadana.mx/api/webhook/whatsapp')
  const [webhookStatus] = useState<'active' | 'inactive'>('active')

  function saveBotSettings() {
    setBotSaved(true)
    setTimeout(() => setBotSaved(false), 2500)
  }

  function addBarrio() {
    if (!newBarrio.trim() || barrios.includes(newBarrio.trim())) return
    setBarrios((p) => [...p, newBarrio.trim()])
    setNewBarrio('')
  }

  function removeBarrio(b: string) {
    setBarrios((p) => p.filter((x) => x !== b))
  }

  function addTeamMember() {
    if (!newMember.name || !newMember.email) return
    setTeam((p) => [
      ...p,
      {
        id: `t${Date.now()}`,
        name: newMember.name,
        email: newMember.email,
        role: newMember.role,
        active: true,
        initials: newMember.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase(),
      },
    ])
    setNewMember({ name: '', email: '', role: 'moderador' })
    setAddingMember(false)
  }

  function toggleMember(id: string) {
    setTeam((p) => p.map((m) => m.id === id ? { ...m, active: !m.active } : m))
  }

  function removeMember(id: string) {
    setTeam((p) => p.filter((m) => m.id !== id))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-[960px]">
        {/* Header */}
        <div>
          <h1 className="text-xl font-black text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Administra el equipo, el bot y las integraciones del sistema
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 border-b border-border pb-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px',
                activeTab === id
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Equipo */}
        {activeTab === 'equipo' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-foreground">Gestión de Operadores</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{team.length} miembros del equipo</p>
              </div>
              <Button
                size="sm"
                onClick={() => setAddingMember(true)}
                className="bg-primary hover:bg-primary-hover text-primary-foreground gap-2"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </Button>
            </div>

            {/* Add member form */}
            {addingMember && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-muted/50 border border-border rounded-2xl p-5 space-y-4"
              >
                <h3 className="font-semibold text-sm text-foreground">Nuevo operador</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre completo</Label>
                    <Input
                      placeholder="Nombre y apellido"
                      value={newMember.name}
                      onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Correo electrónico</Label>
                    <Input
                      type="email"
                      placeholder="correo@dominio.mx"
                      value={newMember.email}
                      onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rol</Label>
                  <Select
                    value={newMember.role}
                    onValueChange={(v) => setNewMember((p) => ({ ...p, role: v as 'admin' | 'moderador' }))}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="moderador">Moderador de Chat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={addTeamMember}
                    disabled={!newMember.name || !newMember.email}
                    className="bg-primary hover:bg-primary-hover text-primary-foreground"
                  >
                    Guardar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingMember(false)}>
                    Cancelar
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Team list */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {team.map((member, i) => (
                <div
                  key={member.id}
                  className={cn(
                    'flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 transition-colors',
                    !member.active && 'opacity-50'
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground text-sm">{member.name}</div>
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full',
                    member.role === 'admin'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {member.role === 'admin' ? 'Admin' : 'Moderador'}
                  </span>
                  <Switch
                    checked={member.active}
                    onCheckedChange={() => toggleMember(member.id)}
                    className="data-[state=checked]:bg-primary"
                  />
                  {member.role !== 'admin' && (
                    <button
                      onClick={() => removeMember(member.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tab: Bot WhatsApp */}
        {activeTab === 'bot' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Welcome message */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-4 h-4 text-primary" />
                <h2 className="font-black text-foreground text-sm">Mensaje de Bienvenida</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Este mensaje se envía automáticamente cuando un ciudadano contacta por WhatsApp por primera vez.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Mensaje</Label>
                <Textarea
                  rows={4}
                  className="resize-none"
                  value={welcomeMsg}
                  onChange={(e) => setWelcomeMsg(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground text-right">{welcomeMsg.length} caracteres</p>
              </div>
              {/* Preview */}
              <div className="bg-[#ECE5DD] rounded-xl p-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vista previa</p>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-xs shadow-sm">
                  <p className="text-sm text-gray-800 leading-relaxed">{welcomeMsg}</p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">Ahora · leído</p>
                </div>
              </div>
            </div>

            {/* Barrios list */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="font-black text-foreground text-sm">Barrios y Colonias Oficiales</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lista que usa el bot para identificar la zona del ciudadano.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Agregar barrio..."
                  value={newBarrio}
                  onChange={(e) => setNewBarrio(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBarrio())}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={addBarrio} disabled={!newBarrio.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {barrios.map((b) => (
                  <div
                    key={b}
                    className="flex items-center gap-1.5 bg-primary/5 border border-primary/20 text-foreground text-xs font-medium px-3 py-1.5 rounded-full"
                  >
                    {b}
                    <button
                      onClick={() => removeBarrio(b)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={saveBotSettings}
              className={cn(
                'gap-2',
                botSaved
                  ? 'bg-green-600 hover:bg-green-600 text-white'
                  : 'bg-primary hover:bg-primary-hover text-primary-foreground'
              )}
            >
              {botSaved ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  Guardado
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar cambios
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Tab: Integración */}
        {activeTab === 'integracion' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Meta API status */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-black text-foreground text-sm">API de Meta (WhatsApp Business)</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Conexión con la API oficial de WhatsApp</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {metaConnected ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                      <Wifi className="w-3.5 h-3.5" />
                      Conectado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-full">
                      <WifiOff className="w-3.5 h-3.5" />
                      Desconectado
                    </span>
                  )}
                  <Switch
                    checked={metaConnected}
                    onCheckedChange={setMetaConnected}
                    className="data-[state=checked]:bg-green-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                {[
                  { label: 'Phone Number ID', value: '1234567890123456' },
                  { label: 'Business Account ID', value: '9876543210654321' },
                  { label: 'API Version', value: 'v20.0' },
                  { label: 'Mensajes este mes', value: '1,247' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</p>
                    <p className="text-sm font-mono text-foreground mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Webhook */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <h2 className="font-black text-foreground text-sm">Webhook</h2>
                <span className={cn(
                  'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                  webhookStatus === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-destructive/10 text-destructive'
                )}>
                  {webhookStatus === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL del Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="flex-1 font-mono text-xs bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Verify Token</Label>
                <Input
                  readOnly
                  value="•••••••••••••••••••••••"
                  className="font-mono text-xs bg-muted"
                  type="password"
                />
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl text-xs text-muted-foreground">
                <div className={cn('w-2 h-2 rounded-full animate-pulse', webhookStatus === 'active' ? 'bg-green-500' : 'bg-destructive')} />
                Último evento recibido: hace 4 minutos
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
