/** Single-elimination "this or that": pairs are played until one entry is left. */
export interface Bracket<T> {
  round: number
  /** Entries still waiting to play in this round. */
  queue: T[]
  /** Entries that already won in this round. */
  winners: T[]
  pair: [T, T] | null
  champion: T | null
  played: number
  /** Total comparisons for the whole bracket: entries - 1. */
  total: number
}

export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function advance<T>(b: Bracket<T>): Bracket<T> {
  let { round, queue, winners } = b
  queue = [...queue]
  winners = [...winners]
  for (;;) {
    if (queue.length >= 2) {
      const pair: [T, T] = [queue[0], queue[1]]
      return { ...b, round, queue: queue.slice(2), winners, pair, champion: null }
    }
    // An odd one out gets a bye into the next round.
    if (queue.length === 1) winners.push(queue.shift() as T)
    if (winners.length === 1) {
      return { ...b, round, queue: [], winners: [], pair: null, champion: winners[0] }
    }
    if (winners.length === 0) {
      return { ...b, round, queue: [], winners: [], pair: null, champion: null }
    }
    // The bye goes first next round so the same entry never sits out twice in a row.
    queue = [winners[winners.length - 1], ...winners.slice(0, -1)]
    winners = []
    round += 1
  }
}

export function startBracket<T>(entries: readonly T[], random: () => number = Math.random): Bracket<T> {
  return advance({
    round: 1,
    queue: shuffle(entries, random),
    winners: [],
    pair: null,
    champion: null,
    played: 0,
    total: Math.max(0, entries.length - 1),
  })
}

export function pick<T>(b: Bracket<T>, side: 0 | 1): Bracket<T> {
  if (!b.pair) return b
  return advance({ ...b, winners: [...b.winners, b.pair[side]], pair: null, played: b.played + 1 })
}

/** Entries still alive, the current pair included. */
export function remaining<T>(b: Bracket<T>): number {
  if (b.champion) return 1
  return b.queue.length + b.winners.length + (b.pair ? 2 : 0)
}
