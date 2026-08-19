import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles/globals.css'
import App from './App'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'

async function bootstrap() {
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('demo') === '1'
  ) {
    const { seedLocalDemoProfiles } = await import('./dev/seedDemoState')
    seedLocalDemoProfiles(window.localStorage)

    const url = new URL(window.location.href)
    url.searchParams.delete('demo')
    window.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    )
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <PwaUpdatePrompt />
    </StrictMode>,
  )
}

void bootstrap()
