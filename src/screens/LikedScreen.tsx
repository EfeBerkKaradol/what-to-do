import { useEffect, useMemo, useState } from 'react'
import type { TrendingState } from '../App'
import { Cover } from '../components/Cover'
import { IconHeart } from '../components/Icons'
import { subline } from '../components/ItemRow'
import { stamp } from '../lib/format'
import { liveItems, removeItem, saveTrending, updateSettings, useStore } from '../lib/store'
import { loadCatalog } from '../lib/trending'
import type { Catalog, Genre, Item, TrendEntry } from '../lib/types'

type View = 'liked' | 'week' | 'genres'
type Shelf = 'movies' | 'series' | 'events'
type CatalogState = { status: 'loading' | 'error' } | { status: 'ready'; data: Catalog }

const SHELVES: { id: Shelf; label: string }[] = [
  { id: 'movies', label: 'Film' },
  { id: 'series', label: 'Dizi' },
  { id: 'events', label: 'Etkinlik' },
]

/** This week's picks and the category shelves, a like on every card; and everything liked so far. */
export function LikedScreen({ trending, ten }: { trending: TrendingState; ten: TrendEntry[] }) {
  const { doc, settings } = useStore()
  const liked = useMemo(() => liveItems(doc).filter((i) => i.ref), [doc])
  const byRef = useMemo(() => new Map(liked.map((i) => [i.ref as string, i])), [liked])
  const [view, setView] = useState<View>(liked.length > 0 ? 'liked' : 'week')
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [shelf, setShelf] = useState<Shelf>('movies')
  const [picked, setPicked] = useState<Partial<Record<Shelf, string>>>({})

  // Fetched the first time the category view is opened; `attempt` moves on a retry.
  useEffect(() => {
    if (view !== 'genres') return
    let alive = true
    setCatalog((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }))
    loadCatalog()
      .then((data) => alive && setCatalog({ status: 'ready', data }))
      .catch(() => alive && setCatalog({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [view, attempt])

  const toggle = (entry: TrendEntry) => {
    const existing = byRef.get(entry.id)
    if (existing) removeItem(existing.id)
    else saveTrending(entry)
  }

  const genresOf = (data: Catalog, s: Shelf): Genre[] => (s === 'events' ? data.events[settings.region] ?? [] : data[s]) ?? []
  // Film and series shelves need TMDB; a shelf with nothing in it is not offered.
  const shelves = catalog.status === 'ready' ? SHELVES.filter((s) => genresOf(catalog.data, s.id).length > 0 || s.id === 'events') : SHELVES
  const activeShelf = shelves.some((s) => s.id === shelf) ? shelf : shelves[0]?.id ?? 'events'
  const genres = catalog.status === 'ready' ? genresOf(catalog.data, activeShelf) : []
  const genre = genres.find((g) => g.id === picked[activeShelf]) ?? genres[0]
  const regions = trending.status === 'ready' ? trending.data.regions : catalog.status === 'ready' ? catalog.data.regions : null
  const regionSelect = regions && (
    <label className="select select--quiet">
      <span className="sr">Etkinlik şehri</span>
      <select value={settings.region} onChange={(e) => updateSettings({ region: e.target.value })}>
        {Object.entries(regions).map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="page">
      <header className="title">
        <div>
          <h1>Kaydettiklerim</h1>
          <p className="title__sub">
            {liked.length === 0
              ? 'Beğendiğiniz etkinlik, film ve diziler burada birikir.'
              : `${liked.length} beğeni, hepsi bir sonraki destede.`}
          </p>
        </div>
      </header>

      <div className="toolbar">
        <div className="seg seg--fit seg--onground" role="radiogroup" aria-label="Görünüm">
          <button role="radio" aria-checked={view === 'liked'} className="seg__opt" onClick={() => setView('liked')}>
            Beğendiklerim <span className="num seg__n">{liked.length}</span>
          </button>
          <button role="radio" aria-checked={view === 'week'} className="seg__opt" onClick={() => setView('week')}>
            Revaçta <span className="num seg__n">{ten.length}</span>
          </button>
          <button role="radio" aria-checked={view === 'genres'} className="seg__opt" onClick={() => setView('genres')}>
            Kategoriler
          </button>
        </div>
      </div>

      {view === 'liked' &&
        (liked.length === 0 ? (
          <p className="empty">
            Henüz beğendiğiniz bir şey yok.{' '}
            <button className="link" onClick={() => setView('week')}>Bu hafta revaçta olanlara bakın</button>
          </p>
        ) : (
          <div className="cards">
            {liked.map((item) => (
              <LikeCard key={item.id} item={item} liked onToggle={() => removeItem(item.id)} />
            ))}
          </div>
        ))}

      {view === 'week' && (
        <>
          {regionSelect && <div className="subbar">{regionSelect}</div>}
          {trending.status === 'loading' && <LoadingCards />}
          {trending.status === 'error' && <p className="empty">Revaçta olanlar şu an yüklenemedi.</p>}
          {trending.status === 'ready' && ten.length === 0 && <p className="empty">Bu şehir için bu hafta kayıtlı etkinlik yok.</p>}
          {trending.status === 'ready' && ten.length > 0 && (
            <>
              <div className="cards">
                {ten.map((entry) => (
                  <LikeCard key={entry.id} item={entry} liked={byRef.has(entry.id)} onToggle={() => toggle(entry)} />
                ))}
              </div>
              <p className="foot">Güncellendi: {stamp(trending.data.updatedAt)}. Her gün haftanın havuzundan on tanesi gelir.</p>
            </>
          )}
        </>
      )}

      {view === 'genres' && (
        <>
          <div className="subbar">
            <div className="seg seg--fit seg--onground" role="radiogroup" aria-label="Tür">
              {shelves.map((s) => (
                <button key={s.id} role="radio" aria-checked={activeShelf === s.id} className="seg__opt" onClick={() => setShelf(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            {activeShelf === 'events' && regionSelect}
          </div>

          {catalog.status === 'loading' && <LoadingCards />}
          {catalog.status === 'error' && (
            <p className="empty">
              Kategoriler şu an yüklenemedi.{' '}
              <button className="link" onClick={() => setAttempt(attempt + 1)}>Yeniden dene</button>
            </p>
          )}
          {catalog.status === 'ready' && genres.length === 0 && (
            <p className="empty">
              {activeShelf === 'events' ? 'Bu şehir için önümüzdeki 30 günde kategorili etkinlik yok.' : 'Bu tür için kategori verisi henüz gelmedi.'}
            </p>
          )}
          {catalog.status === 'ready' && genre && (
            <>
              <div className="chiprow" role="radiogroup" aria-label="Kategori">
                {genres.map((g) => (
                  <button
                    key={g.id}
                    role="radio"
                    aria-checked={g.id === genre.id}
                    className="chip chip--pick"
                    onClick={() => setPicked({ ...picked, [activeShelf]: g.id })}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
              <div className="cards">
                {genre.items.map((entry) => (
                  <LikeCard key={entry.id} item={entry} liked={byRef.has(entry.id)} onToggle={() => toggle(entry)} />
                ))}
              </div>
              <p className="foot">
                {activeShelf === 'events'
                  ? `Önümüzdeki 30 günün ${genre.name.toLocaleLowerCase('tr')} etkinlikleri, en çok seansı olan önde.`
                  : `${genre.name} kategorisinde şu an en popüler ${genre.items.length} ${activeShelf === 'movies' ? 'film' : 'dizi'}.`}{' '}
                Güncellendi: {stamp(catalog.data.updatedAt)}.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}

function LoadingCards() {
  return (
    <div className="cards" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => <div className="tile tile--loading" key={i} />)}
    </div>
  )
}

function LikeCard({ item, liked, onToggle }: { item: Item | TrendEntry; liked: boolean; onToggle: () => void }) {
  const done = 'doneAt' in item && item.doneAt
  return (
    <article className="tile">
      <Cover src={item.image} title={item.title} className="tile__img" />
      <button
        className={`like${liked ? ' like--on' : ''}`}
        aria-pressed={liked}
        aria-label={liked ? `${item.title}: beğeniyi kaldır` : `${item.title}: beğen`}
        onClick={onToggle}
      >
        <IconHeart filled={liked} />
      </button>
      <div className="tile__text">
        <h2 className="tile__title">{item.title}</h2>
        <p className="tile__sub">{done ? 'Yapıldı · ' : ''}{subline(item)}</p>
      </div>
    </article>
  )
}
