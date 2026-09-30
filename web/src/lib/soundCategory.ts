export type SoundCategory = 'white-noise' | 'rain' | 'heartbeat' | 'lullaby' | 'waves' | 'fan'

export const SOUND_CATEGORIES: { id: SoundCategory; labelKey: string }[] = [
  { id: 'white-noise', labelKey: 'sounds.categories.whiteNoise' },
  { id: 'rain', labelKey: 'sounds.categories.rain' },
  { id: 'heartbeat', labelKey: 'sounds.categories.heartbeat' },
  { id: 'lullaby', labelKey: 'sounds.categories.lullaby' },
  { id: 'waves', labelKey: 'sounds.categories.waves' },
  { id: 'fan', labelKey: 'sounds.categories.fan' },
]

// Se espera public/sounds/<file>.mp3, ~128kbps, en bucle sin costura -
// 'white-noise' no tiene entrada aquí porque no usa ningún fichero, se
// genera en el momento con Web Audio (ver useSoundPlayer.ts).
export const SOUND_FILES: Record<Exclude<SoundCategory, 'white-noise'>, string> = {
  rain: 'rain.mp3',
  heartbeat: 'heartbeat.mp3',
  lullaby: 'lullaby.mp3',
  waves: 'waves.mp3',
  fan: 'fan.mp3',
}
