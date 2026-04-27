'use client';

import { LogoIcon } from '@/components/logo';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Resumen', href: '/admin/resumen' },
  { icon: Inbox, label: 'Inbox', href: '/admin', badge: 12 },
  { icon: Users, label: 'Ciudadanos', href: '/admin/ciudadanos' },
  { icon: CalendarDays, label: 'Eventos', href: '/admin/eventos' },
  { icon: Settings, label: 'Configuración', href: '/admin/settings', badge: undefined },
];

interface SidebarProps {
  activeItem?: string;
  activePath?: string;
}

export function AdminSidebar({ activeItem, activePath }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col bg-sidebar border-r border-sidebar-border h-screen flex-shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border flex-shrink-0 min-w-0">
        <LogoIcon className="w-8 h-8 flex-shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="min-w-0 overflow-hidden"
            >
              <div className="text-sidebar-foreground font-black text-sm tracking-tight whitespace-nowrap leading-none">
                Voz Ciudadana
              </div>
              <div className="text-sidebar-foreground/40 text-[9px] font-semibold uppercase tracking-widest leading-none mt-0.5">
                Cintalapa · CRM
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ icon: Icon, label, href, badge }) => {
          const isActive = activePath ? activePath === href : label === activeItem;
          return (
            <a
              key={label}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group relative',
                isActive
                  ? 'bg-sidebar-primary/20 text-sidebar-primary'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <div className="relative flex-shrink-0">
                <Icon className="w-5 h-5" />
                {badge && !collapsed && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full text-[10px] text-primary-foreground font-bold flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm font-medium whitespace-nowrap flex-1"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && badge && (
                <span className="bg-primary/20 text-primary-light text-xs font-semibold px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 pb-4 space-y-1 border-t border-sidebar-border pt-4">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
          <Bell className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium whitespace-nowrap"
              >
                Notificaciones
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium whitespace-nowrap"
              >
                Cerrar sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 w-6 h-6 bg-sidebar-border border border-sidebar-border rounded-full flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent transition-colors z-10"
        aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </motion.aside>
  );
}
