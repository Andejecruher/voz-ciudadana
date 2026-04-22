import { PublicNav } from '@/components/public/public-nav'
import { HeroSection } from '@/components/public/hero-section'
import { VisionSection } from '@/components/public/vision-section'
import { PropuestasSection } from '@/components/public/propuestas-section'
import { EventosSection } from '@/components/public/eventos-section'
import { SumateSection } from '@/components/public/sumate-section'
import { GaleriaSection } from '@/components/public/galeria-section'
import { TeamSection } from '@/components/public/team-section'
import { PublicFooter } from '@/components/public/public-footer'

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
  )
}
