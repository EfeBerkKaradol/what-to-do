#!/usr/bin/env node
// Collects this week's trending things to do and writes public/trending.json, and a
// catalogue of films, series and events by category into public/catalog.json.
//
// Sources (all free):
//   - Events:  Biletix public search index (no key). Next 7 days, per region.
//   - Movies:  TMDB weekly trending when TMDB_API_KEY is set, otherwise the iTunes TR top-movies chart.
//   - Series:  TMDB weekly trending when TMDB_API_KEY is set, otherwise TVMaze's last-7-days schedule
//              ranked by show weight.
//
// The category catalogue needs TMDB for films and series (genre list + discover per genre);
// events by category come from the same Biletix index, next 30 days. Places by category
// are a curated list in data/places.json.
//
// A source that fails keeps its previous entries, so one outage never empties the file.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/trending.json')
const CATALOG_OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/catalog.json')
// Hand-picked places by city and category (walking parks and the like); copied into the catalogue as they are.
const PLACES = resolve(dirname(fileURLToPath(import.meta.url)), '../data/places.json')
const PER_GROUP = 12
const PER_GENRE = 10
const UA = 'Mozilla/5.0 (compatible; what-to-do-trending/1.0)'
const TMDB_KEY = process.env.TMDB_API_KEY || ''

export const REGIONS = {
  ISTANBUL: 'İstanbul',
  ANKARA: 'Ankara',
  IZMIR: 'İzmir',
  ANTALYA: 'Antalya',
  DIGER: 'Diğer şehirler',
}

const CATEGORY_LABEL = { MUSIC: 'Konser', ART: 'Sahne', FAMILY: 'Aile', SPORT: 'Spor', OTHER: 'Etkinlik' }
const CATEGORY_ORDER = ['MUSIC', 'ART', 'FAMILY', 'SPORT', 'OTHER']

// Biletix "subcategory$CATEGORY" → the name shown in the app. Keys that are missing here
// (school trips, merchandise, the catch-all "other" buckets) are left out of the catalogue.
const EVENT_GENRE = {
  'tiyatro$ART': 'Tiyatro',
  'stand_up$ART': 'Stand-up',
  'musical$ART': 'Müzikal',
  'musical$FAMILY': 'Müzikal',
  'bale_dans$ART': 'Bale ve dans',
  'gosteri$ART': 'Gösteri',
  'gosteri$FAMILY': 'Gösteri',
  'sinema$ART': 'Film gösterimi',
  'tiyatro$FAMILY': 'Çocuk tiyatrosu',
  'attractioncenter$FAMILY': 'Eğlence merkezi',
  'sirk$FAMILY': 'Sirk',
  'pop$MUSIC': 'Pop',
  'rock$MUSIC': 'Rock',
  'alternatif$MUSIC': 'Alternatif',
  'jazz$MUSIC': 'Caz',
  'klasik$MUSIC': 'Klasik müzik',
  'rap_hiphop$MUSIC': 'Rap ve hip-hop',
  'dans_elektronik$MUSIC': 'Elektronik',
  'turksanat_halkmuzik$MUSIC': 'Türk sanat ve halk müziği',
  'dunya_muzik$MUSIC': 'Dünya müziği',
  'heavy_metal$MUSIC': 'Metal',
  'latin_tango$MUSIC': 'Latin ve tango',
  'party$MUSIC': 'Parti',
  'atolye$OTHER': 'Atölye',
  'muze$OTHER': 'Müze',
  'sergi$OTHER': 'Sergi',
  'konferans$OTHER': 'Konferans',
  'fuar$OTHER': 'Fuar',
  'basketbol$SPORT': 'Basketbol',
  'esport$SPORT': 'E-spor',
  'dovus_spor$SPORT': 'Dövüş sporları',
}

async function getJson(url, init = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} ← ${url.split('?')[0]}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const first = (v) => (Array.isArray(v) ? v[0] : v)
const ENTITIES = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—',
  ccedil: 'ç', Ccedil: 'Ç', uuml: 'ü', Uuml: 'Ü', ouml: 'ö', Ouml: 'Ö', acirc: 'â', icirc: 'î', ucirc: 'û' }

/** HTML or plain text → one clean line of text. */
const clean = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Cuts text to a length at the end of a sentence where it can, otherwise at a word, with an ellipsis. */
function brief(text, max) {
  const t = clean(text)
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  if (stop > max * 0.5) return cut.slice(0, stop + 1)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:–-]$/, '') + '…'
}

const NOTE = 160
const ABOUT = 700

/** The short line for cards and the longer text for the detail page (left out when it adds nothing). */
function describe(text) {
  const about = brief(text, ABOUT)
  const note = brief(text, NOTE)
  return { note: note || undefined, about: about.length > note.length ? about : undefined }
}
const dayKey = (d) => d.toISOString().slice(0, 10)

// ---------- Events (Biletix) ----------

const WEEK = 7 * 86400000

/** Biletix descriptions are HTML and usually open by repeating the title; that repeat is dropped. */
function describeEvent(description, title) {
  let text = clean(first(description))
  if (text.toLocaleLowerCase('tr').startsWith(title.toLocaleLowerCase('tr'))) text = text.slice(title.length).replace(/^[\s.,:;!–-]+/, '')
  return text.length >= 40 ? describe(text) : {}
}

/** Every on-sale event of a region in the next 30 days, one entry per title. */
async function biletixRegion(region) {
  const params = new URLSearchParams()
  params.set('q', '*:*')
  params.append('fq', 'start:[NOW TO NOW+30DAY]')
  params.append('fq', `region:${region}`)
  params.append('fq', 'status:s01_onsale')
  params.set('rows', '2500')
  params.set('sort', 'start asc')
  params.set('wt', 'json')
  params.set('fl', 'id,type,name,start,svenue,city,category,subcategory,image_url,description')
  const data = await getJson(`https://www.biletix.com/solr/tr/select/?${params}`)
  const docs = data?.response?.docs ?? []
  const soon = Date.now() + WEEK

  // The index has no popularity field. Number of sessions is the best available signal:
  // shows that sell get more dates.
  const byName = new Map()
  for (const d of docs) {
    const title = clean(first(d.name))
    if (!title || !d.start) continue
    const thisWeek = new Date(d.start).getTime() <= soon
    const key = title.toLocaleLowerCase('tr')
    const prev = byName.get(key)
    if (prev) {
      prev.sessions += 1
      if (thisWeek) prev.weekSessions += 1
      continue
    }
    const cat = CATEGORY_LABEL[d.category] ? d.category : 'OTHER'
    const genre = EVENT_GENRE[d.subcategory]
    const isGroup = d.type === 'group'
    byName.set(key, {
      sessions: 1,
      weekSessions: thisWeek ? 1 : 0,
      category: cat,
      genre,
      item: {
        id: `event:${d.id}`,
        kind: 'event',
        title,
        image: d.image_url
          ? `https://www.biletix.com/static/images/live/event/${isGroup ? 'groupimages' : 'eventimages'}/${d.image_url}`
          : undefined,
        venue: clean(d.svenue) || undefined,
        city: clean(first(d.city)) || REGIONS[region],
        when: d.start,
        url: `https://www.biletix.com/${isGroup ? 'etkinlik-grup' : 'etkinlik'}/${d.id}/TURKIYE/tr`,
        meta: genre ? (cat === 'MUSIC' ? `Konser · ${genre}` : genre) : CATEGORY_LABEL[cat],
        ...describeEvent(d.description, title),
      },
    })
  }
  return [...byName.values()]
}

/** This week's picks for a region, spread over the broad categories. */
function weeklyPicks(entries) {
  const buckets = new Map(CATEGORY_ORDER.map((c) => [c, []]))
  for (const e of entries) if (e.weekSessions > 0) buckets.get(e.category).push(e)
  for (const list of buckets.values()) {
    list.sort((a, b) => b.weekSessions - a.weekSessions || a.item.when.localeCompare(b.item.when))
  }

  // Round-robin over categories so a week of 100 concerts does not crowd out everything else.
  const picked = []
  while (picked.length < PER_GROUP) {
    let took = false
    for (const c of CATEGORY_ORDER) {
      const next = buckets.get(c).shift()
      if (next) {
        picked.push(next.item)
        took = true
        if (picked.length === PER_GROUP) break
      }
    }
    if (!took) break
  }
  return picked
}

/** The next 30 days of a region by kind of event, fullest category first. */
function eventGenres(entries) {
  const groups = new Map()
  for (const e of entries) {
    if (!e.genre) continue
    if (!groups.has(e.genre)) groups.set(e.genre, [])
    groups.get(e.genre).push(e)
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, list]) => ({
      id: name,
      name,
      items: list
        .sort((a, b) => b.sessions - a.sessions || a.item.when.localeCompare(b.item.when))
        .slice(0, PER_GENRE)
        .map((e) => e.item),
    }))
}

/** One Biletix pass feeds both files: { weekly: {region: entries}, genres: {region: genres} }. */
async function events() {
  const weekly = {}
  const genres = {}
  for (const region of Object.keys(REGIONS)) {
    const entries = await biletixRegion(region)
    weekly[region] = weeklyPicks(entries)
    genres[region] = eventGenres(entries)
  }
  if (Object.values(weekly).every((l) => l.length === 0)) throw new Error('Biletix returned no events')
  return { weekly, genres }
}

// ---------- Movies ----------

async function tmdb(path) {
  const sep = path.includes('?') ? '&' : '?'
  return getJson(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}&language=tr-TR&region=TR`)
}

const tmdbMovie = (m) => ({
  id: `movie:tmdb-${m.id}`,
  kind: 'movie',
  title: m.title || m.original_title,
  image: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
  url: `https://www.themoviedb.org/movie/${m.id}`,
  meta: [m.release_date?.slice(0, 4), m.vote_average ? `${m.vote_average.toFixed(1)} / 10` : ''].filter(Boolean).join(' · '),
  ...describe(m.overview),
})

const tmdbSeries = (s) => ({
  id: `series:tmdb-${s.id}`,
  kind: 'series',
  title: s.name || s.original_name,
  image: `https://image.tmdb.org/t/p/w500${s.poster_path}`,
  url: `https://www.themoviedb.org/tv/${s.id}`,
  meta: [s.first_air_date?.slice(0, 4), s.vote_average ? `${s.vote_average.toFixed(1)} / 10` : ''].filter(Boolean).join(' · '),
  ...describe(s.overview),
})

async function moviesTmdb() {
  const data = await tmdb('/trending/movie/week')
  return (data.results ?? [])
    .filter((m) => m.poster_path && (m.title || m.original_title))
    .slice(0, PER_GROUP)
    .map((m) => tmdbMovie(m))
}

/** TMDB's genre list for films ('movie') or series ('tv'), each with its most popular titles right now. */
async function tmdbGenres(kind) {
  const list = await tmdb(`/genre/${kind}/list`)
  const toEntry = kind === 'movie' ? tmdbMovie : tmdbSeries
  // A floor on votes keeps out titles that are "popular" for a day and that nobody has seen.
  const floor = kind === 'movie' ? 50 : 20
  const out = []
  for (const g of list.genres ?? []) {
    const data = await tmdb(`/discover/${kind}?with_genres=${g.id}&sort_by=popularity.desc&include_adult=false&vote_count.gte=${floor}`)
    const items = (data.results ?? [])
      .filter((x) => x.poster_path && (x.title || x.name || x.original_title || x.original_name))
      .slice(0, PER_GENRE)
      .map((x) => toEntry(x))
    if (items.length >= 3) out.push({ id: String(g.id), name: g.name, items })
  }
  if (out.length === 0) throw new Error(`TMDB returned no ${kind} genres`)
  return out
}

async function moviesItunes() {
  const data = await getJson(`https://itunes.apple.com/tr/rss/topmovies/limit=${PER_GROUP}/json`)
  const entries = data?.feed?.entry ?? []
  return entries.map((e) => {
    const art = e['im:image']?.at(-1)?.label
    const year = e['im:releaseDate']?.label?.slice(0, 4)
    const genre = e.category?.attributes?.label
    return {
      id: `movie:itunes-${e.id?.attributes?.['im:id'] ?? e['im:name'].label}`,
      kind: 'movie',
      title: e['im:name'].label,
      image: art ? art.replace(/\/\d+x\d+bb\.(png|jpg)$/, '/600x900bb.jpg') : undefined,
      url: e.id?.label?.split('?')[0],
      meta: [year, genre].filter(Boolean).join(' · '),
      ...describe(e.summary?.label),
    }
  })
}

// ---------- Series ----------

async function seriesTmdb() {
  const data = await tmdb('/trending/tv/week')
  return (data.results ?? [])
    .filter((x) => x.poster_path && (x.name || x.original_name))
    .slice(0, PER_GROUP)
    .map((x) => tmdbSeries(x))
}

async function seriesTvmaze() {
  const shows = new Map()
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() - i * 86400000)
    const date = dayKey(d)
    const lists = await Promise.allSettled([
      getJson(`https://api.tvmaze.com/schedule/web?date=${date}`),
      getJson(`https://api.tvmaze.com/schedule?country=TR&date=${date}`),
    ])
    for (const r of lists) {
      if (r.status !== 'fulfilled') continue
      for (const ep of r.value) {
        const show = ep.show ?? ep._embedded?.show
        if (!show?.id || !show.image?.original) continue
        if (!['Scripted', 'Animation', 'Documentary'].includes(show.type)) continue
        shows.set(show.id, show)
      }
    }
  }
  if (shows.size === 0) throw new Error('TVMaze returned no shows')
  return [...shows.values()]
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.rating?.average ?? 0) - (a.rating?.average ?? 0))
    .slice(0, PER_GROUP)
    .map((s) => ({
      id: `series:tvmaze-${s.id}`,
      kind: 'series',
      title: s.name,
      image: s.image.original.replace('http://', 'https://'),
      url: s.url,
      meta: [s.webChannel?.name ?? s.network?.name, s.genres?.[0]].filter(Boolean).join(' · '),
      ...describe(s.summary),
    }))
}

// ---------- Run ----------

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return {} // first run
  }
}

/** Writes the document; the timestamp only moves when the content did, so a quiet day makes no commit. */
async function writeDoc(path, prev, next) {
  const { updatedAt: _ignored, ...prevBody } = prev
  const changed = JSON.stringify(prevBody) !== JSON.stringify(next)
  const doc = { updatedAt: changed || !prev.updatedAt ? new Date().toISOString() : prev.updatedAt, ...next }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(doc, null, 1) + '\n')
  return changed
}

async function main() {
  const prev = await readJson(OUT)
  const prevCatalog = await readJson(CATALOG_OUT)

  /** Runs the attempts in order; if all fail, keeps what the previous file had. */
  async function take(sources, prevSources, name, attempts, fallback) {
    for (const [label, fn] of attempts) {
      try {
        const value = await fn()
        sources[name] = label
        return value
      } catch (err) {
        console.warn(`[${name}] ${label} failed: ${err.message}`)
      }
    }
    sources[name] = prevSources?.[name] ? `${String(prevSources[name]).replace(/ \(eski\)$/, '')} (eski)` : 'yok'
    return fallback
  }

  // ---- this week's trending ----
  const sources = {}
  const ev = await take(sources, prev.sources, 'events', [['Biletix', events]], null)
  const weekly = ev?.weekly ?? prev.events ?? {}
  const movies = await take(
    sources,
    prev.sources,
    'movies',
    [...(TMDB_KEY ? [['TMDB', moviesTmdb]] : []), ['iTunes Türkiye', moviesItunes]],
    prev.movies ?? [],
  )
  const series = await take(
    sources,
    prev.sources,
    'series',
    [...(TMDB_KEY ? [['TMDB', seriesTmdb]] : []), ['TVMaze', seriesTvmaze]],
    prev.series ?? [],
  )
  const changed = await writeDoc(OUT, prev, { regions: REGIONS, sources, events: weekly, movies, series })
  const counts = Object.entries(weekly).map(([k, v]) => `${k}:${v.length}`).join(' ')
  console.log(`trending.json ${changed ? 'updated' : 'unchanged'} — events ${counts} · movies ${movies.length} · series ${series.length}`)
  console.log('sources:', JSON.stringify(sources))

  // ---- by category ----
  const catSources = { events: ev ? 'Biletix' : prevCatalog.sources?.events ?? 'yok' }
  const tmdbOnly = (kind) => (TMDB_KEY ? [['TMDB', () => tmdbGenres(kind)]] : [])
  const movieGenres = await take(catSources, prevCatalog.sources, 'movies', tmdbOnly('movie'), prevCatalog.movies ?? [])
  const seriesGenres = await take(catSources, prevCatalog.sources, 'series', tmdbOnly('tv'), prevCatalog.series ?? [])
  const catChanged = await writeDoc(CATALOG_OUT, prevCatalog, {
    regions: REGIONS,
    sources: catSources,
    movies: movieGenres,
    series: seriesGenres,
    events: ev?.genres ?? prevCatalog.events ?? {},
    places: await readJson(PLACES),
  })
  const evGenres = Object.entries(ev?.genres ?? prevCatalog.events ?? {}).map(([k, v]) => `${k}:${v.length}`).join(' ')
  console.log(`catalog.json ${catChanged ? 'updated' : 'unchanged'} — film genres ${movieGenres.length} · series genres ${seriesGenres.length} · event genres ${evGenres}`)
  console.log('sources:', JSON.stringify(catSources))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
