export type EmojiProfile = 'hana' | 'cramble'

export type EmojiChoice = {
  emoji: string
  label: string
}

const HANA_EMOJIS: readonly EmojiChoice[] = [
  { emoji: '🌱', label: 'Seedling' },
  { emoji: '🌸', label: 'Cherry blossom' },
  { emoji: '🌿', label: 'Herb' },
  { emoji: '🌻', label: 'Sunflower' },
  { emoji: '🍀', label: 'Lucky clover' },
  { emoji: '☀️', label: 'Sunshine' },
  { emoji: '🌙', label: 'Moon' },
  { emoji: '💧', label: 'Water drop' },
  { emoji: '🍓', label: 'Strawberry' },
  { emoji: '🍎', label: 'Apple' },
  { emoji: '🫖', label: 'Teapot' },
  { emoji: '🐝', label: 'Honeybee' },
  { emoji: '🦋', label: 'Butterfly' },
  { emoji: '🐇', label: 'Bunny' },
  { emoji: '📖', label: 'Open book' },
  { emoji: '🎨', label: 'Art palette' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '🧺', label: 'Basket' },
  { emoji: '🧘', label: 'Quiet moment' },
  { emoji: '🚶', label: 'Gentle walk' },
  { emoji: '✨', label: 'Sparkles' },
  { emoji: '⚡', label: 'Energy' },
  { emoji: '🫧', label: 'Bubbles' },
  { emoji: '🍵', label: 'Tea' },
  { emoji: '🪷', label: 'Lotus' },
  { emoji: '🎀', label: 'Ribbon' },
  { emoji: '💛', label: 'Yellow heart' },
  { emoji: '🫶', label: 'Heart hands' },
] as const

const CRAMBLE_EMOJIS: readonly EmojiChoice[] = [
  { emoji: '⚔️', label: 'Crossed swords' },
  { emoji: '🛡️', label: 'Shield' },
  { emoji: '🔥', label: 'Flame' },
  { emoji: '🧭', label: 'Compass' },
  { emoji: '📜', label: 'Scroll' },
  { emoji: '🕯️', label: 'Candle' },
  { emoji: '🔑', label: 'Key' },
  { emoji: '🏹', label: 'Bow and arrow' },
  { emoji: '🌙', label: 'Moon' },
  { emoji: '⚡', label: 'Lightning' },
  { emoji: '🏰', label: 'Castle' },
  { emoji: '🧪', label: 'Potion' },
  { emoji: '🦉', label: 'Owl' },
  { emoji: '🐉', label: 'Dragon' },
  { emoji: '🥾', label: 'Trail boot' },
  { emoji: '🏋️', label: 'Strength' },
  { emoji: '🥗', label: 'Provision bowl' },
  { emoji: '📖', label: 'Open tome' },
  { emoji: '🎯', label: 'Target' },
  { emoji: '💠', label: 'Renown mark' },
  { emoji: '💧', label: 'Water drop' },
  { emoji: '☀️', label: 'Sunshine' },
  { emoji: '✨', label: 'Sparkles' },
  { emoji: '⭐', label: 'Star' },
  { emoji: '🪶', label: 'Feather' },
  { emoji: '☕', label: 'Warm drink' },
  { emoji: '🪴', label: 'Potted plant' },
  { emoji: '🦊', label: 'Fox' },
] as const

export function getEmojiChoices(profile: EmojiProfile) {
  return profile === 'hana' ? HANA_EMOJIS : CRAMBLE_EMOJIS
}

/**
 * Stable fallback for imports, migrations, tests, and callers that do not own a
 * UI interaction. Randomness belongs at the create-dialog boundary instead.
 */
export function getDefaultEmoji(profile: EmojiProfile) {
  return getEmojiChoices(profile)[0].emoji
}

/** Resolves the one-time value used by a dialog's lazy state initializer. */
export function resolveInitialEmoji(
  profile: EmojiProfile,
  initialEmoji?: string,
  random: () => number = Math.random,
) {
  return initialEmoji?.trim() || chooseRandomEmoji(profile, undefined, random)
}

/** Picks from the curated profile set and avoids the current symbol when possible. */
export function chooseRandomEmoji(
  profile: EmojiProfile,
  currentEmoji?: string,
  random: () => number = Math.random,
) {
  const choices = getEmojiChoices(profile)
  const candidates = currentEmoji && choices.length > 1
    ? choices.filter(({ emoji }) => emoji !== currentEmoji)
    : choices
  const rawIndex = Math.floor(random() * candidates.length)
  const index = Number.isFinite(rawIndex)
    ? Math.max(0, Math.min(candidates.length - 1, rawIndex))
    : 0
  return candidates[index].emoji
}

export function getEmojiLabel(profile: EmojiProfile, emoji: string) {
  return getEmojiChoices(profile).find((choice) => choice.emoji === emoji)?.label
    ?? 'Current icon'
}
