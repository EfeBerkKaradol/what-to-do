import { useState } from 'react'

/** A poster or event picture; without one, the title's initial on a neutral tile. */
export function Cover({ src, title, className = '' }: { src?: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <img
        className={`cover ${className}`}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <span className={`cover cover--blank ${className}`} aria-hidden>
      {title.trim().charAt(0).toLocaleUpperCase('tr')}
    </span>
  )
}
