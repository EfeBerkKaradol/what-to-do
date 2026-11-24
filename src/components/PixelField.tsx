import { useEffect, useRef } from 'react'

// One character per dot. Each icon is drawn on the same dot grid that fills the screen.
const ICONS: string[][] = [
  // sinema
  [
    '..##..##..##..##',
    '.##..##..##..##.',
    '##..##..##..##..',
    '################',
    '................',
    '################',
    '#..............#',
    '#.....##.......#',
    '#.....####.....#',
    '#.....######...#',
    '#.....####.....#',
    '#.....##.......#',
    '#..............#',
    '################',
  ],
  // tiyatro
  [
    '..############..',
    '.#............#.',
    '#..............#',
    '#..###....###..#',
    '#.#####..#####.#',
    '#..###....###..#',
    '#..............#',
    '#..............#',
    '#.#..........#.#',
    '#.##........##.#',
    '#..##########..#',
    '.#..########..#.',
    '.#............#.',
    '..##........##..',
    '....########....',
  ],
  // yemek
  [
    '#.#.#........#..',
    '#.#.#..###...##.',
    '#.#.#.#...#..##.',
    '#####.#...#..##.',
    '.###.#.....#.##.',
    '..#..#.....#.##.',
    '..#..#.....#.##.',
    '..#..#.....#.#..',
    '..#..#.....#.#..',
    '..#...#...#..#..',
    '..#...#...#..#..',
    '..#....###...#..',
    '..#..........#..',
    '..#..........#..',
  ],
  // boyama
  [
    '....########....',
    '..############..',
    '.####..########.',
    '.####..####..###',
    '###########..###',
    '################',
    '###..###########',
    '###..########...',
    '############....',
    '############..#.',
    '.###########.###',
    '..##############',
    '....##########..',
  ],
  // konser
  [
    '.....###########',
    '.....###########',
    '.....##.......##',
    '.....##.......##',
    '.....##.......##',
    '.....##.......##',
    '.....##.......##',
    '.....##.......##',
    '..#####....#####',
    '.######...######',
    '.######...######',
    '..####.....####.',
  ],
  // dizi
  [
    '....#......#....',
    '.....#....#.....',
    '......#..#......',
    '################',
    '#..............#',
    '#.#########..#.#',
    '#.#.......#....#',
    '#.#.......#..#.#',
    '#.#.......#....#',
    '#.#.......#..#.#',
    '#.#########....#',
    '#..............#',
    '################',
    '..##........##..',
  ],
  // kahve
  [
    '....#..#..#.....',
    '...#..#..#......',
    '....#..#..#.....',
    '................',
    '############....',
    '############.##.',
    '############...#',
    '############...#',
    '############.##.',
    '############....',
    '.##########.....',
    '..########......',
    '################',
  ],
]

interface Sprite {
  w: number
  h: number
  /** 1 where a cell is lit, row by row. */
  mask: Uint8Array
}

const SPRITES: Sprite[] = ICONS.map((rows) => {
  const w = Math.max(...rows.map((r) => r.length))
  const mask = new Uint8Array(w * rows.length)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') mask[y * w + x] = 1
  })
  return { w, h: rows.length, mask }
})

/** Widest sprite, in cells. Every icon is scaled against this so they all share one size. */
const SPRITE_SIDE = 16

/** Time one icon takes from fully off the top-left corner to fully off the bottom-right one. */
const CROSSING = 11000
/** The next icon sets off when the one before it has come this far, i.e. is on its way out. */
const STAGGER = 0.68

const DIM = '#242424'
const LIT = '226,226,226'

/**
 * A field of dots over the whole screen with pixel icons drifting across it without a
 * stop: each one comes in at the top-left corner and leaves at the bottom-right, and
 * the next sets off as the one ahead nears the far corner.
 */
export function PixelField({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !active) return

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let pitch = 14
    /** Dots per sprite cell, each way: one sprite pixel is a k × k block of dots. */
    let k = 1
    let cols = 0
    let rows = 0
    let ox = 0
    let oy = 0
    let base: HTMLCanvasElement | null = null
    let raf = 0
    let started = 0

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      // An icon is nearly as large as the screen's short side.
      const cell = (Math.min(width, height) * 0.88) / SPRITE_SIDE
      k = Math.max(1, Math.round(cell / 12))
      pitch = cell / k
      cols = Math.floor(width / pitch)
      rows = Math.floor(height / pitch)
      ox = (width - (cols - 1) * pitch) / 2
      oy = (height - (rows - 1) * pitch) / 2
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // The resting grid never changes, so it is painted once and reused every frame.
      base = document.createElement('canvas')
      base.width = canvas.width
      base.height = canvas.height
      const b = base.getContext('2d')
      if (!b) return
      b.setTransform(dpr, 0, 0, dpr, 0, 0)
      b.fillStyle = DIM
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          b.beginPath()
          b.arc(ox + x * pitch, oy + y * pitch, 1.1, 0, Math.PI * 2)
          b.fill()
        }
      }
    }

    /** Is the dot at this offset inside the icon's box part of the icon? */
    const lit = (sprite: Sprite, dx: number, dy: number): number => {
      if (dx < 0 || dy < 0) return 0
      const cx = Math.floor(dx / k)
      const cy = Math.floor(dy / k)
      return cx < sprite.w && cy < sprite.h ? sprite.mask[cy * sprite.w + cx] : 0
    }

    /** Draws one icon at `progress` of its way across (0 = off the top-left, 1 = off the bottom-right). */
    const drawIcon = (sprite: Sprite, progress: number) => {
      const w = sprite.w * k
      const h = sprite.h * k
      // Top-left dot of the icon's box, in dots. It moves in fractions of a dot; the grid stays put.
      const x = -w + (cols + w) * progress
      const y = -h + (rows + h) * progress
      const ix = Math.floor(x)
      const iy = Math.floor(y)
      const fx = x - ix
      const fy = y - iy
      const r = pitch * 0.18
      for (let row = Math.max(0, iy); row <= Math.min(rows - 1, iy + h); row++) {
        const dy = row - iy
        for (let col = Math.max(0, ix); col <= Math.min(cols - 1, ix + w); col++) {
          const dx = col - ix
          // Blend the four whole-dot positions around the true one, so the icon glides
          // from dot to dot instead of jumping.
          const a =
            lit(sprite, dx, dy) * (1 - fx) * (1 - fy) +
            lit(sprite, dx - 1, dy) * fx * (1 - fy) +
            lit(sprite, dx, dy - 1) * (1 - fx) * fy +
            lit(sprite, dx - 1, dy - 1) * fx * fy
          if (a < 0.03) continue
          ctx.fillStyle = `rgba(${LIT},${a.toFixed(3)})`
          ctx.beginPath()
          ctx.arc(ox + col * pitch, oy + row * pitch, r * (0.55 + 0.45 * a), 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const paint = (elapsed: number) => {
      ctx.clearRect(0, 0, width, height)
      if (base) ctx.drawImage(base, 0, 0, width, height)
      // Icon n sets off at n × STAGGER crossings; at most two are on screen at once.
      const gap = CROSSING * STAGGER
      const newest = Math.floor(elapsed / gap)
      for (let n = Math.max(0, newest - 1); n <= newest; n++) {
        const progress = (elapsed - n * gap) / CROSSING
        if (progress >= 0 && progress < 1) drawIcon(SPRITES[n % SPRITES.length], progress)
      }
    }

    const frame = (now: number) => {
      if (!started) started = now
      paint(now - started)
      raf = requestAnimationFrame(frame)
    }

    // No motion: the grid and one icon at rest, clear of the navigator.
    const STILL_AT = CROSSING * 0.3

    const start = () => {
      cancelAnimationFrame(raf)
      if (still) {
        paint(STILL_AT)
        return
      }
      if (document.visibilityState === 'visible') raf = requestAnimationFrame(frame)
    }

    const onResize = () => {
      layout()
      if (still) paint(STILL_AT)
    }

    layout()
    start()
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', start)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', start)
    }
  }, [active])

  return <canvas ref={ref} className={`pixels${active ? ' pixels--on' : ''}`} aria-hidden />
}
