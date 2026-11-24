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
  /** Lit cells as [x, y]. */
  cells: [number, number][]
}

const SPRITES: Sprite[] = ICONS.map((rows) => {
  const cells: [number, number][] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') cells.push([x, y])
  })
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length, cells }
})

/** Widest sprite, in cells. Every icon is scaled against this so they all share one size. */
const SPRITE_SIDE = 16

const ENTER = 900
const HOLD = 2000
const EXIT = 1000
const GAP = 300
const CYCLE = ENTER + HOLD + EXIT + GAP
/** Sprite cells an icon travels down-right while it arrives. */
const TRAVEL = 5

const DIM = '#242424'
const LIT: [number, number, number] = [226, 226, 226]
const FLARE: [number, number, number] = [255, 106, 127]

const easeOut = (t: number) => 1 - (1 - t) ** 3
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * A field of dots over the whole screen. One after another, pixel icons as large as the
 * screen allows slide in from the top-left, rest for two seconds, then burn away in a
 * sweep towards the bottom-right.
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
    /** Where an icon may rest, as the centre of its box in screen fractions. */
    let stops: [number, number][] = [[0.5, 0.5]]
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
      // An icon fills the screen's short side. On a wide screen it sits in the middle, behind
      // the navigator; on a tall one that would hide it entirely, so it takes the full width
      // and alternates between the top and the bottom of the screen.
      const wide = width >= height * 1.1
      // On a tall screen the icon may reach a little behind the navigator, not far: the free
      // band above (or below) it sets the limit, so the icon's outline stays readable.
      const dock = document.querySelector('.dock')?.getBoundingClientRect().height ?? 300
      const band = Math.max(160, (height - dock) / 2)
      const side = wide ? Math.min(height, width) * 0.94 : Math.min(width * 0.94, band * 1.2)
      const cell = side / SPRITE_SIDE
      k = Math.max(1, Math.round(cell / 12))
      pitch = cell / k
      stops = wide ? [[0.5, 0.5]] : [[0.5, 0], [0.5, 1]]
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

    const dot = (cx: number, cy: number, r: number, rgb: [number, number, number], alpha: number) => {
      if (alpha <= 0.01) return
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }

    /** Top-left dot of the icon's box for a stop, kept a little inside the screen. */
    const origin = (sprite: Sprite, [fx, fy]: [number, number]): [number, number] => {
      const w = sprite.w * k
      const h = sprite.h * k
      const col = Math.round((fx * width - ox) / pitch - w / 2)
      const row = Math.round((fy * height - oy) / pitch - h / 2)
      const edge = Math.min(2, k)
      return [Math.max(edge, Math.min(cols - w - edge, col)), Math.max(edge, Math.min(rows - h - edge, row))]
    }

    /** Calls draw for every dot of the icon, with the dot's offset inside the icon's box. */
    const eachDot = (sprite: Sprite, draw: (dx: number, dy: number) => void) => {
      for (const [x, y] of sprite.cells) {
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) draw(x * k + i, y * k + j)
      }
    }

    const paint = (elapsed: number) => {
      ctx.clearRect(0, 0, width, height)
      if (base) ctx.drawImage(base, 0, 0, width, height)

      const turn = Math.floor(elapsed / CYCLE)
      const t = elapsed - turn * CYCLE
      const sprite = SPRITES[turn % SPRITES.length]
      const [c0, r0] = origin(sprite, stops[turn % stops.length])
      const r = pitch * 0.18

      if (t < ENTER) {
        // Arrives in whole-cell steps, like a sign scrolling its lamps.
        const p = t / ENTER
        const back = Math.round((1 - easeOut(p)) * TRAVEL * k)
        const alpha = Math.min(1, p * 1.6)
        eachDot(sprite, (dx, dy) => {
          const cx = c0 + dx - back
          const cy = r0 + dy - back
          if (cx >= 0 && cy >= 0) dot(ox + cx * pitch, oy + cy * pitch, r, LIT, alpha)
        })
        return
      }

      if (t < ENTER + HOLD) {
        eachDot(sprite, (dx, dy) => dot(ox + (c0 + dx) * pitch, oy + (r0 + dy) * pitch, r, LIT, 1))
        return
      }

      if (t < ENTER + HOLD + EXIT) {
        // A front crosses the icon from its top-left corner; each dot it reaches flares,
        // drifts a little the same way, and goes out.
        const p = (t - ENTER - HOLD) / EXIT
        const span = (sprite.w + sprite.h) * k - 2
        const tail = 0.38
        const front = p * (1 + tail)
        eachDot(sprite, (dx, dy) => {
          const phase = (front - (dx + dy) / span) / tail
          const px = ox + (c0 + dx) * pitch
          const py = oy + (r0 + dy) * pitch
          if (phase <= 0) {
            dot(px, py, r, LIT, 1)
          } else if (phase < 1) {
            const heat = Math.sin(Math.PI * Math.min(1, phase * 1.4))
            const drift = phase * phase * pitch * 2.4
            const rgb: [number, number, number] = [mix(LIT[0], FLARE[0], heat), mix(LIT[1], FLARE[1], heat), mix(LIT[2], FLARE[2], heat)]
            dot(px + drift, py + drift, r * (1 + heat * 0.9), rgb, 1 - phase * phase)
          }
        })
      }
    }

    const frame = (now: number) => {
      if (!started) started = now
      paint(now - started)
      raf = requestAnimationFrame(frame)
    }

    const start = () => {
      cancelAnimationFrame(raf)
      if (still) {
        // No motion: the grid and one resting icon.
        paint(ENTER + 1)
        return
      }
      if (document.visibilityState === 'visible') raf = requestAnimationFrame(frame)
    }

    const onResize = () => {
      layout()
      if (still) paint(ENTER + 1)
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
