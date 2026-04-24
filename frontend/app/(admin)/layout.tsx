import { AdminLayout } from '@/components/admin/admin-layout';
import { createPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  ...createPageMetadata({
    title: 'Panel administrativo',
    description: 'Panel interno de gestión de Voz Ciudadana.',
    path: '/admin',
    openGraphTitle: 'Voz Ciudadana — Panel administrativo',
  }),
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
