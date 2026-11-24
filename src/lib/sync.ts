import { emptyDoc, fingerprint, mergeDocs, normalizeDoc } from './merge'
import { getState, onLocalChange, replaceDoc, updateSettings } from './store'
import type { Doc } from './types'

// One shared list for everyone who opens the site: a single JSON document in an
// anonymous, keyless store. Anyone with the link reads and writes the same list.
// The store is a stop-gap; swapping it means replacing pull() and push() below.
const STORE = 'https://extendsclass.com/api/json-storage/bin'
/** The store refuses documents a little under 95 kB. */
const MAX_BYTES = 85_000
const TOMBSTONE_DAYS = 30

export type SyncStatus =
  | { state: 'off' }
  | { state: 'idle'; at?: number }
  | { state: 'syncing' }
  | { state: 'error'; message: string }

let status: SyncStatus = { state: 'off' }
const listeners = new Set<() => void>()

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSync(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function setStatus(next: SyncStatus) {
  status = next
  for (const l of listeners) l()
}

class SyncError extends Error {}

function endpoint(bin: string) {
  return `${STORE}/${encodeURIComponent(bin)}`
}

async function pull(bin: string): Promise<Doc> {
  const res = await fetch(`${endpoint(bin)}?t=${Date.now()}`, { cache: 'no-store' })
  if (res.status === 404) return emptyDoc()
  if (!res.ok) throw new SyncError(`Ortak liste okunamadı (${res.status}).`)
  // The store appends a page of its own markup after the JSON; keep only the document.
  const text = await res.text()
  const cut = text.search(/<!doctype|<html/i)
  try {
    return normalizeDoc(JSON.parse(cut >= 0 ? text.slice(0, cut) : text))
  } catch {
    throw new SyncError('Ortak liste dosyası okunamıyor.')
  }
}

async function push(bin: string, doc: Doc): Promise<void> {
  const body = JSON.stringify(doc)
  if (new Blob([body]).size > MAX_BYTES) {
    throw new SyncError('Ortak liste doldu. Yapılanları ya da eski kayıtları silin.')
  }
  const res = await fetch(endpoint(bin), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })
  if (!res.ok) throw new SyncError(`Ortak liste kaydedilemedi (${res.status}).`)
}

/** Deletes are kept as markers so they reach every device; after a month they are dropped. */
function compact(doc: Doc): Doc {
  const cutoff = Date.now() - TOMBSTONE_DAYS * 86400000
  return { ...doc, items: doc.items.filter((i) => !i.deleted || i.updatedAt > cutoff), history: doc.history.slice(0, 20) }
}

let running: Promise<void> | null = null
let queued = false

export function syncNow(): Promise<void> {
  if (running) {
    queued = true
    return running
  }
  running = run().finally(() => {
    running = null
    if (queued) {
      queued = false
      void syncNow()
    }
  })
  return running
}

async function run(): Promise<void> {
  const bin = getState().settings.shared.bin
  if (!bin) {
    setStatus({ state: 'off' })
    return
  }
  setStatus({ state: 'syncing' })
  try {
    // Read, merge item by item, write back. The store has no version check, so if two
    // people write in the same second one write wins; the loser still holds its items
    // and puts them back on its next sync.
    const remote = await pull(bin)
    const merged = compact(mergeDocs(getState().doc, remote))
    if (fingerprint(merged) !== fingerprint(getState().doc)) replaceDoc(merged)
    if (fingerprint(merged) !== fingerprint(remote)) await push(bin, merged)
    const at = Date.now()
    updateSettings({ lastSync: at })
    setStatus({ state: 'idle', at })
  } catch (err) {
    setStatus({
      state: 'error',
      message: err instanceof SyncError ? err.message : 'Bağlantı kurulamadı. Değişiklikler bu cihazda duruyor.',
    })
  }
}

let started = false

/** Sync on start, when the tab comes back, and shortly after each local edit. */
export function startAutoSync() {
  if (started) return
  started = true
  let timer: ReturnType<typeof setTimeout> | undefined
  onLocalChange(() => {
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), 1200)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  void syncNow()
}
