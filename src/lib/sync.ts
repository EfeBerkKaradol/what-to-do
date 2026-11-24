import { emptyDoc, fingerprint, mergeDocs, normalizeDoc } from './merge'
import { getState, onLocalChange, replaceDoc, updateSettings } from './store'
import type { Doc, Settings } from './types'

// The list lives in the GitHub repository itself: one JSON file on a separate branch,
// read and written through the Contents API. No other backend.
const FILE = 'list.json'

export type SyncStatus =
  | { state: 'off' }
  | { state: 'idle'; at?: number }
  | { state: 'syncing' }
  | { state: 'readonly'; at?: number }
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

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function endpoint(s: Settings['sync']) {
  return `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${FILE}`
}

function headers(s: Settings['sync']): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (s.token) h.Authorization = `Bearer ${s.token}`
  return h
}

class SyncError extends Error {}

async function pull(s: Settings['sync']): Promise<{ doc: Doc; sha?: string }> {
  const res = await fetch(`${endpoint(s)}?ref=${encodeURIComponent(s.branch)}&t=${Date.now()}`, {
    headers: headers(s),
    cache: 'no-store',
  })
  if (res.status === 404) return { doc: emptyDoc() }
  if (res.status === 401) throw new SyncError('Anahtar geçersiz ya da süresi dolmuş.')
  if (res.status === 403) throw new SyncError('GitHub şu an isteği reddetti (saatlik sınır). Biraz sonra yeniden deneyin.')
  if (!res.ok) throw new SyncError(`Liste okunamadı (${res.status}).`)
  const body = (await res.json()) as { content?: string; sha?: string }
  try {
    return { doc: normalizeDoc(JSON.parse(fromBase64(body.content ?? ''))), sha: body.sha }
  } catch {
    throw new SyncError('Depodaki liste dosyası okunamıyor.')
  }
}

async function push(s: Settings['sync'], doc: Doc, sha?: string): Promise<'ok' | 'conflict'> {
  const res = await fetch(endpoint(s), {
    method: 'PUT',
    headers: { ...headers(s), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Liste güncellendi',
      branch: s.branch,
      content: toBase64(JSON.stringify(doc, null, 1) + '\n'),
      ...(sha ? { sha } : {}),
    }),
  })
  if (res.status === 409 || res.status === 422) return 'conflict'
  if (res.status === 401) throw new SyncError('Anahtar geçersiz ya da süresi dolmuş.')
  if (res.status === 403 || res.status === 404) throw new SyncError('Anahtarın bu depoya yazma izni yok.')
  if (!res.ok) throw new SyncError(`Liste kaydedilemedi (${res.status}).`)
  return 'ok'
}

let running: Promise<void> | null = null
let queued = false

export function syncConfigured(s: Settings['sync'] = getState().settings.sync): boolean {
  return Boolean(s.owner && s.repo && s.branch)
}

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
  const s = getState().settings.sync
  if (!syncConfigured(s)) {
    setStatus({ state: 'off' })
    return
  }
  setStatus({ state: 'syncing' })
  try {
    // Two attempts: if the other phone wrote between our read and our write, read again and merge.
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await pull(s)
      const merged = mergeDocs(getState().doc, remote.doc)
      if (fingerprint(merged) !== fingerprint(getState().doc)) replaceDoc(merged)
      if (fingerprint(merged) === fingerprint(remote.doc)) break
      if (!s.token) {
        setStatus({ state: 'readonly', at: Date.now() })
        return
      }
      if ((await push(s, merged, remote.sha)) === 'ok') break
      if (attempt === 2) throw new SyncError('Liste aynı anda başka cihazda değişti. Yeniden deneyin.')
    }
    const at = Date.now()
    updateSettings({ lastSync: at })
    setStatus(s.token ? { state: 'idle', at } : { state: 'readonly', at })
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
