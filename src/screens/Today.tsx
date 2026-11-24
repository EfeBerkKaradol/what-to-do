import { useMemo, useState } from 'react'
import type { TrendingState } from '../App'
import { ItemRow } from '../components/ItemRow'
import { ago, stamp } from '../lib/format'
import { liveItems, saveTrending, updateSettings, useStore } from '../lib/store'
import { shuffle } from '../lib/tournament'
import { todaysTen, trendToItem } from '../lib/trending'
import { KIND_LABEL, type Item, type Kind } from '../lib/types'

const KINDS: Kind[] = ['activity', 'place', 'movie', 'series', 'event']

export function Today({ trending, onStart }: { trending: TrendingState; onStart: (deck: Item[]) => void }) {
  const { doc, settings } = useStore()
  const [off, setOff] = useState<Set<Kind>>(new Set())

  const saved = useMemo(() => liveItems(doc).filter((i) => !i.doneAt), [doc])
  const ten = useMemo(
    () => (trending.status === 'ready' ? todaysTen(trending.data, settings.region) : []),
    [trending, settings.region],
  )
  const savedRefs = useMemo(() => new Set(liveItems(doc).map((i) => i.ref).filter(Boolean)), [doc])

  // One deck: everything saved and not done yet, plus today's ten that are not already on the list.
  const pool = useMemo(
    () => [...saved, ...ten.filter((t) => !savedRefs.has(t.id)).map(trendToItem)],
    [saved, ten, savedRefs],
  )
  const deck = pool.filter((i) => !off.has(i.kind))
  const savedInDeck = deck.filter((i) => i.source === 'saved').length
  const counts = KINDS.map((k) => ({ kind: k, n: pool.filter((i) => i.kind === k).length })).filter((c) => c.n > 0)

  const toggle = (k: Kind) =>
    setOff((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const summary =
    deck.length === 0
      ? 'Destede seçenek yok.'
      : `Destede ${deck.length} seçenek: ${savedInDeck} listenizden, ${deck.length - savedInDeck} bu hafta revaçta.`

  return (
    <div className="page">
      <header className="title">
        <div>
          <h1>Bugün</h1>
          <p className="title__sub">{summary}</p>
        </div>
      </header>

      <div className="grid-today">
        <section className="panel start" aria-label="Deste">
          <div className="ladder" aria-hidden>
            <span className="ladder__step ladder__step--on"><b className="num">{deck.length}</b> seçenek</span>
            <span className="ladder__bar" />
            <span className="ladder__step">Olur</span>
            <span className="ladder__bar" />
            <span className="ladder__step">O mu, bu mu</span>
            <span className="ladder__bar" />
            <span className="ladder__step"><b className="num">1</b> plan</span>
          </div>
          <button className="btn btn--primary btn--big" disabled={deck.length === 0} onClick={() => onStart(shuffle(deck))}>
            Bugün için ne yapmak istediğinizi bulun
          </button>
          {counts.length > 0 && (
            <div className="chips" role="group" aria-label="Desteye girecek türler">
              {counts.map(({ kind, n }) => (
                <button key={kind} className="chip" aria-pressed={!off.has(kind)} onClick={() => toggle(kind)}>
                  {KIND_LABEL[kind]} <span className="num chip__n">{n}</span>
                </button>
              ))}
            </div>
          )}
          {deck.length === 0 && pool.length > 0 && <p className="hint">Bütün türler kapalı. En az birini açın.</p>}
        </section>

        <section className="block trend">
          <header className="block__head">
            <h2>Bu hafta revaçta</h2>
            {trending.status === 'ready' && (
              <label className="select select--quiet">
                <span className="sr">Etkinlik şehri</span>
                <select value={settings.region} onChange={(e) => updateSettings({ region: e.target.value })}>
                  {Object.entries(trending.data.regions).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </label>
            )}
          </header>
          {trending.status === 'loading' && (
            <div className="rows" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <div className="row row--loading" key={i}><span className="row__media" /><div className="row__text"><span className="bar bar--w60" /><span className="bar bar--w40" /></div></div>
              ))}
            </div>
          )}
          {trending.status === 'error' && (
            <p className="empty">Revaçta olanlar yüklenemedi. Listenizdekilerle devam edebilirsiniz.</p>
          )}
          {trending.status === 'ready' && ten.length === 0 && (
            <p className="empty">Bu şehir için bu hafta kayıtlı etkinlik yok.</p>
          )}
          {trending.status === 'ready' && ten.length > 0 && (
            <>
              <div className="rows">
                {ten.map((t) => {
                  const isSaved = savedRefs.has(t.id)
                  return (
                    <ItemRow
                      key={t.id}
                      item={t}
                      trailing={
                        <button className="btn btn--ghost btn--small" disabled={isSaved} onClick={() => saveTrending(t)}>
                          {isSaved ? 'Listede' : 'Kaydet'}
                        </button>
                      }
                    />
                  )
                })}
              </div>
              <p className="foot">Güncellendi: {stamp(trending.data.updatedAt)}. Her gün haftanın havuzundan on tanesi gelir.</p>
            </>
          )}
        </section>

        <aside className="aside">
          <section className="block">
            <header className="block__head">
              <h2>Listenizden</h2>
              <a className="link" href="#/liste">Tümü <span className="num">{saved.length}</span></a>
            </header>
            {saved.length === 0 ? (
              <p className="empty">Liste boş. <a className="link" href="#/liste">İlk fikri ekleyin</a></p>
            ) : (
              <div className="rows">
                {saved.slice(0, 5).map((i) => <ItemRow key={i.id} item={i} />)}
              </div>
            )}
          </section>

          <section className="block">
            <header className="block__head"><h2>Son seçimler</h2></header>
            {doc.history.length === 0 ? (
              <p className="empty">Henüz birlikte seçim yapmadınız.</p>
            ) : (
              <ul className="kv">
                {doc.history.slice(0, 4).map((w) => (
                  <li key={w.id}>
                    <span className="kv__k">{w.title}</span>
                    <span className="kv__v">{KIND_LABEL[w.kind]} · {ago(w.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
