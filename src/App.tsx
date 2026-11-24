import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { IconList, IconSettings, IconToday, Mark } from './components/Icons'
import { getSyncStatus, startAutoSync, subscribeSync } from './lib/sync'
import { useStore } from './lib/store'
import { loadTrending } from './lib/trending'
import type { Item, Trending } from './lib/types'
import { ListScreen } from './screens/ListScreen'
import { Session } from './screens/Session'
import { SettingsScreen } from './screens/SettingsScreen'
import { Today } from './screens/Today'

type Tab = 'today' | 'list' | 'settings'
const TABS: { id: Tab; hash: string; label: string; icon: () => JSX.Element }[] = [
  { id: 'today', hash: '#/', label: 'Bugün', icon: IconToday },
  { id: 'list', hash: '#/liste', label: 'Liste', icon: IconList },
  { id: 'settings', hash: '#/ayarlar', label: 'Ayarlar', icon: IconSettings },
]

function tabFromHash(): Tab {
  return TABS.find((t) => t.hash === window.location.hash)?.id ?? 'today'
}

export type TrendingState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Trending }

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, getSyncStatus)
}

export default function App() {
  const { settings } = useStore()
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [trending, setTrending] = useState<TrendingState>({ status: 'loading' })
  const [deck, setDeck] = useState<Item[] | null>(null)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    startAutoSync()
    let alive = true
    loadTrending()
      .then((data) => alive && setTrending({ status: 'ready', data }))
      .catch(() => alive && setTrending({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [])

  const couple = useMemo(() => {
    const [a, b] = settings.names.map((n) => n.trim())
    return a && b ? `${a} ve ${b}` : a || b || ''
  }, [settings.names])

  if (deck) return <Session deck={deck} onClose={() => setDeck(null)} />

  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="#/">
          <Mark />
          <span className="brand__name">Ne Yapsak</span>
        </a>
        {couple && <p className="side__scope">{couple}</p>}
        <nav className="nav" aria-label="Bölümler">
          {TABS.map((t) => (
            <a key={t.id} href={t.hash} className="nav__item" aria-current={tab === t.id ? 'page' : undefined}>
              <t.icon />
              <span>{t.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <header className="topbar">
        <a className="brand" href="#/">
          <Mark size={26} />
          <span className="brand__name">Ne Yapsak</span>
        </a>
        {couple && <span className="topbar__scope">{couple}</span>}
      </header>

      <main className="canvas">
        {tab === 'today' && <Today trending={trending} onStart={setDeck} />}
        {tab === 'list' && <ListScreen />}
        {tab === 'settings' && <SettingsScreen trending={trending} />}
      </main>

      <nav className="tabbar" aria-label="Bölümler">
        {TABS.map((t) => (
          <a key={t.id} href={t.hash} className="tabbar__item" aria-current={tab === t.id ? 'page' : undefined}>
            <t.icon />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
