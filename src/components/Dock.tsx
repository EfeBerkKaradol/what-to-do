import { IconHeart, IconHome, IconPen, IconSettings, IconToday } from './Icons'

export type Route = 'home' | 'added' | 'liked' | 'settings'

export const ROUTES: Record<Route, string> = {
  home: '#/',
  added: '#/eklediklerim',
  liked: '#/kaydettiklerim',
  settings: '#/ayarlar',
}

/**
 * The navigator. On the welcome screen it sits in the middle and carries the title;
 * on every other page the same bar rides at the top.
 */
export function Dock({ route, onPlay }: { route: Route; onPlay: () => void }) {
  const home = route === 'home'
  return (
    <nav className={`dock dock--${home ? 'center' : 'top'}`} aria-label="Ne Yapsak">
      <a className="dock__brand" href={ROUTES.home} aria-label={home ? undefined : 'Ne Yapsak, ana ekran'}>
        {home ? (
          <h1>Ne Yapsak</h1>
        ) : (
          <>
            <span className="dock__home"><IconHome /></span>
            <span className="dock__name">Ne Yapsak</span>
          </>
        )}
      </a>

      <div className="dock__items">
        <a className="dock__item" href={ROUTES.added} aria-current={route === 'added' ? 'page' : undefined}>
          <span className="dock__tile"><IconPen /></span>
          <span className="dock__label">Eklediklerim</span>
        </a>
        <a className="dock__item" href={ROUTES.liked} aria-current={route === 'liked' ? 'page' : undefined}>
          <span className="dock__tile"><IconHeart /></span>
          <span className="dock__label">Kaydettiklerim</span>
        </a>
        <button className="dock__item dock__item--play" onClick={onPlay}>
          <span className="dock__tile"><IconToday /></span>
          <span className="dock__label">Ne Yapsak</span>
        </button>
        <span className="dock__sep" aria-hidden />
        <a
          className="dock__item dock__item--small"
          href={ROUTES.settings}
          aria-label="Ayarlar"
          aria-current={route === 'settings' ? 'page' : undefined}
        >
          <span className="dock__tile"><IconSettings /></span>
          <span className="dock__label">Ayarlar</span>
        </a>
      </div>
    </nav>
  )
}
