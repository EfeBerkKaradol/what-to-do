import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { DETAIL_PREFIX, Dock, ROUTES, type Route } from './components/Dock'
import { PixelField } from './components/PixelField'
import { getSyncStatus, startAutoSync, subscribeSync } from './lib/sync'
import { liveItems, useStore } from './lib/store'
import { loadTrending } from './lib/trending'
import type { Item, Trending } from './lib/types'
import { AddedScreen } from './screens/AddedScreen'
import { DetailScreen } from './screens/DetailScreen'
import { LikedScreen } from './screens/LikedScreen'
import { Session } from './screens/Session'
import { SettingsScreen } from './screens/SettingsScreen'

interface Place {
  route: Route
  /** Entry id, on the detail page. */
  id?: string
}

function placeFromHash(): Place {
  const hash = window.location.hash
  if (hash.startsWith(DETAIL_PREFIX)) {
    try {
      return { route: 'detail', id: decodeURIComponent(hash.slice(DETAIL_PREFIX.length)) }
    } catch {
      return { route: 'liked' }
    }
  }
  const hit = (Object.keys(ROUTES) as (keyof typeof ROUTES)[]).find((r) => ROUTES[r] === hash)
  return { route: hit ?? 'home' }
}

export type TrendingState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Trending }

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, getSyncStatus)
}

export default function App() {
  const { doc, settings } = useStore()
  const [place, setPlace] = useState<Place>(placeFromHash)
  const route = place.route
  const [trending, setTrending] = useState<TrendingState>({ status: 'loading' })
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const onHash = () => setPlace(placeFromHash())
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

  // What the couple added or liked and has not done yet; the deck is built from these first.
  const mine: Item[] = useMemo(() => liveItems(doc).filter((i) => !i.doneAt), [doc])

  return (
    <>
      <PixelField active={route === 'home' && !playing} />
      <Dock route={route} onPlay={() => setPlaying(true)} />
      {route !== 'home' && (
        <main className="canvas" key={route + (place.id ?? '')}>
          {route === 'added' && <AddedScreen />}
          {route === 'liked' && <LikedScreen trending={trending} />}
          {route === 'settings' && <SettingsScreen trending={trending} />}
          {route === 'detail' && place.id && <DetailScreen id={place.id} trending={trending} />}
        </main>
      )}
      {playing && (
        <Session
          mine={mine}
          trending={trending.status === 'ready' ? trending.data : null}
          region={settings.region}
          onClose={() => setPlaying(false)}
        />
      )}
    </>
  )
}
