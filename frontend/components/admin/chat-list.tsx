'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { MOCK_CHATS, STATUS_CONFIG, type Chat, type ChatStatus } from '@/lib/mock-data'

interface ChatListProps {
  selectedId: string | null
  onSelect: (chat: Chat) => void
}

const STATUS_FILTERS: { value: ChatStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'nuevo', label: 'Nuevos' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'resuelto', label: 'Resueltos' },
]

export function ChatList({ selectedId, onSelect }: ChatListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ChatStatus | 'all'>('all')

  const filtered = MOCK_CHATS.filter((c) => {
    const matchSearch =
      c.citizen.name.toLowerCase().includes(search.toLowerCase()) ||
      c.citizen.colonia.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col h-full border-r border-border bg-background">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Conversaciones</h2>
          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <Filter className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Buscar ciudadano o colonia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              filter === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
            Sin resultados
          </div>
        )}
        {filtered.map((chat, i) => {
          const cfg = STATUS_CONFIG[chat.status]
          const isSelected = selectedId === chat.id
          return (
            <motion.button
              key={chat.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelect(chat)}
              className={cn(
                'w-full text-left px-4 py-3.5 border-b border-border transition-colors hover:bg-muted/50',
                isSelected && 'bg-primary/5 border-l-2 border-l-primary'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold flex-shrink-0">
                  {chat.citizen.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-foreground text-sm truncate">
                      {chat.citizen.name}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {chat.lastTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                      {chat.lastMessage}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      {chat.unread > 0 && (
                        <span className="w-5 h-5 bg-primary rounded-full text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1">
                    <span
                      className={cn(
                        'text-[10px] font-medium px-2 py-0.5 rounded-full',
                        cfg.bg,
                        cfg.color
                      )}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
