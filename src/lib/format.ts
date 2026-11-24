const dayTime = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dayOnly = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })
const timeOnly = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

export function eventWhen(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dayTime.format(d)
}

export function stamp(at?: number | string): string {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay ? `bugün ${timeOnly.format(d)}` : dayOnly.format(d)
}

export function ago(at: number): string {
  const days = Math.floor((Date.now() - at) / 86400000)
  if (days <= 0) return 'Bugün'
  if (days === 1) return 'Dün'
  if (days < 7) return `${days} gün önce`
  return dayOnly.format(new Date(at))
}
