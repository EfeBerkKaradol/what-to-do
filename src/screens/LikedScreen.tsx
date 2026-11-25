import { useEffect, useMemo, useState } from 'react'
import type { TrendingState } from '../App'
import { Cover } from '../components/Cover'
import { detailHref } from '../components/Dock'
import { IconHeart } from '../components/Icons'
import { subline } from '../components/ItemRow'
import { stamp } from '../lib/format'
import { liveItems, removeItem, saveTrending, updateSettings, useStore } from '../lib/store'
import { loadCatalog } from '../lib/trending'
import type { Catalog, Genre, Item, TrendEntry } from '../lib/types'

type SectionId = 'liked' | 'trend-movies' | 'trend-theatre' | 'movies' | 'series' | 'events'
type CatalogState = { status: 'loading' | 'error' } | { status: 'ready'; data: Catalog }

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'liked', label: 'Beğendiklerim' },
  { id: 'trend-movies', label: 'Revaçtaki filmler' },
  { id: 'trend-theatre', label: 'Revaçtaki tiyatrolar' },
  { id: 'movies', label: 'Filmler' },
  { id: 'series', label: 'Diziler' },
  { id: 'events', label: 'Etkinlikler' },
]

/** Sections whose content depends on the chosen city. */
const LOCAL: SectionId[] = ['trend-theatre', 'events']

// Hand-picked places lead the event categories, in this order.
const PLACE_SHELVES: { id: string; name: string }[] = [
  { id: 'walk', name: 'Yürüyüş parkları' },
  { id: 'food', name: 'Yemek mekanları' },
  { id: 'dessert', name: 'Tatlı mekanları' },
]
const PLACE_PREFIX = 'places:'

// Where the reader was, so coming back from a detail page lands on the same card.
const memory: { section?: SectionId; picked: Partial<Record<SectionId, string>>; scrollY: number } = { picked: {}, scrollY: 0 }

/**
 * Everything that can be liked, section by section: what is trending, films and series by
 * genre, events by kind, and hand-picked places. Likes go into the next deck.
 */
export function LikedScreen({ trending }: { trending: TrendingState }) {
  const { doc, settings } = useStore()
  const liked = useMemo(() => liveItems(doc).filter((i) => i.ref), [doc])
  const byRef = useMemo(() => new Map(liked.map((i) => [i.ref as string, i])), [liked])
  const [section, setSection] = useState<SectionId>(memory.section ?? (liked.length > 0 ? 'liked' : 'trend-movies'))
  const [picked, setPicked] = useState<Partial<Record<SectionId, string>>>(memory.picked)
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setCatalog((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }))
    loadCatalog()
      .then((data) => alive && setCatalog({ status: 'ready', data }))
      .catch(() => alive && setCatalog({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [attempt])

  useEffect(() => {
    memory.section = section
    memory.picked = picked
  }, [section, picked])

  const toggle = (entry: TrendEntry) => {
    const existing = byRef.get(entry.id)
    if (existing) removeItem(existing.id)
    else saveTrending(entry)
  }

  const region = settings.region
  const data = catalog.status === 'ready' ? catalog.data : null
  const regions = trending.status === 'ready' ? trending.data.regions : data?.regions ?? null
  const usesCatalog = section !== 'liked' && section !== 'trend-movies'

  // The categories of the open section; a section without categories has one unnamed group.
  const genres: Genre[] = useMemo(() => {
    if (section === 'trend-movies') {
      return trending.status === 'ready' ? [{ id: 'week', name: '', items: trending.data.movies ?? [] }] : []
    }
    if (!data) return []
    switch (section) {
      case 'trend-theatre': {
        const theatre = (data.events[region] ?? []).find((g) => g.name === 'Tiyatro')
        return theatre ? [{ ...theatre, name: '' }] : []
      }
      case 'movies':
        return data.movies ?? []
      case 'series':
        return data.series ?? []
      case 'events': {
        const places = PLACE_SHELVES.map((shelf) => ({
          id: PLACE_PREFIX + shelf.id,
          name: shelf.name,
          items: (data.places?.[shelf.id]?.[region] ?? []).flatMap((g) => g.items),
        })).filter((g) => g.items.length > 0)
        return [...places, ...(data.events[region] ?? [])]
      }
      default:
        return []
    }
  }, [section, data, trending, region])

  const genre = genres.find((g) => g.id === picked[section]) ?? genres[0]

  // Back from a detail page: once the cards are there again, return to where the reader was.
  const ready = section === 'liked' || Boolean(genre)
  useEffect(() => {
    if (!ready || memory.scrollY === 0) return
    window.scrollTo(0, memory.scrollY)
    memory.scrollY = 0
  }, [ready])
  const loading = section === 'trend-movies' ? trending.status === 'loading' : usesCatalog && catalog.status === 'loading'
  const failed = section === 'trend-movies' ? trending.status === 'error' : usesCatalog && catalog.status === 'error'

  return (
    <div className="page">
      <header className="title">
        <div>
          <h1>Kaydettiklerim</h1>
          <p className="title__sub">
            {liked.length === 0
              ? 'Kalbe bastıklarınız burada birikir ve desteye girer.'
              : `${liked.length} beğeni, hepsi bir sonraki destede.`}
          </p>
        </div>
        {regions && LOCAL.includes(section) && (
          <label className="select select--quiet">
            <span className="sr">Şehir</span>
            <select value={region} onChange={(e) => updateSettings({ region: e.target.value })}>
              {Object.entries(regions).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        )}
      </header>

      <div className="tabs" role="tablist" aria-label="Bölüm">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            className="tab"
            onClick={(e) => {
              setSection(s.id)
              // The row scrolls sideways; keep the chosen section in view.
              e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
            }}
          >
            {s.label}
            {s.id === 'liked' && <span className="num tab__n"> {liked.length}</span>}
          </button>
        ))}
      </div>

      {section === 'liked' &&
        (liked.length === 0 ? (
          <p className="empty">
            Henüz beğendiğiniz bir şey yok.{' '}
            <button className="link" onClick={() => setSection('trend-movies')}>Revaçtaki filmlere bakın</button>
          </p>
        ) : (
          <div className="cards">
            {liked.map((item) => (
              <LikeCard key={item.id} item={item} liked onToggle={() => removeItem(item.id)} />
            ))}
          </div>
        ))}

      {section !== 'liked' && (
        <>
          {loading && <LoadingCards />}
          {failed && (
            <p className="empty">
              Liste şu an yüklenemedi.{' '}
              {usesCatalog && <button className="link" onClick={() => setAttempt(attempt + 1)}>Yeniden dene</button>}
            </p>
          )}
          {!loading && !failed && !genre && (
            <p className="empty">
              {section === 'trend-theatre' && 'Bu şehirde önümüzdeki 30 günde satışta tiyatro oyunu yok.'}
              {section === 'events' && 'Bu şehir için önümüzdeki 30 günde kategorili etkinlik yok.'}
              {(section === 'movies' || section === 'series' || section === 'trend-movies') && 'Bu bölümün verisi henüz gelmedi.'}
            </p>
          )}
          {!loading && !failed && genre && (
            <>
              {genres.length > 1 && (
                <div className="chiprow" role="radiogroup" aria-label="Kategori">
                  {genres.map((g) => (
                    <button
                      key={g.id}
                      role="radio"
                      aria-checked={g.id === genre.id}
                      className="chip chip--pick"
                      onClick={() => setPicked({ ...picked, [section]: g.id })}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="cards">
                {genre.items.map((entry) => (
                  <LikeCard key={entry.id} item={entry} liked={byRef.has(entry.id)} onToggle={() => toggle(entry)} />
                ))}
              </div>
              <p className="foot">{footnote(section, genre, trending, data)}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}

function footnote(section: SectionId, genre: Genre, trending: TrendingState, data: Catalog | null): string {
  const updated = data ? ` Güncellendi: ${stamp(data.updatedAt)}.` : ''
  switch (section) {
    case 'trend-movies':
      return `Bu haftanın en çok ilgi gören ${genre.items.length} filmi.${trending.status === 'ready' ? ` Güncellendi: ${stamp(trending.data.updatedAt)}.` : ''}`
    case 'trend-theatre':
      return `Önümüzdeki 30 günün oyunları, en çok seansı olan önde.${updated}`
    case 'movies':
      return `${genre.name} kategorisinde şu an en popüler ${genre.items.length} film.${updated}`
    case 'series':
      return `${genre.name} kategorisinde şu an en popüler ${genre.items.length} dizi.${updated}`
    case 'events': {
      if (genre.id.startsWith(PLACE_PREFIX)) {
        const drawn = genre.items.filter((i) => i.illustrated).length
        const about = `${genre.items.length} yer, elle seçilmiş liste; puan ya da sıralama değil.`
        return drawn > 0
          ? `${about} ${drawn === genre.items.length ? 'Görseller' : `${drawn} görsel`} yapay zekâyla üretildi ve temsilidir, mekanın kendi fotoğrafı değildir.`
          : about
      }
      return `Önümüzdeki 30 günün ${genre.name.toLocaleLowerCase('tr')} etkinlikleri, en çok seansı olan önde.${updated}`
    }
    default:
      return ''
  }
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
      <a
        className="tile__link"
        href={detailHref(('ref' in item && item.ref) || item.id)}
        onClick={() => {
          memory.scrollY = window.scrollY
        }}
      >
        <Cover src={item.image} title={item.title} kind={item.kind} className="tile__img" />
        <div className="tile__text">
          <h2 className="tile__title">{item.title}</h2>
          <p className="tile__sub">{done ? 'Yapıldı · ' : ''}{subline(item)}</p>
        </div>
      </a>
      <button
        className={`like${liked ? ' like--on' : ''}`}
        aria-pressed={liked}
        aria-label={liked ? `${item.title}: beğeniyi kaldır` : `${item.title}: beğen`}
        onClick={onToggle}
      >
        <IconHeart filled={liked} />
      </button>
    </article>
  )
}
