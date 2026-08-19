import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '@/App'
import { CrambleExperience } from '@/features/cramble/CrambleExperience'
import { TogetherExperience } from '@/features/together/TogetherExperience'
import { crambleQuests } from '@/data/crambleQuests'
import { quests } from '@/data/quests'
import {
  CRAMBLE_QUEST_PLAN_OPTIONS,
  CRAMBLE_STORAGE_KEY,
} from '@/lib/crambleGame'
import {
  createStartedHanaState,
  STORAGE_KEY,
  syncStateToDate,
} from '@/lib/hanaGame'

describe('local-first profile opening', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 14, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders both home emotions on the first render from device snapshots', () => {
    const { hana, cramble } = createProfiles()
    installStorage({
      [STORAGE_KEY]: JSON.stringify(hana),
      [CRAMBLE_STORAGE_KEY]: JSON.stringify(cramble),
    })

    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('home-emotion-status-hana')
    expect(html).toContain('data-emotion="bright"')
    expect(html).toContain('home-emotion-status-cramble')
    expect(html).toContain('data-emotion="good"')
  })

  it('opens Cramble from the cached tracker without the archive loader', () => {
    const { cramble } = createProfiles()
    installStorage({ [CRAMBLE_STORAGE_KEY]: JSON.stringify(cramble) })

    const html = renderToStaticMarkup(
      <CrambleExperience onBack={() => undefined} />,
    )

    expect(html).toContain("Today&#x27;s chapter")
    expect(html).not.toContain("Opening Cramble&#x27;s archive")
  })

  it('opens Together from both cached profiles without gathering first', () => {
    const { hana, cramble } = createProfiles()
    installStorage({ [CRAMBLE_STORAGE_KEY]: JSON.stringify(cramble) })

    const html = renderToStaticMarkup(
      <TogetherExperience hanaGame={hana} onBack={() => undefined} />,
    )

    expect(html).toContain('Shared Journey')
    expect(html).not.toContain('Gathering both journeys')
  })
})

function createProfiles() {
  const dateKey = '2026-08-14'
  const hana = {
    ...syncStateToDate(createStartedHanaState(dateKey), quests, dateKey),
    dailyEmotions: { [dateKey]: 'bright' as const },
    syncRevision: 11,
  }
  const cramble = {
    ...syncStateToDate(
      createStartedHanaState(dateKey),
      crambleQuests,
      dateKey,
      CRAMBLE_QUEST_PLAN_OPTIONS,
    ),
    dailyEmotions: { [dateKey]: 'good' as const },
    syncRevision: 49,
  }
  return { hana, cramble }
}

function installStorage(values: Record<string, string>) {
  vi.stubGlobal('window', {
    localStorage: {
      getItem(key: string) {
        return values[key] ?? null
      },
      setItem() {},
      removeItem() {},
    },
  })
}
