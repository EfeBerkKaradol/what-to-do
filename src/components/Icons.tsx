import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const IconToday = () => (
  <svg {...base}><rect x="7" y="3.5" width="11" height="15" rx="2.5" /><path d="M5 7.5v11A2.5 2.5 0 0 0 7.5 21H14" /></svg>
)
export const IconList = () => (
  <svg {...base}><path d="M8 6.5h12M8 12h12M8 17.5h12" /><path d="M4 6.5h.01M4 12h.01M4 17.5h.01" /></svg>
)
export const IconSettings = () => (
  <svg {...base}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></svg>
)
export const IconClose = () => (
  <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IconUndo = () => (
  <svg {...base}><path d="M8 5L4 9l4 4" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
)
export const IconOut = () => (
  <svg {...base} width={14} height={14}><path d="M8 6h10v10" /><path d="M18 6L6 18" /></svg>
)
export const IconPlus = () => (
  <svg {...base} width={16} height={16}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconChevron = ({ open }: { open: boolean }) => (
  <svg {...base} width={16} height={16} style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="M6 9l6 6 6-6" /></svg>
)

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="8 15 48 34" aria-hidden>
      <circle cx="25" cy="32" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="39" cy="32" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M32 18.7a15 15 0 0 1 0 26.6 15 15 0 0 1 0-26.6z" fill="var(--accent)" />
    </svg>
  )
}
