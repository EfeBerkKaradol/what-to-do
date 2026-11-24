import { describe, expect, it } from 'vitest'
import { pick, remaining, startBracket } from './tournament'
import { fingerprint, mergeDocs } from './merge'
import type { Doc, Item } from './types'

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('bracket', () => {
  it('crowns the only entry without a match', () => {
    const b = startBracket(['a'])
    expect(b.champion).toBe('a')
    expect(b.total).toBe(0)
  })

  it('has no champion for an empty list', () => {
    const b = startBracket<string>([])
    expect(b.champion).toBeNull()
    expect(b.pair).toBeNull()
  })

  it('plays exactly n - 1 comparisons and ends with one of the entries', () => {
    for (let n = 2; n <= 17; n++) {
      const entries = Array.from({ length: n }, (_, i) => `e${i}`)
      const rand = seeded(n)
      let b = startBracket(entries, rand)
      let steps = 0
      while (!b.champion) {
        expect(b.pair).not.toBeNull()
        expect(b.pair![0]).not.toBe(b.pair![1])
        const before = remaining(b)
        b = pick(b, rand() < 0.5 ? 0 : 1)
        steps += 1
        expect(remaining(b)).toBe(before - 1)
        expect(steps).toBeLessThan(100)
      }
      expect(steps).toBe(n - 1)
      expect(b.played).toBe(b.total)
      expect(entries).toContain(b.champion)
    }
  })

  it('lets a consistent favourite win every time', () => {
    for (let n = 2; n <= 12; n++) {
      const entries = Array.from({ length: n }, (_, i) => i)
      let b = startBracket(entries, seeded(n * 7))
      while (!b.champion && b.pair) b = pick(b, b.pair[0] > b.pair[1] ? 0 : 1)
      expect(b.champion).toBe(n - 1)
    }
  })
})

describe('merge', () => {
  const item = (id: string, updatedAt: number, extra: Partial<Item> = {}): Item => ({
    id, kind: 'activity', title: id, source: 'saved', createdAt: 1, updatedAt, ...extra,
  })
  const doc = (items: Item[]): Doc => ({ version: 1, items, history: [] })

  it('keeps the newer copy of each item and unions the rest', () => {
    const a = doc([item('x', 5, { title: 'old' }), item('y', 1)])
    const b = doc([item('x', 9, { title: 'new' }), item('z', 2)])
    const m = mergeDocs(a, b)
    expect(m.items.map((i) => i.id).sort()).toEqual(['x', 'y', 'z'])
    expect(m.items.find((i) => i.id === 'x')!.title).toBe('new')
  })

  it('lets a newer delete win over an older edit, in both directions', () => {
    const a = doc([item('x', 5)])
    const b = doc([item('x', 9, { deleted: true })])
    expect(mergeDocs(a, b).items[0].deleted).toBe(true)
    expect(mergeDocs(b, a).items[0].deleted).toBe(true)
    expect(fingerprint(mergeDocs(a, b))).toBe(fingerprint(mergeDocs(b, a)))
  })
})
