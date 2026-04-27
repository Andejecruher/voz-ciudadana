'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Smile, Phone, MoreVertical, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { STATUS_CONFIG, type Chat, type Message } from '@/lib/mock-data';

interface ChatWindowProps {
  chat: Chat | null;
}

export function ChatWindow({ chat }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chat) {
      setMessages(chat.messages);
      setDraft('');
    }
  }, [chat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    if (!draft.trim()) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      role: 'outbound',
      text: draft.trim(),
      time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMsg]);
    setDraft('');
  }

  if (!chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
          <Send className="w-7 h-7 text-muted-foreground/40" />
        </div>
        <p className="font-medium text-foreground/60">Selecciona una conversación</p>
        <p className="text-sm mt-1">Elige un chat de la lista para comenzar</p>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[chat.status];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
            {chat.citizen.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm">{chat.citizen.name}</span>
              <span
                className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full',
                  cfg.bg,
                  cfg.color,
                )}
              >
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {chat.citizen.colonia} · {chat.citizen.phone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <Phone className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn('flex', msg.role === 'outbound' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                  msg.role === 'outbound'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border text-foreground rounded-bl-sm',
                )}
              >
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <div
                  className={cn(
                    'flex items-center gap-1 mt-1',
                    msg.role === 'outbound' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <span
                    className={cn(
                      'text-[10px]',
                      msg.role === 'outbound'
                        ? 'text-primary-foreground/50'
                        : 'text-muted-foreground',
                    )}
                  >
                    {msg.time}
                  </span>
                  {msg.role === 'outbound' && (
                    <CheckCheck className="w-3 h-3 text-primary-foreground/70" />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-5 py-4 border-t border-border bg-card">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <Textarea
              rows={1}
              placeholder="Escribe una respuesta..."
              className="resize-none min-h-[44px] max-h-32 pr-10 text-sm leading-relaxed"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <Paperclip className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <Smile className="w-4 h-4" />
            </button>
            <Button
              size="icon"
              onClick={send}
              disabled={!draft.trim()}
              className="bg-primary hover:bg-primary-hover text-primary-foreground h-9 w-9 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
