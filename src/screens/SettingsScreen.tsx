import { useSyncStatus, type TrendingState } from '../App'
import { stamp } from '../lib/format'
import { updateSettings, useStore } from '../lib/store'
import { syncNow } from '../lib/sync'
import { syncLine } from './AddedScreen'

export function SettingsScreen({ trending }: { trending: TrendingState }) {
  const { settings } = useStore()
  const status = useSyncStatus()
  const names = settings.names

  const setName = (i: 0 | 1, value: string) => {
    const next: [string, string] = [...names] as [string, string]
    next[i] = value
    updateSettings({ names: next })
  }

  return (
    <div className="page page--narrow">
      <header className="title">
        <div>
          <h1>Ayarlar</h1>
          <p className="title__sub">Değişiklikler anında kaydedilir.</p>
        </div>
      </header>

      <section className="panel form">
        <h2>İkiniz</h2>
        <div className="form__pair">
          <label className="field">
            <span className="field__label">Birinci isim</span>
            <input className="input" value={names[0]} placeholder="Adınız" autoComplete="off" onChange={(e) => setName(0, e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">İkinci isim</span>
            <input className="input" value={names[1]} placeholder="Sevgilinizin adı" autoComplete="off" onChange={(e) => setName(1, e.target.value)} />
          </label>
        </div>
        <div className="field">
          <span className="field__label" id="me-label">Bu telefon kimin?</span>
          <div className="seg seg--fit" role="radiogroup" aria-labelledby="me-label">
            {([0, 1] as const).map((i) => (
              <button key={i} type="button" role="radio" aria-checked={settings.me === i} className="seg__opt" onClick={() => updateSettings({ me: i })}>
                {names[i].trim() || (i === 0 ? 'Birinci' : 'İkinci')}
              </button>
            ))}
          </div>
          <p className="field__help">Eklediğiniz fikirlerin yanında bu isim görünür.</p>
        </div>
      </section>

      <section className="panel form">
        <h2>Etkinlik şehri</h2>
        <label className="field">
          <span className="field__label">Konser, sahne ve diğer etkinlikler bu şehirden gelir</span>
          <span className="select">
            <select value={settings.region} onChange={(e) => updateSettings({ region: e.target.value })}>
              {trending.status === 'ready' ? (
                Object.entries(trending.data.regions).map(([id, name]) => <option key={id} value={id}>{name}</option>)
              ) : (
                <option value={settings.region}>{settings.region}</option>
              )}
            </select>
          </span>
        </label>
        {trending.status === 'ready' && (
          <p className="field__help">
            Kaynaklar: etkinlikler {trending.data.sources.events}, filmler {trending.data.sources.movies}, diziler {trending.data.sources.series}. Son güncelleme {stamp(trending.data.updatedAt)}.
          </p>
        )}
      </section>

      <section className="panel form">
        <h2>Ortak liste</h2>
        <p className="form__lead">
          Bu siteyi açan herkes aynı listeyi görür ve değiştirebilir; kişiye özel liste yok. Kayıtlar, sitenin dışındaki herkese açık bir depoda (extendsclass.com) tek dosya olarak durur.
        </p>
        <div className="form__row">
          <button className="btn btn--primary" onClick={() => void syncNow()} disabled={status.state === 'syncing'}>
            Şimdi eşitle
          </button>
          <span className={`form__status${status.state === 'error' ? ' form__status--bad' : ''}`} role="status">{syncLine(status)}</span>
        </div>
      </section>
    </div>
  )
}
