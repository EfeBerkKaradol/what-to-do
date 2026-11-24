import { useEffect, useRef, useState } from 'react'
import { lookupTitle, type Match } from '../lib/lookup'
import { addItem } from '../lib/store'
import { KIND_LABEL, SAVABLE_KINDS, type Kind } from '../lib/types'
import { Cover } from './Cover'
import { IconBack, IconClose } from './Icons'

const TITLE_LABEL: Record<string, string> = {
  activity: 'Ne yapmak istiyorsunuz?',
  place: 'Mekanın adı',
  movie: 'Filmin adı',
  series: 'Dizinin adı',
}
const TITLE_PLACEHOLDER: Record<string, string> = {
  activity: 'Bowling, sahilde yürüyüş, seramik atölyesi',
  place: 'Moda Çay Bahçesi',
  movie: 'Film adı yazın',
  series: 'Dizi adı yazın',
}

const KIND_HINT: Record<string, string> = {
  activity: 'Birlikte yapılacak bir şey',
  place: 'Gidilecek bir yer',
  movie: 'İzlenecek bir film',
  series: 'Başlanacak bir dizi',
}

/** Two steps: first the category, then what it is. */
export function AddSheet({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<Kind | null>(null)
  const [title, setTitle] = useState('')
  const [venue, setVenue] = useState('')
  const [note, setNote] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [chosen, setChosen] = useState<Match | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // Once a category is chosen, typing starts in the title field.
  useEffect(() => {
    if (kind) titleRef.current?.focus()
  }, [kind])

  const searchable = kind === 'movie' || kind === 'series'
  useEffect(() => {
    if (!kind || !searchable || chosen?.title === title) {
      setMatches([])
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      lookupTitle(kind, title, ctrl.signal).then(setMatches).catch(() => setMatches([]))
    }, 350)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [kind, title, searchable, chosen])

  const save = () => {
    if (!kind || !title.trim()) return
    addItem({
      kind,
      title,
      note: note.trim() || undefined,
      venue: venue.trim() || undefined,
      image: searchable ? chosen?.image : undefined,
      meta: searchable ? chosen?.meta : undefined,
      url: searchable ? chosen?.url : undefined,
    })
    onClose()
  }

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="add-title">
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <header className="sheet__head">
          {kind ? (
            <button type="button" className="icon-btn icon-btn--lead" aria-label="Kategori seçimine dön" onClick={() => { setKind(null); setChosen(null); setMatches([]) }}>
              <IconBack />
            </button>
          ) : null}
          <h2 id="add-title">{kind ? `${KIND_LABEL[kind]} ekle` : 'Ne eklemek istiyorsunuz?'}</h2>
          <button type="button" className="icon-btn" aria-label="Kapat" onClick={onClose}><IconClose /></button>
        </header>

        {!kind && (
          <div className="kinds" role="group" aria-label="Kategori">
            {SAVABLE_KINDS.map((k) => (
              <button type="button" key={k} className="kind" onClick={() => setKind(k)}>
                <span className="kind__name">{KIND_LABEL[k]}</span>
                <span className="kind__hint">{KIND_HINT[k]}</span>
              </button>
            ))}
          </div>
        )}

        {kind && (
          <>
        <label className="field">
          <span className="field__label">{TITLE_LABEL[kind]}</span>
          <input
            className="input"
            ref={titleRef}
            value={title}
            required
            placeholder={TITLE_PLACEHOLDER[kind]}
            onChange={(e) => {
              setTitle(e.target.value)
              setChosen(null)
            }}
          />
        </label>

        {matches.length > 0 && (
          <div className="matches" role="listbox" aria-label="Eşleşenler">
            {matches.map((m) => (
              <button
                type="button"
                role="option"
                aria-selected={false}
                key={`${m.title}-${m.meta}`}
                className="match"
                onClick={() => {
                  setChosen(m)
                  setTitle(m.title)
                  setMatches([])
                }}
              >
                <Cover src={m.image} title={m.title} className="row__media" />
                <span className="row__text">
                  <span className="row__title">{m.title}</span>
                  <span className="row__sub">{m.meta || KIND_LABEL[kind]}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {chosen && (
          <div className="row row--picked">
            <Cover src={chosen.image} title={chosen.title} className="row__media" />
            <div className="row__text">
              <span className="row__title">{chosen.title}</span>
              <span className="row__sub">{chosen.meta || 'Afiş eklendi'}</span>
            </div>
          </div>
        )}

        {(kind === 'place' || kind === 'activity') && (
          <label className="field">
            <span className="field__label">{kind === 'place' ? 'Semt ya da adres' : 'Nerede? (isteğe bağlı)'}</span>
            <input
              className="input"
              value={venue}
              placeholder={kind === 'place' ? 'Moda, Kadıköy' : 'Aklınızda bir yer varsa'}
              onChange={(e) => setVenue(e.target.value)}
            />
          </label>
        )}

        <label className="field">
          <span className="field__label">Not (isteğe bağlı)</span>
          <input className="input" value={note} placeholder="Hafta sonu, gün batımında" onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="sheet__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Vazgeç</button>
          <button type="submit" className="btn btn--primary" disabled={!title.trim()}>Ekle</button>
        </div>
          </>
        )}
      </form>
    </dialog>
  )
}
