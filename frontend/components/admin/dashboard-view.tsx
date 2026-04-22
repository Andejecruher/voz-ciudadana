'use client'

import { motion } from 'framer-motion'
import {
  Users,
  MessageCircle,
  CalendarDays,
  Target,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// --- Mock data ---

const BARRIO_DATA = [
  { barrio: 'Candelaria', registros: 142 },
  { barrio: 'Sto. Domingo', registros: 118 },
  { barrio: 'Centro', registros: 204 },
  { barrio: 'El Mirador', registros: 87 },
  { barrio: 'Los Ángeles', registros: 65 },
  { barrio: 'La Joya', registros: 54 },
  { barrio: 'Col. Morelos', registros: 76 },
  { barrio: 'La Esperanza', registros: 48 },
]

const CONCERN_DATA = [
  { name: 'Agua Potable', value: 38 },
  { name: 'Seguridad', value: 27 },
  { name: 'Empleo', value: 18 },
  { name: 'Campo', value: 12 },
  { name: 'Salud', value: 5 },
]

const CONCERN_COLORS = ['#711B2C', '#9B3244', '#B8973A', '#374151', '#6B7280']

const GROWTH_DATA = [
  { semana: 'S1', registros: 48 },
  { semana: 'S2', registros: 72 },
  { semana: 'S3', registros: 95 },
  { semana: 'S4', registros: 134 },
  { semana: 'S5', registros: 189 },
  { semana: 'S6', registros: 247 },
  { semana: 'S7', registros: 310 },
  { semana: 'S8', registros: 394 },
  { semana: 'S9', registros: 498 },
  { semana: 'S10', registros: 618 },
  { semana: 'S11', registros: 742 },
  { semana: 'S12', registros: 892 },
]

const KPIS = [
  {
    label: 'Voces Registradas',
    value: '892',
    delta: '+14% esta semana',
    icon: Users,
    color: 'bg-primary/10 text-primary',
    positive: true,
  },
  {
    label: 'Chats Activos Hoy',
    value: '34',
    delta: '+8 desde ayer',
    icon: MessageCircle,
    color: 'bg-accent/10 text-accent',
    positive: true,
  },
  {
    label: 'Eventos Próximos',
    value: '4',
    delta: 'Próximo: 10 May',
    icon: CalendarDays,
    color: 'bg-secondary/10 text-secondary',
    positive: true,
  },
  {
    label: 'Meta Precampaña',
    value: '89%',
    delta: '892 / 1,000 voces',
    icon: Target,
    color: 'bg-green-100 text-green-700',
    positive: true,
    progress: 89,
  },
]

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  color,
  positive,
  progress,
  delay,
}: (typeof KPIS)[0] & { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5" />
        </div>
        {positive && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
            <ArrowUpRight className="w-3 h-3" />
            {delta}
          </span>
        )}
      </div>
      <div>
        <div className="text-3xl font-black text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
      </div>
      {typeof progress === 'number' && (
        <div className="space-y-1.5">
          <Progress value={progress} className="h-2 bg-muted [&>div]:bg-primary" />
          <span className="text-xs text-muted-foreground">{delta}</span>
        </div>
      )}
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl px-4 py-2.5 shadow-lg text-sm">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name ?? p.dataKey}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function DashboardView() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-[1400px]">
        {/* Header */}
        <div>
          <h1 className="text-xl font-black text-foreground">Resumen de Precampaña</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cintalapa de Figueroa, Chiapas · Datos en tiempo real
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {KPIS.map((kpi, i) => (
            <KpiCard key={kpi.label} {...kpi} delay={i * 0.07} />
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Bar chart — registros por barrio */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-2 bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-foreground text-sm">Registros por Barrio</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Cintalapa de Figueroa</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                Total: 892
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={BARRIO_DATA} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="barrio"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="registros" fill="var(--color-primary)" radius={[6, 6, 0, 0]} name="Registros" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Pie chart — principales preocupaciones */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="mb-4">
              <h2 className="font-black text-foreground text-sm">Principales Preocupaciones</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Temas de interés registrados</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={CONCERN_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {CONCERN_DATA.map((_, i) => (
                    <Cell key={i} fill={CONCERN_COLORS[i % CONCERN_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-3 space-y-1.5">
              {CONCERN_DATA.map(({ name, value }, i) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: CONCERN_COLORS[i] }}
                    />
                    <span className="text-muted-foreground">{name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{value}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Line chart — crecimiento semanal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-black text-foreground text-sm">Crecimiento de la Comunidad</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Voces acumuladas por semana</p>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
              Últimas 12 semanas
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={GROWTH_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="semana"
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="registros"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: 'var(--color-primary)' }}
                name="Voces registradas"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  )
}
