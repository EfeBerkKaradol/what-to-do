#!/usr/bin/env node
// Collects this week's trending things to do and writes public/trending.json.
//
// Sources (all free):
//   - Events:  Biletix public search index (no key). Next 7 days, per region.
//   - Movies:  TMDB weekly trending when TMDB_API_KEY is set, otherwise the iTunes TR top-movies chart.
//   - Series:  TMDB weekly trending when TMDB_API_KEY is set, otherwise TVMaze's last-7-days schedule
//              ranked by show weight.
//
// A source that fails keeps its previous entries, so one outage never empties the file.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/trending.json')
const PER_GROUP = 12
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
const clean = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()
const dayKey = (d) => d.toISOString().slice(0, 10)

// ---------- Events (Biletix) ----------

async function biletixRegion(region) {
  const params = new URLSearchParams()
  params.set('q', '*:*')
  params.append('fq', 'start:[NOW TO NOW+7DAY]')
  params.append('fq', `region:${region}`)
  params.append('fq', 'status:s01_onsale')
  params.set('rows', '400')
  params.set('sort', 'start asc')
  params.set('wt', 'json')
  params.set('fl', 'id,type,name,start,svenue,city,category,subcategory,image_url')
  const data = await getJson(`https://www.biletix.com/solr/tr/select/?${params}`)
  const docs = data?.response?.docs ?? []

  // The index has no popularity field. Number of sessions in the week is the best
  // available signal: shows that sell get more dates.
  const byName = new Map()
  for (const d of docs) {
    const title = clean(first(d.name))
    if (!title || !d.start) continue
    const key = title.toLocaleLowerCase('tr')
    const prev = byName.get(key)
    if (prev) {
      prev.sessions += 1
      continue
    }
    const sub = String(d.subcategory || '').split('$')[0]
    const cat = CATEGORY_LABEL[d.category] ? d.category : 'OTHER'
    const isGroup = d.type === 'group'
    byName.set(key, {
      sessions: 1,
      category: cat,
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
        meta: [CATEGORY_LABEL[cat], sub && sub !== 'other' ? sub : ''].filter(Boolean).join(' · '),
      },
    })
  }

  const buckets = new Map(CATEGORY_ORDER.map((c) => [c, []]))
  for (const e of byName.values()) buckets.get(e.category).push(e)
  for (const list of buckets.values()) {
    list.sort((a, b) => b.sessions - a.sessions || a.item.when.localeCompare(b.item.when))
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

async function events() {
  const out = {}
  for (const region of Object.keys(REGIONS)) {
    out[region] = await biletixRegion(region)
  }
  if (Object.values(out).every((l) => l.length === 0)) throw new Error('Biletix returned no events')
  return out
}

// ---------- Movies ----------

async function tmdb(path) {
  const sep = path.includes('?') ? '&' : '?'
  return getJson(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}&language=tr-TR&region=TR`)
}

async function moviesTmdb() {
  const data = await tmdb('/trending/movie/week')
  return (data.results ?? [])
    .filter((m) => m.poster_path && (m.title || m.original_title))
    .slice(0, PER_GROUP)
    .map((m) => ({
      id: `movie:tmdb-${m.id}`,
      kind: 'movie',
      title: m.title || m.original_title,
      image: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
      url: `https://www.themoviedb.org/movie/${m.id}`,
      meta: [m.release_date?.slice(0, 4), m.vote_average ? `${m.vote_average.toFixed(1)} / 10` : ''].filter(Boolean).join(' · '),
      note: clean(m.overview).slice(0, 220) || undefined,
    }))
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
      note: clean(e.summary?.label).slice(0, 220) || undefined,
    }
  })
}

// ---------- Series ----------

async function seriesTmdb() {
  const data = await tmdb('/trending/tv/week')
  return (data.results ?? [])
    .filter((s) => s.poster_path && (s.name || s.original_name))
    .slice(0, PER_GROUP)
    .map((s) => ({
      id: `series:tmdb-${s.id}`,
      kind: 'series',
      title: s.name || s.original_name,
      image: `https://image.tmdb.org/t/p/w500${s.poster_path}`,
      url: `https://www.themoviedb.org/tv/${s.id}`,
      meta: [s.first_air_date?.slice(0, 4), s.vote_average ? `${s.vote_average.toFixed(1)} / 10` : ''].filter(Boolean).join(' · '),
      note: clean(s.overview).slice(0, 220) || undefined,
    }))
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
      note: clean(s.summary).slice(0, 220) || undefined,
    }))
}

// ---------- Run ----------

async function main() {
  let prev = {}
  try {
    prev = JSON.parse(await readFile(OUT, 'utf8'))
  } catch {
    /* first run */
  }

  const sources = {}
  async function take(name, attempts, fallback) {
    for (const [label, fn] of attempts) {
      try {
        const value = await fn()
        sources[name] = label
        return value
      } catch (err) {
        console.warn(`[${name}] ${label} failed: ${err.message}`)
      }
    }
    sources[name] = prev.sources?.[name] ? `${String(prev.sources[name]).replace(/ \(eski\)$/, '')} (eski)` : 'yok'
    return fallback
  }

  const ev = await take('events', [['Biletix', events]], prev.events ?? {})
  const movies = await take(
    'movies',
    [...(TMDB_KEY ? [['TMDB', moviesTmdb]] : []), ['iTunes Türkiye', moviesItunes]],
    prev.movies ?? [],
  )
  const series = await take(
    'series',
    [...(TMDB_KEY ? [['TMDB', seriesTmdb]] : []), ['TVMaze', seriesTvmaze]],
    prev.series ?? [],
  )

  const next = { regions: REGIONS, sources, events: ev, movies, series }
  const { updatedAt: _ignored, ...prevBody } = prev
  // Only bump the timestamp when the content changed, so a quiet day makes no commit.
  const changed = JSON.stringify(prevBody) !== JSON.stringify(next)
  const doc = { updatedAt: changed || !prev.updatedAt ? new Date().toISOString() : prev.updatedAt, ...next }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(doc, null, 1) + '\n')
  const counts = Object.entries(ev).map(([k, v]) => `${k}:${v.length}`).join(' ')
  console.log(`trending.json ${changed ? 'updated' : 'unchanged'} — events ${counts} · movies ${movies.length} · series ${series.length}`)
  console.log('sources:', JSON.stringify(sources))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
