export type Kind = 'activity' | 'place' | 'movie' | 'series' | 'event'

export interface Item {
  id: string
  kind: Kind
  title: string
  note?: string
  image?: string
  /** Place name or address (places, events). */
  venue?: string
  city?: string
  /** ISO date-time, events only. */
  when?: string
  url?: string
  /** Short secondary line: genre, year, channel. */
  meta?: string
  source: 'saved' | 'trending'
  /** Id of the trending entry a saved item came from. */
  ref?: string
  addedBy?: string
  createdAt: number
  updatedAt: number
  doneAt?: number
  /** Tombstone so a delete survives a merge with the other phone. */
  deleted?: boolean
}

export interface Win {
  id: string
  title: string
  kind: Kind
  at: number
}

export interface Doc {
  version: 1
  items: Item[]
  history: Win[]
}

export interface Settings {
  names: [string, string]
  /** Which of the two names this device belongs to. */
  me: 0 | 1
  region: string
  /** Id of the shared list document that every visitor reads and writes. */
  shared: { bin: string }
  lastSync?: number
}

export interface TrendEntry {
  id: string
  kind: Kind
  title: string
  image?: string
  venue?: string
  city?: string
  when?: string
  url?: string
  meta?: string
  note?: string
}

export interface Trending {
  updatedAt: string
  regions: Record<string, string>
  sources: Record<string, string>
  events: Record<string, TrendEntry[]>
  movies: TrendEntry[]
  series: TrendEntry[]
}

export const KIND_LABEL: Record<Kind, string> = {
  activity: 'Aktivite',
  place: 'Mekan',
  movie: 'Film',
  series: 'Dizi',
  event: 'Etkinlik',
}

export const SAVABLE_KINDS: Kind[] = ['activity', 'place', 'movie', 'series']
