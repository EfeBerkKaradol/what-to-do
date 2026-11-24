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

// Stops along the diagonal from the top-left corner to the bottom-right one.
// The middle is left to the navigator.
const STOPS = [0.13, 0.31, 0.69, 0.87]

const ENTER = 700
const HOLD = 2000
const EXIT = 1000
const GAP = 300
const CYCLE = ENTER + HOLD + EXIT + GAP
/** Cells an icon travels down-right while it arrives. */
const TRAVEL = 9

const DIM = '#242424'
const LIT: [number, number, number] = [240, 240, 240]
const FLARE: [number, number, number] = [255, 106, 127]

const easeOut = (t: number) => 1 - (1 - t) ** 3
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * A field of dots over the whole screen. One after another, pixel icons slide in from the
 * top-left towards the bottom-right, rest for two seconds, then burn away in a sweep.
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
      pitch = width < 600 ? 12 : 14
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

    const origin = (sprite: Sprite, stop: number): [number, number] => {
      const col = Math.round((stop * width - ox) / pitch - sprite.w / 2)
      const row = Math.round((stop * height - oy) / pitch - sprite.h / 2)
      return [Math.max(1, Math.min(cols - sprite.w - 1, col)), Math.max(1, Math.min(rows - sprite.h - 1, row))]
    }

    const paint = (elapsed: number) => {
      ctx.clearRect(0, 0, width, height)
      if (base) ctx.drawImage(base, 0, 0, width, height)

      const turn = Math.floor(elapsed / CYCLE)
      const t = elapsed - turn * CYCLE
      const sprite = SPRITES[turn % SPRITES.length]
      const [c0, r0] = origin(sprite, STOPS[turn % STOPS.length])
      const r = pitch * 0.17

      if (t < ENTER) {
        // Arrives in whole-cell steps, like a sign scrolling its lamps.
        const p = t / ENTER
        const back = Math.round((1 - easeOut(p)) * TRAVEL)
        for (const [x, y] of sprite.cells) {
          const cx = c0 + x - back
          const cy = r0 + y - back
          if (cx < 0 || cy < 0) continue
          dot(ox + cx * pitch, oy + cy * pitch, r, LIT, Math.min(1, p * 1.6))
        }
        return
      }

      if (t < ENTER + HOLD) {
        for (const [x, y] of sprite.cells) dot(ox + (c0 + x) * pitch, oy + (r0 + y) * pitch, r, LIT, 1)
        return
      }

      if (t < ENTER + HOLD + EXIT) {
        // A front crosses the icon from its top-left corner; each dot it reaches flares,
        // drifts a little the same way, and goes out.
        const p = (t - ENTER - HOLD) / EXIT
        const span = sprite.w + sprite.h - 2
        const tail = 0.38
        const front = p * (1 + tail)
        for (const [x, y] of sprite.cells) {
          const phase = (front - (x + y) / span) / tail
          const px = ox + (c0 + x) * pitch
          const py = oy + (r0 + y) * pitch
          if (phase <= 0) {
            dot(px, py, r, LIT, 1)
          } else if (phase < 1) {
            const heat = Math.sin(Math.PI * Math.min(1, phase * 1.4))
            const drift = phase * phase * pitch * 1.6
            const rgb: [number, number, number] = [mix(LIT[0], FLARE[0], heat), mix(LIT[1], FLARE[1], heat), mix(LIT[2], FLARE[2], heat)]
            dot(px + drift, py + drift, r * (1 + heat * 0.9), rgb, 1 - phase * phase)
          }
        }
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
