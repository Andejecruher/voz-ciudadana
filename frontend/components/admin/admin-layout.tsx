'use client';

import { AdminSidebar } from '@/components/admin/sidebar';
import { usePathname } from 'next/navigation';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
    '/admin/resumen': {
      title: 'Resumen — Voz Ciudadana',
      subtitle: 'Indicadores de precampaña · Cintalapa de Figueroa, Chiapas',
    },
    '/admin': {
      title: 'Bandeja de Entrada — Voz Ciudadana',
      subtitle: 'Centro de Escucha Ciudadana · Cintalapa de Figueroa, Chiapas',
    },
    '/admin/ciudadanos': {
      title: 'Directorio Ciudadano — Voz Ciudadana',
      subtitle: 'Base de datos de simpatizantes registrados',
    },
    '/admin/eventos': {
      title: 'Agenda de Eventos — Voz Ciudadana',
      subtitle: 'Presencia territorial en Cintalapa de Figueroa',
    },
    '/admin/settings': {
      title: 'Configuración — Voz Ciudadana',
      subtitle: 'Equipo, bot WhatsApp e integraciones',
    },
  };

  const page = PAGE_TITLES[pathname] ?? PAGE_TITLES['/admin'];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar activePath={pathname} />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-border bg-card shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-foreground">{page.title}</h1>
            <p className="text-xs text-muted-foreground">{page.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs text-muted-foreground">En línea</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-black">
              AD
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
