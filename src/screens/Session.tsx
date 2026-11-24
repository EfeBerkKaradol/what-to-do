import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Cover } from '../components/Cover'
import { IconClose, IconOut, IconUndo } from '../components/Icons'
import { ItemRow } from '../components/ItemRow'
import { eventWhen } from '../lib/format'
import { patchItem, recordWin, saveTrending, useStore } from '../lib/store'
import { pick, remaining, shuffle, startBracket, type Bracket } from '../lib/tournament'
import { KIND_LABEL, type Item, type Kind } from '../lib/types'
import { locate, mapsSearch, nearbyVenues, planFor, type Suggestion } from '../lib/venues'

type Phase = 'ready' | 'swipe' | 'duel' | 'result' | 'none'

const KINDS: Kind[] = ['activity', 'place', 'movie', 'series', 'event']

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function details(item: Item): string {
  const parts: string[] = []
  if (item.kind === 'event') {
    if (item.when) parts.push(eventWhen(item.when))
    if (item.venue) parts.push(item.venue)
  } else {
    if (item.meta) parts.push(item.meta)
    if (item.venue) parts.push(item.venue)
  }
  return parts.join(' · ')
}

function origin(item: Item): string {
  if (item.source === 'trending') return 'Bu hafta revaçta'
  if (item.ref) return 'Beğendiklerinizden'
  return item.addedBy ? `Eklediklerinizden · ${item.addedBy} ekledi` : 'Eklediklerinizden'
}

export function Session({ pool, onClose }: { pool: Item[]; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [deck, setDeck] = useState<Item[]>([])
  const [decisions, setDecisions] = useState<boolean[]>([])
  const [bracket, setBracket] = useState<Bracket<Item> | null>(null)
  const [winner, setWinner] = useState<Item | null>(null)

  const index = decisions.length
  const liked = useMemo(() => deck.filter((_, i) => decisions[i]), [deck, decisions])

  const crown = useCallback((item: Item) => {
    recordWin(item)
    setWinner(item)
    setPhase('result')
  }, [])

  const decide = useCallback(
    (like: boolean) => {
      const next = [...decisions, like]
      setDecisions(next)
      if (next.length < deck.length) return
      const chosen = deck.filter((_, i) => next[i])
      if (chosen.length === 0) setPhase('none')
      else if (chosen.length === 1) crown(chosen[0])
      else {
        setBracket(startBracket(chosen))
        setPhase('duel')
      }
    },
    [decisions, deck, crown],
  )

  const choose = useCallback(
    (side: 0 | 1) => {
      if (!bracket) return
      const next = pick(bracket, side)
      setBracket(next)
      if (next.champion) crown(next.champion)
    },
    [bracket, crown],
  )

  const begin = (chosen: Item[]) => {
    setDeck(shuffle(chosen))
    setDecisions([])
    setBracket(null)
    setWinner(null)
    setPhase('swipe')
  }

  const restart = () => {
    setDecisions([])
    setBracket(null)
    setWinner(null)
    setPhase('swipe')
  }

  const left = phase === 'swipe' ? deck.length - index : phase === 'duel' && bracket ? remaining(bracket) : phase === 'result' ? 1 : 0
  const heading = { ready: '', swipe: 'Deste', duel: 'O mu, bu mu?', result: 'Bugünün planı', none: 'Deste bitti' }[phase]
  const progress =
    phase === 'swipe' ? index / Math.max(1, deck.length) : phase === 'duel' && bracket ? bracket.played / Math.max(1, bracket.total) : 1

  return (
    <div className={`session session--${phase}`}>
      <header className="session__head">
        <button className="icon-btn" aria-label="Kapat ve ana ekrana dön" onClick={onClose}><IconClose /></button>
        <div className="session__title">
          {phase !== 'ready' && <h1>{heading}</h1>}
          <p className="num" aria-live="polite">
            {phase === 'swipe' && `${Math.min(index + 1, deck.length)} / ${deck.length} · ${liked.length} olur`}
            {phase === 'duel' && bracket && `${bracket.round}. tur · ${left} seçenek kaldı`}
            {phase === 'result' && `${deck.length} seçenekten ${liked.length} olur, 1 kazanan`}
            {phase === 'none' && `${deck.length} seçeneğin hiçbirine olur demediniz`}
          </p>
        </div>
        {phase === 'swipe' ? (
          <button className="icon-btn" aria-label="Son kararı geri al" disabled={index === 0} onClick={() => setDecisions(decisions.slice(0, -1))}>
            <IconUndo />
          </button>
        ) : (
          <span className="icon-btn icon-btn--spacer" />
        )}
      </header>
      <div className="track" aria-hidden><span style={{ transform: `scaleX(${phase === 'ready' ? 0 : progress})` }} /></div>

      {phase === 'ready' && <ReadyStage pool={pool} onBegin={begin} onClose={onClose} />}

      {phase === 'swipe' && index < deck.length && (
        <SwipeStage key={deck[index].id} item={deck[index]} next={deck[index + 1]} onDecide={decide} />
      )}
      {phase === 'duel' && bracket?.pair && (
        <DuelStage key={`${bracket.played}`} pair={bracket.pair} onChoose={choose} />
      )}
      {phase === 'result' && winner && (
        <ResultStage winner={winner} others={liked.filter((i) => i.id !== winner.id)} onRestart={restart} onClose={onClose} />
      )}
      {phase === 'none' && (
        <div className="session__body session__body--center">
          <p className="empty empty--plain">Bugün hiçbiri cazip gelmedi. Desteyi baştan kaydırabilir ya da listeye yeni bir fikir ekleyebilirsiniz.</p>
          <div className="stack">
            <button className="btn btn--primary btn--big" onClick={restart}>Baştan kaydır</button>
            <button className="btn btn--ghost btn--big" onClick={onClose}>Ana ekrana dön</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReadyStage({ pool, onBegin, onClose }: { pool: Item[]; onBegin: (deck: Item[]) => void; onClose: () => void }) {
  const [off, setOff] = useState<Set<Kind>>(new Set())
  const deck = pool.filter((i) => !off.has(i.kind))
  const mine = deck.filter((i) => i.source === 'saved').length
  const counts = KINDS.map((kind) => ({ kind, n: pool.filter((i) => i.kind === kind).length })).filter((c) => c.n > 0)

  const toggle = (k: Kind) =>
    setOff((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  return (
    <div className="session__body session__body--center ready">
      <div className="ready__text">
        <h1 className="ready__title">Hazır mısınız?</h1>
        <p className="ready__sub">
          {pool.length === 0
            ? 'Destede henüz seçenek yok. Önce bir şeyler ekleyin ya da beğenin.'
            : deck.length === 0
              ? 'Bütün türler kapalı. En az birini açın.'
              : `${deck.length} seçenek bekliyor: ${mine} sizden, ${deck.length - mine} bu hafta revaçta. Sağa olur, sola geç; sonra kalanlar ikişer ikişer karşılaşır.`}
        </p>
      </div>
      {counts.length > 0 && (
        <div className="chips chips--center" role="group" aria-label="Desteye girecek türler">
          {counts.map(({ kind, n }) => (
            <button key={kind} className="chip" aria-pressed={!off.has(kind)} onClick={() => toggle(kind)}>
              {KIND_LABEL[kind]} <span className="num chip__n">{n}</span>
            </button>
          ))}
        </div>
      )}
      <div className="stack">
        <button className="btn btn--primary btn--big" disabled={deck.length === 0} onClick={() => onBegin(deck)}>Hazırız</button>
        <button className="btn btn--text" onClick={onClose}>Şimdi değil</button>
      </div>
    </div>
  )
}

function BigCard({ item }: { item: Item }) {
  const info = details(item)
  return (
    <>
      {item.image ? <Cover src={item.image} title={item.title} className="card__img" /> : null}
      <div className={`card__text${item.image ? ' card__text--over' : ''}`}>
        <span className="pill">{item.kind === 'event' ? item.meta?.split(' · ')[0] || KIND_LABEL.event : KIND_LABEL[item.kind]}</span>
        <h2 className="card__title">{item.title}</h2>
        {info && <p className="card__info">{info}</p>}
        {item.note && <p className="card__note">{item.note}</p>}
        <p className="card__origin">{origin(item)}</p>
      </div>
    </>
  )
}

function SwipeStage({ item, next, onDecide }: { item: Item; next?: Item; onDecide: (like: boolean) => void }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const [exit, setExit] = useState<null | 'left' | 'right'>(null)
  const start = useRef({ x: 0, y: 0, t: 0 })
  const done = useRef(false)

  const leave = useCallback(
    (dir: 'left' | 'right') => {
      if (done.current) return
      done.current = true
      setExit(dir)
      window.setTimeout(() => onDecide(dir === 'right'), reducedMotion() ? 0 : 190)
    },
    [onDecide],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') leave('right')
      if (e.key === 'ArrowLeft') leave('left')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leave])

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (exit) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    setDrag({ x: 0, y: 0, active: true })
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.active || exit) return
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true })
  }
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.active || exit) return
    const dx = e.clientX - start.current.x
    const speed = Math.abs(dx) / Math.max(1, e.timeStamp - start.current.t)
    if (Math.abs(dx) > 96 || (Math.abs(dx) > 36 && speed > 0.6)) leave(dx > 0 ? 'right' : 'left')
    else setDrag({ x: 0, y: 0, active: false })
  }

  const lean = Math.max(-1, Math.min(1, drag.x / 110))
  const transform = exit
    ? `translate(${exit === 'right' ? 130 : -130}%, ${drag.y * 0.4}px) rotate(${exit === 'right' ? 16 : -16}deg)`
    : `translate(${drag.x}px, ${drag.y * 0.35}px) rotate(${drag.x / 22}deg)`

  return (
    <div className="session__body">
      <div className="deck">
        {next && (
          <div className="card card--under" aria-hidden>
            <BigCard item={next} />
          </div>
        )}
        <div
          className={`card card--top${drag.active ? ' card--dragging' : ''}${exit ? ' card--exit' : ''}`}
          style={{ transform }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setDrag({ x: 0, y: 0, active: false })}
        >
          <BigCard item={item} />
          <span className="stamp stamp--yes" style={{ opacity: exit === 'right' ? 1 : Math.max(0, lean) }}>Olur</span>
          <span className="stamp stamp--no" style={{ opacity: exit === 'left' ? 1 : Math.max(0, -lean) }}>Geç</span>
        </div>
      </div>
      <div className="verdict">
        <button className="btn btn--ghost btn--big" onClick={() => leave('left')}>Geç</button>
        <button className="btn btn--primary btn--big" onClick={() => leave('right')}>Olur</button>
      </div>
    </div>
  )
}

function DuelStage({ pair, onChoose }: { pair: [Item, Item]; onChoose: (side: 0 | 1) => void }) {
  const [picked, setPicked] = useState<0 | 1 | null>(null)
  const choose = useCallback(
    (side: 0 | 1) => {
      if (picked !== null) return
      setPicked(side)
      window.setTimeout(() => onChoose(side), reducedMotion() ? 0 : 260)
    },
    [picked, onChoose],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === '1') choose(0)
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === '2') choose(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose])

  return (
    <div className="session__body">
      <div className="duel">
        {pair.map((item, i) => (
          <button
            key={item.id}
            className={`card card--choice${picked === i ? ' card--won' : ''}${picked !== null && picked !== i ? ' card--lost' : ''}`}
            onClick={() => choose(i as 0 | 1)}
          >
            <BigCard item={item} />
          </button>
        ))}
        <span className="duel__or" aria-hidden>ya da</span>
      </div>
    </div>
  )
}

type Nearby =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; rows: Suggestion[]; here: { lat: number; lon: number } }
  | { state: 'denied' }
  | { state: 'error'; here?: { lat: number; lon: number } }

function ResultStage({ winner, others, onRestart, onClose }: { winner: Item; others: Item[]; onRestart: () => void; onClose: () => void }) {
  const { doc } = useStore()
  const plan = useMemo(() => planFor(winner), [winner])
  const [nearby, setNearby] = useState<Nearby>({ state: 'idle' })
  const canLookUp = Boolean(plan.phrase || plan.query)

  const savedCopy = winner.source === 'trending' ? doc.items.find((i) => i.ref === winner.id && !i.deleted) : doc.items.find((i) => i.id === winner.id)
  const isDone = Boolean(savedCopy?.doneAt)

  const findNearby = async () => {
    if (!plan.phrase && !plan.query) return
    setNearby({ state: 'loading' })
    let here: { lat: number; lon: number }
    try {
      here = await locate()
    } catch {
      setNearby({ state: 'denied' })
      return
    }
    try {
      setNearby({ state: 'ready', rows: await nearbyVenues(plan, here), here })
    } catch {
      setNearby({ state: 'error', here })
    }
  }

  const markDone = () => {
    const target = savedCopy ?? (winner.source === 'trending' ? saveTrending(winner) : null)
    if (target) patchItem(target.id, { doneAt: Date.now() })
  }

  return (
    <div className="session__body session__body--scroll">
      <div className="result">
        <article className="card card--winner">
          <BigCard item={winner} />
        </article>

        <div className="result__side">
          <section className="block">
            <header className="block__head"><h2>{plan.heading}</h2></header>
            <ul className="places">
              {plan.links.map((s) => <PlaceRow key={s.url} s={s} />)}
              {nearby.state === 'ready' && nearby.rows.map((s) => <PlaceRow key={s.url} s={s} />)}
            </ul>
            {canLookUp && nearby.state === 'idle' && (
              <button className="btn btn--ghost" onClick={findNearby}>Yakınımdaki mekanları adıyla göster</button>
            )}
            {nearby.state === 'loading' && <p className="hint" role="status">Yakındaki mekanlar aranıyor</p>}
            {nearby.state === 'ready' && nearby.rows.length === 0 && (
              <p className="hint">Yakında adıyla kayıtlı mekan bulunamadı. Üstteki bağlantı Google Haritalar'da arar.</p>
            )}
            {nearby.state === 'denied' && <p className="hint">Konum izni verilmedi. Üstteki bağlantı Google Haritalar'da kendi konumunuzla arar.</p>}
            {nearby.state === 'error' && (
              <p className="hint">
                Mekan listesi şu an alınamadı.{' '}
                {nearby.here && plan.query && (
                  <a className="link" href={mapsSearch(plan.query, nearby.here)} target="_blank" rel="noreferrer">Bu bölgede haritada ara</a>
                )}
              </p>
            )}
            {canLookUp && nearby.state === 'idle' && (
              <p className="hint">Konumunuz yalnızca bu arama için, yaklaşık 100 m hassasiyetle OpenStreetMap'e gönderilir.</p>
            )}
          </section>

          <div className="result__actions">
            {winner.url && (
              <a className="btn btn--ghost" href={winner.url} target="_blank" rel="noreferrer">
                {winner.kind === 'event' ? 'Bilet ve ayrıntı' : 'Ayrıntı'} <IconOut />
              </a>
            )}
            {winner.source === 'trending' && !savedCopy && (
              <button className="btn btn--ghost" onClick={() => saveTrending(winner)}>Listeye kaydet</button>
            )}
            <button className="btn btn--ghost" disabled={isDone} onClick={markDone}>{isDone ? 'Yapıldı olarak işaretlendi' : 'Yaptık'}</button>
          </div>

          {others.length > 0 && (
            <section className="block">
              <header className="block__head"><h2>Olmazsa sıradakiler</h2></header>
              <div className="rows">
                {others.slice(0, 3).map((i) => <ItemRow key={i.id} item={i} />)}
              </div>
            </section>
          )}

          <div className="stack">
            <button className="btn btn--primary btn--big" onClick={onClose}>Tamam</button>
            <button className="btn btn--text" onClick={onRestart}>Baştan seç</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlaceRow({ s }: { s: Suggestion }) {
  return (
    <li>
      <a className="place" href={s.url} target="_blank" rel="noreferrer">
        <span className="place__text">
          <span className="place__name">{s.label}</span>
          {s.detail && <span className="place__detail">{s.detail}</span>}
        </span>
        <span className="place__go">Haritada aç <IconOut /></span>
      </a>
    </li>
  )
}
