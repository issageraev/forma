import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../ui'

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void> }

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

const isPhone = () => /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent)
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent)
const BYPASS = 'forma.browser-ok'

/**
 * На телефоне у иконки «На экран Домой» своё хранилище, отдельное от браузера.
 * Чтобы записи не разъехались по двум местам, в обычной вкладке просим сначала установить приложение.
 */
export function InstallGate({ children }: { children: ReactNode }) {
  const [bypass, setBypass] = useState(() => { try { return sessionStorage.getItem(BYPASS) === '1' } catch { return false } })
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  if (!isPhone() || isStandalone() || bypass) return <>{children}</>

  return (
    <div className="install">
      <div className="logo"><Icon name="dumbbell" size={34} stroke={2.4} /></div>
      <div>
        <h1 className="title">Установите «Форму»</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 15 }}>Приложение работает с экрана «Домой»: во весь экран, без интернета, данные хранятся надёжно.</p>
      </div>
      {isIOS() ? (
        <ol>
          <li><span>Нажмите <span className="kbd"><Icon name="share" size={15} />Поделиться</span> внизу Safari</span></li>
          <li><span>Выберите <span className="kbd">На экран «Домой»</span></span></li>
          <li><span>Откройте «Форму» с иконки</span></li>
        </ol>
      ) : prompt ? (
        <button className="pill dark lg block" onClick={() => prompt.prompt()}>Установить приложение</button>
      ) : (
        <ol>
          <li><span>Откройте меню <span className="kbd">⋮</span> в Chrome</span></li>
          <li><span>Выберите <span className="kbd">Установить приложение</span></span></li>
          <li><span>Откройте «Форму» с иконки</span></li>
        </ol>
      )}
      <div className="banner">
        <span>Записи из браузера и из иконки хранятся отдельно, поэтому пользуйтесь только иконкой.</span>
      </div>
      <button className="link" onClick={() => { try { sessionStorage.setItem(BYPASS, '1') } catch { /* приватный режим */ } setBypass(true) }}>
        Всё равно открыть в браузере
      </button>
    </div>
  )
}
