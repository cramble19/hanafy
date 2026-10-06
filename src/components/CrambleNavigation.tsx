import { Activity, BookOpen, Sprout, Star, Sun } from 'lucide-react'
import type { CrambleView } from '@/hooks/useCrambleNavigation'
import '@/pages/rhythm.css'

const destinations = [
  { view: 'tracker', label: 'Today', icon: Sun },
  { view: 'observatory', label: 'Observatory', icon: Sprout },
  { view: 'someday', label: 'Someday', icon: Star },
  { view: 'rhythm', label: 'Rhythm', icon: Activity },
  { view: 'ledger', label: 'Ledger', icon: BookOpen },
] as const

export function CrambleNavigation({ view, onNavigate }: { view: CrambleView; onNavigate: (view: CrambleView) => void }) {
  const active = view === 'ledgerDetail' || view === 'emotionHistory' ? 'ledger' : view
  return <nav className="rhythm-bottom-nav cramble-bottom-nav" aria-label="Cramble pages">
    {destinations.map(({ view: destination, label, icon: Icon }) =>
      <button type="button" key={destination} onClick={() => onNavigate(destination)} aria-current={active === destination ? 'page' : undefined}>
        <Icon size={21} aria-hidden="true" /><span>{label}</span>
      </button>)}
  </nav>
}
