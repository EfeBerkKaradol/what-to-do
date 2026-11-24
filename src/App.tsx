import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Dock, ROUTES, type Route } from './components/Dock'
import { PixelField } from './components/PixelField'
import { getSyncStatus, startAutoSync, subscribeSync } from './lib/sync'
import { liveItems, useStore } from './lib/store'
import { loadTrending, todaysTen, trendToItem } from './lib/trending'
import type { Item, Trending, TrendEntry } from './lib/types'
import { AddedScreen } from './screens/AddedScreen'
import { LikedScreen } from './screens/LikedScreen'
import { Session } from './screens/Session'
import { SettingsScreen } from './screens/SettingsScreen'

function routeFromHash(): Route {
  const hit = (Object.keys(ROUTES) as Route[]).find((r) => ROUTES[r] === window.location.hash)
  return hit ?? 'home'
}

export type TrendingState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Trending }

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, getSyncStatus)
}

export default function App() {
  const { doc, settings } = useStore()
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [trending, setTrending] = useState<TrendingState>({ status: 'loading' })
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
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

  const ten: TrendEntry[] = useMemo(
    () => (trending.status === 'ready' ? todaysTen(trending.data, settings.region) : []),
    [trending, settings.region],
  )

  // The deck: everything the couple added or liked and has not done yet,
  // plus today's ten that are not already among those.
  const pool: Item[] = useMemo(() => {
    const live = liveItems(doc)
    const refs = new Set(live.map((i) => i.ref).filter(Boolean))
    return [...live.filter((i) => !i.doneAt), ...ten.filter((t) => !refs.has(t.id)).map(trendToItem)]
  }, [doc, ten])

  return (
    <>
      <PixelField active={route === 'home' && !playing} />
      <Dock route={route} onPlay={() => setPlaying(true)} />
      {route !== 'home' && (
        <main className="canvas" key={route}>
          {route === 'added' && <AddedScreen />}
          {route === 'liked' && <LikedScreen trending={trending} ten={ten} />}
          {route === 'settings' && <SettingsScreen trending={trending} />}
        </main>
      )}
      {playing && <Session pool={pool} onClose={() => setPlaying(false)} />}
    </>
  )
}
