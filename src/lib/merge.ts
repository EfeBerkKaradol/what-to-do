import type { Doc, Item, Win } from './types'

/** Last write wins per item; history is a union. Safe to run in either direction. */
export function mergeDocs(a: Doc, b: Doc): Doc {
  const items = new Map<string, Item>()
  for (const it of [...a.items, ...b.items]) {
    const prev = items.get(it.id)
    if (!prev || it.updatedAt > prev.updatedAt) items.set(it.id, it)
  }
  const history = new Map<string, Win>()
  for (const w of [...a.history, ...b.history]) history.set(w.id, w)
  return {
    version: 1,
    items: [...items.values()].sort((x, y) => y.createdAt - x.createdAt),
    history: [...history.values()].sort((x, y) => y.at - x.at).slice(0, 50),
  }
}

/** Order-independent fingerprint, used to decide whether a push is needed. */
export function fingerprint(doc: Doc): string {
  const items = [...doc.items].sort((x, y) => x.id.localeCompare(y.id)).map((i) => `${i.id}@${i.updatedAt}`)
  const wins = [...doc.history].sort((x, y) => x.id.localeCompare(y.id)).map((w) => w.id)
  return items.join('|') + '#' + wins.join('|')
}

export function emptyDoc(): Doc {
  return { version: 1, items: [], history: [] }
}

export function normalizeDoc(raw: unknown): Doc {
  const d = (raw ?? {}) as Partial<Doc>
  return {
    version: 1,
    items: Array.isArray(d.items) ? d.items.filter((i) => i && typeof i.id === 'string' && typeof i.title === 'string') : [],
    history: Array.isArray(d.history) ? d.history.filter((w) => w && typeof w.id === 'string') : [],
  }
}
