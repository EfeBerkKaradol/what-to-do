import type { ReactNode } from 'react'
import { eventWhen } from '../lib/format'
import { KIND_LABEL, type Item, type TrendEntry } from '../lib/types'
import { Cover } from './Cover'

export function subline(item: Item | TrendEntry, withKind = true): string {
  const parts: string[] = []
  if (item.kind === 'event') {
    // Events carry their own type in meta ("Konser · pop"): the first word is more telling than "Etkinlik".
    if (withKind) parts.push(item.meta?.split(' · ')[0] || KIND_LABEL.event)
    if (item.when) parts.push(eventWhen(item.when))
    if (item.venue) parts.push(item.venue)
  } else {
    if (withKind) parts.push(KIND_LABEL[item.kind])
    if (item.meta) parts.push(item.meta)
    if (item.venue) parts.push(item.venue)
  }
  return parts.join(' · ')
}

/** Two-line row with one fixed media slot, so every title starts on the same edge. */
export function ItemRow({ item, sub, trailing }: { item: Item | TrendEntry; sub?: string; trailing?: ReactNode }) {
  return (
    <div className="row">
      <Cover src={item.image} title={item.title} className="row__media" />
      <div className="row__text">
        <span className="row__title">{item.title}</span>
        <span className="row__sub">{sub ?? subline(item)}</span>
      </div>
      {trailing && <div className="row__trail">{trailing}</div>}
    </div>
  )
}
