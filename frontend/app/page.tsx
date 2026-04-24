import { EventosSection } from '@/components/public/eventos-section';
import { GaleriaSection } from '@/components/public/galeria-section';
import { HeroSection } from '@/components/public/hero-section';
import { PropuestasSection } from '@/components/public/propuestas-section';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicNav } from '@/components/public/public-nav';
import { SumateSection } from '@/components/public/sumate-section';
import { TeamSection } from '@/components/public/team-section';
import { VisionSection } from '@/components/public/vision-section';
import { createPageMetadata, siteConfig } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = createPageMetadata({
  title: 'Cintalapa tiene voz de mujer',
  description:
    'Conocé las propuestas, los eventos y el equipo detrás de Voz Ciudadana, la candidata que nació y creció en Cintalapa de Figueroa, Chiapas. ¡Sumate al cambio!',
  path: '/',
  openGraphTitle: siteConfig.defaultTitle,
});

export default function LandingPage() {
  return (
    <>
      <PublicNav />
      <main>
        <HeroSection />
        <VisionSection />
        <PropuestasSection />
        <EventosSection />
        <SumateSection />
        <GaleriaSection />
        <TeamSection />
      </main>
      <PublicFooter />
    </>
  );
}
