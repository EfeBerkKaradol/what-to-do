import { shuffle } from './tournament'
import type { Catalog, Item, Trending, TrendEntry } from './types'

export const TRENDING_COUNT = 10

export async function loadTrending(): Promise<Trending> {
  const res = await fetch(`./trending.json?d=${new Date().toISOString().slice(0, 13)}`)
  if (!res.ok) throw new Error(`trending ${res.status}`)
  return (await res.json()) as Trending
}

let catalog: Promise<Catalog> | null = null

/** The category catalogue is a few hundred entries, so it is fetched once and only when asked for. */
export function loadCatalog(): Promise<Catalog> {
  catalog ??= fetch(`./catalog.json?d=${new Date().toISOString().slice(0, 13)}`)
    .then((res) => {
      if (!res.ok) throw new Error(`catalog ${res.status}`)
      return res.json() as Promise<Catalog>
    })
    .catch((err) => {
      catalog = null
      throw err
    })
  return catalog
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

/**
 * Today's ten: four events in the chosen region, three films, three series. The pick is
 * stable for the day and rotates through the weekly pool from one day to the next.
 * A group that is short is topped up from the others.
 */
export function todaysTen(t: Trending, region: string, now = new Date()): TrendEntry[] {
  const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000)
  const rand = seeded(day)
  const upcoming = (t.events[region] ?? []).filter((e) => !e.when || new Date(e.when).getTime() > now.getTime() - 3600000)
  const pools = [shuffle(upcoming, rand), shuffle(t.movies ?? [], rand), shuffle(t.series ?? [], rand)]
  const want = [4, 3, 3]
  const picked: TrendEntry[][] = pools.map((p, i) => p.splice(0, want[i]))
  let missing = TRENDING_COUNT - picked.reduce((n, p) => n + p.length, 0)
  while (missing > 0) {
    const pool = pools.filter((p) => p.length > 0).sort((a, b) => b.length - a.length)[0]
    if (!pool) break
    picked[pools.indexOf(pool)].push(pool.shift() as TrendEntry)
    missing -= 1
  }
  return picked.flat()
}

function interleave<T>(lists: T[][]): T[] {
  const out: T[] = []
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i])
  }
  return out
}

/** Everything trending this week for a region: today's ten first, then the rest of the weekly pool. */
export function weeklyPool(t: Trending, region: string, now = new Date()): TrendEntry[] {
  const ten = todaysTen(t, region, now)
  const seen = new Set(ten.map((e) => e.id))
  const upcoming = (t.events[region] ?? []).filter((e) => !e.when || new Date(e.when).getTime() > now.getTime() - 3600000)
  return [...ten, ...interleave([upcoming, t.movies ?? [], t.series ?? []]).filter((e) => !seen.has(e.id))]
}

/** The top couple of every category on every shelf, mixed, to fill a large deck. */
export function catalogPicks(c: Catalog, region: string, perGenre = 2): TrendEntry[] {
  const shelves = [c.movies ?? [], c.series ?? [], c.events?.[region] ?? [], ...Object.values(c.places ?? {}).map((byRegion) => byRegion[region] ?? [])]
  return interleave(shelves.map((genres) => interleave(genres.map((g) => g.items.slice(0, perGenre)))))
}

export function trendToItem(e: TrendEntry): Item {
  return { ...e, source: 'trending', createdAt: 0, updatedAt: 0 }
}
