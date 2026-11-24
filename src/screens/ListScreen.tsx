import { useMemo, useState } from 'react'
import { useSyncStatus } from '../App'
import { AddSheet } from '../components/AddSheet'
import { Cover } from '../components/Cover'
import { IconChevron, IconOut, IconPlus } from '../components/Icons'
import { subline } from '../components/ItemRow'
import { ago, stamp } from '../lib/format'
import { liveItems, patchItem, removeItem, useStore } from '../lib/store'
import { planFor } from '../lib/venues'
import { KIND_LABEL, SAVABLE_KINDS, type Item, type Kind } from '../lib/types'

type Filter = 'all' | Kind | 'done'

export function syncLine(status: ReturnType<typeof useSyncStatus>): string {
  switch (status.state) {
    case 'syncing':
      return 'Eşitleniyor'
    case 'idle':
      return `İki telefonda ortak · eşitlendi ${stamp(status.at)}`
    case 'readonly':
      return 'Eklediğiniz fikirler yalnızca bu telefonda. Ortak liste için Ayarlar’dan anahtar girin.'
    case 'error':
      return status.message
    default:
      return 'Yalnızca bu cihazda'
  }
}

export function ListScreen() {
  const { doc } = useStore()
  const status = useSyncStatus()
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const items = useMemo(() => liveItems(doc), [doc])
  const active = items.filter((i) => !i.doneAt)
  const done = items.filter((i) => i.doneAt)

  const tabs: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'Tümü', n: active.length },
    ...SAVABLE_KINDS.map((k) => ({ id: k as Filter, label: KIND_LABEL[k], n: active.filter((i) => i.kind === k).length })),
    ...(active.some((i) => i.kind === 'event') ? [{ id: 'event' as Filter, label: KIND_LABEL.event, n: active.filter((i) => i.kind === 'event').length }] : []),
    { id: 'done', label: 'Yapıldı', n: done.length },
  ]
  const shown = filter === 'all' ? active : filter === 'done' ? done : active.filter((i) => i.kind === filter)
  const addKind: Kind = SAVABLE_KINDS.includes(filter as Kind) ? (filter as Kind) : 'activity'

  return (
    <div className="page page--narrow">
      <header className="title">
        <div>
          <h1>Liste</h1>
          <p className={`title__sub${status.state === 'error' ? ' title__sub--bad' : ''}`}>{syncLine(status)}</p>
        </div>
        <button className="btn btn--primary" onClick={() => setAdding(true)}><IconPlus /> Ekle</button>
      </header>

      <div className="tabs" role="tablist" aria-label="Tür">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={filter === t.id} className="tab" onClick={() => setFilter(t.id)}>
            {t.label} <span className="num tab__n">{t.n}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="empty">
          {filter === 'done'
            ? 'Yaptıklarınız burada birikir.'
            : filter === 'all'
              ? 'Liste boş. Yapmak istediğiniz bir şeyi, gitmek istediğiniz bir yeri, izleyeceğiniz bir filmi ekleyin.'
              : `Bu türde kayıt yok.`}{' '}
          {filter !== 'done' && <button className="link" onClick={() => setAdding(true)}>Ekle</button>}
        </p>
      ) : (
        <ul className="rows rows--list">
          {shown.map((item) => (
            <ListRow key={item.id} item={item} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} />
          ))}
        </ul>
      )}

      {adding && <AddSheet initialKind={addKind} onClose={() => setAdding(false)} />}
    </div>
  )
}

function ListRow({ item, open, onToggle }: { item: Item; open: boolean; onToggle: () => void }) {
  const map = planFor(item).links[0]
  const added = [item.addedBy ? `${item.addedBy} ekledi` : '', ago(item.createdAt)].filter(Boolean).join(' · ')
  return (
    <li className={`item${open ? ' item--open' : ''}`}>
      <button className="row row--button" aria-expanded={open} onClick={onToggle}>
        <Cover src={item.image} title={item.title} className="row__media" />
        <span className="row__text">
          <span className="row__title">{item.title}</span>
          <span className="row__sub">{subline(item)}</span>
        </span>
        <span className="row__trail"><IconChevron open={open} /></span>
      </button>
      {open && (
        <div className="item__more">
          {item.note && <p className="item__note">{item.note}</p>}
          <p className="item__meta">{item.doneAt ? `Yapıldı: ${ago(item.doneAt)} · ` : ''}{added}</p>
          <div className="item__actions">
            {item.doneAt ? (
              <button className="btn btn--ghost btn--small" onClick={() => patchItem(item.id, { doneAt: undefined })}>Listeye geri al</button>
            ) : (
              <button className="btn btn--ghost btn--small" onClick={() => patchItem(item.id, { doneAt: Date.now() })}>Yaptık</button>
            )}
            {map && item.kind !== 'series' && (
              <a className="btn btn--ghost btn--small" href={map.url} target="_blank" rel="noreferrer">Haritada aç <IconOut /></a>
            )}
            {item.url && (
              <a className="btn btn--ghost btn--small" href={item.url} target="_blank" rel="noreferrer">Ayrıntı <IconOut /></a>
            )}
            <button className="btn btn--text btn--small btn--danger" onClick={() => removeItem(item.id)}>Sil</button>
          </div>
        </div>
      )}
    </li>
  )
}
