import type { Kind } from './types'

export interface Match {
  title: string
  image?: string
  meta?: string
  url?: string
}

/** Poster and year suggestions while typing a film or series title. Keyless public APIs. */
export async function lookupTitle(kind: Kind, term: string, signal?: AbortSignal): Promise<Match[]> {
  const q = term.trim()
  if (q.length < 2) return []
  if (kind === 'series') {
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`, { signal })
    if (!res.ok) return []
    const rows = (await res.json()) as {
      show: { name: string; url?: string; premiered?: string; genres?: string[]; image?: { original?: string; medium?: string } }
    }[]
    return rows.slice(0, 4).map(({ show }) => ({
      title: show.name,
      image: (show.image?.original ?? show.image?.medium)?.replace('http://', 'https://'),
      meta: [show.premiered?.slice(0, 4), show.genres?.[0]].filter(Boolean).join(' · '),
      url: show.url,
    }))
  }
  if (kind === 'movie') {
    const res = await fetch(`https://itunes.apple.com/search?media=movie&limit=4&term=${encodeURIComponent(q)}`, { signal })
    if (!res.ok) return []
    const body = (await res.json()) as {
      results: { trackName: string; artworkUrl100?: string; releaseDate?: string; primaryGenreName?: string; trackViewUrl?: string }[]
    }
    return body.results.map((m) => ({
      title: m.trackName,
      image: m.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/600x900bb.'),
      meta: [m.releaseDate?.slice(0, 4), m.primaryGenreName].filter(Boolean).join(' · '),
      url: m.trackViewUrl?.split('?')[0],
    }))
  }
  return []
}
