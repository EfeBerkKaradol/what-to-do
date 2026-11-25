import { useSyncExternalStore } from 'react'
import { emptyDoc, normalizeDoc } from './merge'
import type { Doc, Item, Kind, Settings, TrendEntry, Win } from './types'

const DOC_KEY = 'wtd.doc.v1'
const SETTINGS_KEY = 'wtd.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  names: ['', ''],
  me: 0,
  region: 'ANKARA',
  shared: { bin: 'aefacfc' },
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode or a full disk: the session still works in memory */
  }
}

interface State {
  doc: Doc
  settings: Settings
}

// Only the fields this version knows are taken over; an older build kept a GitHub token here.
// A stored city counts only if it was picked by hand: earlier builds wrote the old default
// (İstanbul) to storage on the first sync, without anyone choosing it.
const { names, me, region, regionChosen, lastSync, deckSize } = read<Partial<Settings>>(SETTINGS_KEY, {})
const storedSettings: Partial<Settings> = JSON.parse(
  JSON.stringify({ names, me, lastSync, deckSize, ...(regionChosen ? { region, regionChosen } : {}) }),
)
let state: State = {
  doc: normalizeDoc(read<unknown>(DOC_KEY, emptyDoc())),
  settings: {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
  },
}

const listeners = new Set<() => void>()
const docListeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function getState(): State {
  return state
}

export function useStore(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getState,
  )
}

/** Fires only for local edits to the list, which is what should trigger a sync. */
export function onLocalChange(cb: () => void): () => void {
  docListeners.add(cb)
  return () => docListeners.delete(cb)
}

/** Replaces the document without counting as a local edit (used after a merge with the remote). */
export function replaceDoc(doc: Doc) {
  state = { ...state, doc }
  write(DOC_KEY, doc)
  emit()
}

function editDoc(next: Doc) {
  state = { ...state, doc: next }
  write(DOC_KEY, next)
  emit()
  for (const l of docListeners) l()
}

export function updateSettings(patch: Partial<Settings>) {
  state = { ...state, settings: { ...state.settings, ...patch, ...(patch.region ? { regionChosen: true } : {}) } }
  write(SETTINGS_KEY, state.settings)
  emit()
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export function myName(): string | undefined {
  const { names, me } = state.settings
  return names[me]?.trim() || undefined
}

export interface NewItem {
  kind: Kind
  title: string
  note?: string
  image?: string
  venue?: string
  city?: string
  url?: string
  meta?: string
  when?: string
  ref?: string
}

export function addItem(input: NewItem): Item {
  const now = Date.now()
  const item: Item = {
    ...input,
    title: input.title.trim(),
    id: uid(),
    source: 'saved',
    addedBy: myName(),
    createdAt: now,
    updatedAt: now,
  }
  editDoc({ ...state.doc, items: [item, ...state.doc.items] })
  return item
}

export function saveTrending(entry: TrendEntry): Item {
  const existing = state.doc.items.find((i) => i.ref === entry.id && !i.deleted)
  if (existing) return existing
  // The long description stays in the catalogue; the shared list has little room.
  const { id, about: _about, ...rest } = entry
  return addItem({ ...rest, ref: id })
}

export function patchItem(id: string, patch: Partial<Item>) {
  editDoc({
    ...state.doc,
    items: state.doc.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)),
  })
}

export function removeItem(id: string) {
  patchItem(id, { deleted: true })
}

export function recordWin(item: Item) {
  const win: Win = { id: uid(), title: item.title, kind: item.kind, at: Date.now() }
  editDoc({ ...state.doc, history: [win, ...state.doc.history].slice(0, 50) })
}

export function liveItems(doc: Doc): Item[] {
  return doc.items.filter((i) => !i.deleted)
}
