import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles/globals.css'
import App from './App'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'

async function bootstrap() {
  if (import.meta.env.DEV) {
    const url = new URL(window.location.href)

    if (url.searchParams.get('demo') === '1') {
      const { seedLocalDemoProfiles } = await import('./dev/seedDemoState')
      seedLocalDemoProfiles(window.localStorage)
      url.searchParams.delete('demo')
      replacePreviewUrl(url)
    } else if (url.searchParams.get('preview') === 'production') {
      try {
        const response = await fetch('/__hanafy-local-preview', {
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`Preview request failed: ${response.status}`)

        const { seedLocalPreviewProfiles } = await import('./dev/seedDemoState')
        seedLocalPreviewProfiles(window.localStorage, await response.json())
        url.searchParams.delete('preview')
        replacePreviewUrl(url)
      } catch (error) {
        console.warn('Could not load the local production-content preview.', error)
      }
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <PwaUpdatePrompt />
    </StrictMode>,
  )
}

function replacePreviewUrl(url: URL) {
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}

void bootstrap()
