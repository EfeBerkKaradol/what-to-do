import { useEffect, useState } from 'react'
import type { Kind } from '../lib/types'

/**
 * A poster, photograph or event picture. Without one (or when it fails to load) the
 * generated illustration for the item's kind stands in; the title's initial is the last resort.
 */
export function Cover({ src, title, kind, className = '' }: { src?: string; title: string; kind?: Kind; className?: string }) {
  // 0: the item's own picture, 1: the illustration for its kind, 2: the initial
  const [stage, setStage] = useState(0)
  useEffect(() => setStage(0), [src])

  const art = kind ? `./art/${kind}.jpg` : undefined
  const url = stage === 0 ? src ?? art : stage === 1 ? art : undefined
  if (url) {
    return (
      <img
        className={`cover ${className}`}
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setStage((s) => (s === 0 && src && art ? 1 : 2))}
      />
    )
  }
  return (
    <span className={`cover cover--blank ${className}`} aria-hidden>
      {title.trim().charAt(0).toLocaleUpperCase('tr')}
    </span>
  )
}
