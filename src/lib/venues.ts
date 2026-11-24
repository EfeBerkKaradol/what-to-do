import type { Item } from './types'

export interface Suggestion {
  label: string
  detail?: string
  url: string
}

export interface PlacePlan {
  /** Heading for the block. */
  heading: string
  /** Links that work without knowing where the couple is. Google Maps centres them itself. */
  links: Suggestion[]
  /** OpenStreetMap category ("cinema", "cafe") to look up real venues nearby, when the kind of place is known. */
  phrase?: string
  /** Free text for the same lookup when no category fits, and for the "search this area" link. */
  query?: string
}

export function mapsSearch(query: string, near?: { lat: number; lon: number }): string {
  if (near) {
    return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${near.lat.toFixed(4)},${near.lon.toFixed(4)},14z`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

// Words in an activity's title → what to look for. `phrase` is an OpenStreetMap category
// that Nominatim understands; without one the Turkish query is searched as plain text.
const HINTS: { match: RegExp; query: string; phrase?: string }[] = [
  { match: /bowling/i, query: 'bowling' },
  { match: /sinema|film/i, query: 'sinema', phrase: 'cinema' },
  { match: /kahvalt/i, query: 'kahvaltı', phrase: 'cafe' },
  { match: /kahve|kafe|cafe/i, query: 'kahve', phrase: 'cafe' },
  { match: /kokteyl|bar\b|şarap|meyhane/i, query: 'bar', phrase: 'bar' },
  { match: /pizza/i, query: 'pizza' },
  { match: /burger/i, query: 'burger' },
  { match: /sushi|suşi/i, query: 'sushi' },
  { match: /dondurma/i, query: 'dondurma', phrase: 'ice cream' },
  { match: /tatl[ıi]|pasta/i, query: 'tatlıcı' },
  { match: /yemek|restoran|akşam yeme/i, query: 'restoran', phrase: 'restaurant' },
  { match: /müze/i, query: 'müze', phrase: 'museum' },
  { match: /sergi|galeri/i, query: 'sanat galerisi', phrase: 'gallery' },
  { match: /tiyatro/i, query: 'tiyatro', phrase: 'theatre' },
  { match: /kaçış|escape/i, query: 'kaçış oyunu' },
  { match: /bilardo/i, query: 'bilardo' },
  { match: /paten|buz/i, query: 'buz pateni' },
  { match: /lunapark/i, query: 'lunapark', phrase: 'theme park' },
  { match: /akvaryum/i, query: 'akvaryum', phrase: 'aquarium' },
  { match: /hayvanat/i, query: 'hayvanat bahçesi', phrase: 'zoo' },
  { match: /hamam|spa|masaj/i, query: 'hamam' },
  { match: /kitap/i, query: 'kitabevi', phrase: 'bookshop' },
  { match: /yüzme|havuz/i, query: 'yüzme havuzu', phrase: 'swimming pool' },
  { match: /tırmanış/i, query: 'tırmanış' },
  { match: /karting|go.?kart/i, query: 'karting' },
  { match: /plaj|sahil|deniz/i, query: 'plaj', phrase: 'beach' },
  { match: /piknik|park|yürüyüş/i, query: 'park', phrase: 'park' },
  { match: /alışveriş|avm/i, query: 'alışveriş merkezi', phrase: 'mall' },
]

export function planFor(item: Item): PlacePlan {
  switch (item.kind) {
    case 'event': {
      const name = item.venue?.trim() || item.title
      return {
        heading: 'Etkinlik yeri',
        links: [{ label: name, detail: item.city, url: mapsSearch([name, item.city].filter(Boolean).join(' ')) }],
      }
    }
    case 'place':
      return {
        heading: 'Konum',
        links: [
          {
            label: item.title,
            detail: item.venue?.trim() || item.city,
            url: mapsSearch([item.title, item.venue, item.city].filter(Boolean).join(' ')),
          },
        ],
      }
    case 'movie':
      return {
        heading: 'Nerede izlenir',
        links: [{ label: 'Yakındaki sinemalar', detail: 'Google Haritalar', url: mapsSearch('sinema') }],
        phrase: 'cinema',
        query: 'sinema',
      }
    case 'series':
      return {
        heading: 'Evde, yanında',
        links: [
          { label: 'Yakındaki tatlıcılar', detail: 'Google Haritalar', url: mapsSearch('tatlıcı') },
          { label: 'Yakındaki pizzacılar', detail: 'Google Haritalar', url: mapsSearch('pizza') },
          { label: 'Açık marketler', detail: 'Google Haritalar', url: mapsSearch('market') },
        ],
      }
    case 'activity': {
      const text = `${item.title} ${item.venue ?? ''}`
      const hint = HINTS.find((h) => h.match.test(text))
      const query = item.venue?.trim() || hint?.query || item.title
      return {
        heading: 'Nereye gidilir',
        links: [{ label: `Yakında: ${query}`, detail: 'Google Haritalar', url: mapsSearch(query) }],
        phrase: hint?.phrase,
        query,
      }
    }
  }
}

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

interface NominatimRow {
  name?: string
  lat: string
  lon: string
  address?: Record<string, string>
}

async function nominatim(q: string, here: { lat: number; lon: number }): Promise<NominatimRow[]> {
  // A box of roughly 13 x 13 km around the couple, position rounded to about 100 m.
  const lat = Number(here.lat.toFixed(3))
  const lon = Number(here.lon.toFixed(3))
  const params = new URLSearchParams({
    q,
    viewbox: `${(lon - 0.08).toFixed(3)},${(lat + 0.06).toFixed(3)},${(lon + 0.08).toFixed(3)},${(lat - 0.06).toFixed(3)}`,
    bounded: '1',
    format: 'jsonv2',
    addressdetails: '1',
    limit: '30',
    'accept-language': 'tr',
  })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()) as NominatimRow[]
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Named venues around a point, nearest first, from OpenStreetMap (Nominatim).
 * Tries the category first, then the plain Turkish word. Throws when the service does not answer.
 */
export async function nearbyVenues(plan: Pick<PlacePlan, 'phrase' | 'query'>, here: { lat: number; lon: number }): Promise<Suggestion[]> {
  let rows: NominatimRow[] = []
  if (plan.phrase) rows = await nominatim(`[${plan.phrase}]`, here)
  if (rows.length === 0 && plan.query) rows = await nominatim(plan.query, here)
  const seen = new Set<string>()
  return rows
    .map((r) => {
      const lat = Number(r.lat)
      const lon = Number(r.lon)
      if (!r.name || Number.isNaN(lat) || Number.isNaN(lon)) return null
      const a = r.address ?? {}
      return { name: r.name, lat, lon, area: a.suburb ?? a.neighbourhood ?? a.town ?? a.city_district, km: distanceKm(here, { lat, lon }) }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => a.km - b.km)
    .filter((v) => (seen.has(v.name) ? false : (seen.add(v.name), true)))
    .slice(0, 5)
    .map((v) => ({
      label: v.name,
      detail: [v.km < 1 ? `${Math.round(v.km * 100) * 10} m` : `${v.km.toFixed(1).replace('.', ',')} km`, v.area].filter(Boolean).join(' · '),
      url: `https://www.google.com/maps/search/${encodeURIComponent(v.name)}/@${v.lat.toFixed(5)},${v.lon.toFixed(5)},17z`,
    }))
}

export function locate(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(e),
      { maximumAge: 600000, timeout: 10000 },
    )
  })
}
