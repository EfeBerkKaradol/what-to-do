import { useEffect, useMemo, useState } from 'react'
import type { TrendingState } from '../App'
import { Cover } from '../components/Cover'
import { ROUTES } from '../components/Dock'
import { IconBack, IconHeart, IconOut } from '../components/Icons'
import { eventWhen } from '../lib/format'
import { liveItems, removeItem, saveTrending, useStore } from '../lib/store'
import { findEntry, loadCatalog, trendToItem } from '../lib/trending'
import { KIND_LABEL, type Catalog, type Item, type TrendEntry } from '../lib/types'
import { planFor } from '../lib/venues'

const SOURCES: [RegExp, string][] = [
  [/themoviedb\.org/, 'TMDB'],
  [/biletix\.com/, 'Biletix'],
  [/wikipedia\.org/, 'Wikipedia'],
  [/tvmaze\.com/, 'TVMaze'],
  [/apple\.com/, 'iTunes'],
]

/** What to say when nothing was written about the entry: its own facts, in a sentence. */
function fallbackAbout(item: Item | TrendEntry): string {
  const where = [item.venue, item.city].filter(Boolean).join(', ')
  switch (item.kind) {
    case 'place':
      return [item.meta ? `Tür: ${item.meta}.` : '', where ? `Adres: ${where}.` : '', 'Gitmeden önce açık olduğunu haritadan kontrol edin.'].filter(Boolean).join(' ')
    case 'event':
      return [item.meta ? `${item.meta}.` : '', item.when ? `${eventWhen(item.when)}.` : '', where ? `${where}.` : ''].filter(Boolean).join(' ')
    default:
      return ''
  }
}

/** One entry on its own page: picture, what it is, where and when, and the way to like it. */
export function DetailScreen({ id, trending }: { id: string; trending: TrendingState }) {
  const { doc } = useStore()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogDone, setCatalogDone] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    let alive = true
    loadCatalog()
      .then((c) => alive && setCatalog(c), () => undefined)
      .finally(() => alive && setCatalogDone(true))
    return () => {
      alive = false
    }
  }, [id])

  const saved = useMemo(() => liveItems(doc).find((i) => i.ref === id || i.id === id), [doc, id])
  const entry = useMemo(() => findEntry(id, trending.status === 'ready' ? trending.data : null, catalog), [id, trending, catalog])
  // The catalogue copy has the full description; the saved copy is what is left once
  // an entry has dropped out of this week's lists.
  const item: Item | TrendEntry | undefined = entry ?? saved
  const own = Boolean(saved && !saved.ref)
  const back = own ? ROUTES.added : ROUTES.liked
  const loading = !item && (trending.status === 'loading' || !catalogDone)

  if (!item) {
    return (
      <div className="page page--narrow">
        <a className="back" href={back}><IconBack /> Kaydettiklerim</a>
        {loading ? (
          <div className="detail detail--loading" aria-busy="true"><div className="detail__img" /><div className="detail__body"><span className="bar bar--w60" /><span className="bar bar--w40" /></div></div>
        ) : (
          <p className="empty">Bu kayıt artık listelerde yok. <a className="link" href={ROUTES.liked}>Kaydettiklerim’e dönün</a></p>
        )}
      </div>
    )
  }

  const liked = Boolean(saved?.ref)
  const about = item.about || item.note || fallbackAbout(item)
  const lead = item.about && item.note && !item.about.startsWith(item.note.replace(/…$/, '')) ? item.note : ''
  const plan = item.kind === 'series' ? null : planFor(item === saved ? saved : trendToItem(item))
  const map = plan?.links[0]
  const source = item.url ? SOURCES.find(([re]) => re.test(item.url as string))?.[1] : undefined
  const facts: [string, string][] = [
    ['Tür', KIND_LABEL[item.kind]],
    ...(item.meta ? [['Kategori', item.meta] as [string, string]] : []),
    ...(item.when ? [['Tarih', eventWhen(item.when)] as [string, string]] : []),
    ...(item.venue ? [[item.kind === 'event' ? 'Mekan' : 'Yer', item.venue] as [string, string]] : []),
    ...(item.city ? [['Şehir', item.city] as [string, string]] : []),
    ...('doneAt' in item && item.doneAt ? [['Durum', 'Yapıldı'] as [string, string]] : []),
  ]

  return (
    <div className="page page--narrow">
      <a className="back" href={back}><IconBack /> {own ? 'Eklediklerim' : 'Kaydettiklerim'}</a>

      <article className="detail">
        <figure className="detail__figure">
          <Cover src={item.image} title={item.title} kind={item.kind} className="detail__img" />
          {item.illustrated && <figcaption>Temsili görsel, yapay zekâyla üretildi.</figcaption>}
        </figure>

        <div className="detail__body">
          <header className="detail__head">
            <span className="pill">{item.kind === 'event' ? item.meta?.split(' · ')[0] || KIND_LABEL.event : KIND_LABEL[item.kind]}</span>
            <h1>{item.title}</h1>
            {item.kind === 'event' && item.when && <p className="detail__when">{eventWhen(item.when)}{item.venue ? ` · ${item.venue}` : ''}</p>}
          </header>

          <div className="detail__actions">
            {!own &&
              (liked ? (
                <button className="btn btn--ghost detail__like detail__like--on" aria-pressed onClick={() => saved && removeItem(saved.id)}>
                  <IconHeart filled /> Beğenildi
                </button>
              ) : (
                <button className="btn btn--primary detail__like" aria-pressed={false} onClick={() => saveTrending(item as TrendEntry)}>
                  <IconHeart /> Beğen
                </button>
              ))}
            {map && (
              <a className="btn btn--ghost" href={map.url} target="_blank" rel="noreferrer">
                {item.kind === 'movie' ? 'Yakındaki sinemalar' : item.kind === 'activity' ? 'Yakında ara' : 'Haritada aç'} <IconOut />
              </a>
            )}
            {item.url && (
              <a className="btn btn--ghost" href={item.url} target="_blank" rel="noreferrer">
                {item.kind === 'event' ? 'Bilet ve ayrıntı' : source ? `${source}’de aç` : 'Kaynağa git'} <IconOut />
              </a>
            )}
          </div>

          <section className="detail__section">
            <h2>Açıklama</h2>
            {lead && <p className="detail__lead">{lead}</p>}
            {about ? <p>{about}</p> : <p className="detail__none">Bu kayıt için yazılı bir açıklama yok.</p>}
            {item.about && source && <p className="foot">Kaynak: {source}.</p>}
          </section>

          <section className="detail__section">
            <h2>Bilgiler</h2>
            <dl className="facts">
              {facts.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </section>
        </div>
      </article>
    </div>
  )
}
