import { useMemo, useState } from 'react'
import type { TrendingState } from '../App'
import { Cover } from '../components/Cover'
import { IconHeart } from '../components/Icons'
import { subline } from '../components/ItemRow'
import { stamp } from '../lib/format'
import { liveItems, removeItem, saveTrending, updateSettings, useStore } from '../lib/store'
import type { Item, TrendEntry } from '../lib/types'

type View = 'liked' | 'week'

/** This week's picks with a like on every card, and everything liked so far. */
export function LikedScreen({ trending, ten }: { trending: TrendingState; ten: TrendEntry[] }) {
  const { doc, settings } = useStore()
  const liked = useMemo(() => liveItems(doc).filter((i) => i.ref), [doc])
  const byRef = useMemo(() => new Map(liked.map((i) => [i.ref as string, i])), [liked])
  const [view, setView] = useState<View>(liked.length > 0 ? 'liked' : 'week')

  const toggle = (entry: TrendEntry) => {
    const existing = byRef.get(entry.id)
    if (existing) removeItem(existing.id)
    else saveTrending(entry)
  }

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
            Bu hafta revaçta <span className="num seg__n">{ten.length}</span>
          </button>
        </div>
        {view === 'week' && trending.status === 'ready' && (
          <label className="select select--quiet">
            <span className="sr">Etkinlik şehri</span>
            <select value={settings.region} onChange={(e) => updateSettings({ region: e.target.value })}>
              {Object.entries(trending.data.regions).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        )}
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
          {trending.status === 'loading' && (
            <div className="cards" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => <div className="tile tile--loading" key={i} />)}
            </div>
          )}
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
