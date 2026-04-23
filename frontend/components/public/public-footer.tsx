'use client'

import { Check, Facebook, Mail } from 'lucide-react'
import { useState } from 'react'

export function PublicFooter() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  function handleNewsletter(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setSubscribed(true)
  }

  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      {/* Newsletter bar */}
      <div className="border-b border-sidebar-border">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h3 className="text-xl font-black text-white mb-1">
                Mantente informada/o
              </h3>
              <p className="text-sidebar-foreground/50 text-sm">
                Recibe noticias, eventos en tu barrio y propuestas directo en tu correo.
              </p>
            </div>
            {subscribed ? (
              <div className="flex items-center gap-2 text-primary-light font-bold">
                <Check className="w-5 h-5 stroke-3" />
                ¡Suscrito! Gracias por sumarte.
              </div>
            ) : (
              <form onSubmit={handleNewsletter} className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/40" />
                  <input
                    type="email"
                    required
                    placeholder="Tu correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-sidebar-accent border border-sidebar-border rounded-xl text-sm text-sidebar-foreground placeholder-sidebar-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors whitespace-nowrap shrink-0"
                >
                  Suscribirme
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <Check className="w-5 h-5 text-white stroke-3" />
              </div>
              <div>
                <div className="text-white font-black text-xl leading-none">Voz Ciudadana</div>
                <div className="text-sidebar-foreground/40 text-[10px] font-semibold uppercase tracking-widest">
                  Cintalapa de Figueroa, Chiapas
                </div>
              </div>
            </div>
            <p className="text-sidebar-foreground/50 text-sm leading-relaxed max-w-xs">
              Plataforma oficial de gobernanza municipal. Un movimiento construido desde los barrios
              de Cintalapa, para transformar nuestra comunidad con fuerza y cercanía.
            </p>
            {/* Social */}
            <div className="flex items-center gap-3 mt-6">
              {[Facebook].map((Icon, i) => (
                <a
                  key={i}
                  target='__blank'
                  href="https://www.facebook.com/karina.alvarado.735"
                  className="w-8 h-8 rounded-lg bg-sidebar-accent hover:bg-primary/30 flex items-center justify-center text-sidebar-foreground/50 hover:text-white transition-colors"
                  aria-label="Redes sociales"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-black text-sm uppercase tracking-wide mb-4">Campaña</h4>
            <ul className="space-y-2">
              {['Propuestas', 'Próximos eventos', 'Galería', 'Equipo'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sidebar-foreground/50 hover:text-white text-sm transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-black text-sm uppercase tracking-wide mb-4">Contacto</h4>
            <ul className="space-y-2">
              {[
                'Voluntariado',
                'Prensa y medios',
                'Denuncias ciudadanas',
                'Aviso de privacidad',
              ].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sidebar-foreground/50 hover:text-white text-sm transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-sidebar-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sidebar-foreground/30 text-xs">
            © {new Date().getFullYear()} Voz Ciudadana · Cintalapa de Figueroa, Chiapas. Todos los derechos reservados.
          </p>
          <p className="text-sidebar-foreground/20 text-xs">
            Financiamiento público de campaña conforme a normativa electoral vigente.
          </p>
        </div>
      </div>
    </footer>
  )
}
