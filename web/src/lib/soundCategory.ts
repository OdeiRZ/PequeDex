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
// genera en el momento con Web Audio (ver useSoundPlayer.ts). El resto
// ya son ficheros reales (~15 min cada uno, no la grabación original de
// ~20min-1h): el <audio loop> del navegador repite el fichero cuantas
// veces haga falta para cubrir la duración elegida en el temporizador
// (nada en useSoundPlayer.ts depende de la duración real del fichero),
// así que 15 min de textura continua (sin melodía) ya cubre de sobra
// incluso "60 min"/"Sin límite" sin que se note la repetición.
// Preparados con un crossfade real de unos segundos entre el final y el
// propio principio del clip (filtro `acrossfade` de ffmpeg) en vez de
// solo recortar a tijeretazo, para que el punto donde el bucle empalma
// consigo mismo no suene como un salto brusco.
export const SOUND_FILES: Record<Exclude<SoundCategory, 'white-noise'>, string> = {
  rain: 'rain.mp3',
  heartbeat: 'heartbeat.mp3',
  lullaby: 'lullaby.mp3',
  waves: 'waves.mp3',
  fan: 'fan.mp3',
}

// Tailwind's scanner needs these class names to appear literally in source
// somewhere - a template literal like `text-sound-${category}` would never
// match, so every category/utility combination is spelled out here once
// (mismo criterio que categoryText/categoryBg en lib/category.ts).
export const soundText: Record<SoundCategory, string> = {
  'white-noise': 'text-sound-white-noise',
  rain: 'text-sound-rain',
  heartbeat: 'text-sound-heartbeat',
  lullaby: 'text-sound-lullaby',
  waves: 'text-sound-waves',
  fan: 'text-sound-fan',
}

export const soundBg: Record<SoundCategory, string> = {
  'white-noise': 'bg-sound-white-noise/15',
  rain: 'bg-sound-rain/15',
  heartbeat: 'bg-sound-heartbeat/15',
  lullaby: 'bg-sound-lullaby/15',
  waves: 'bg-sound-waves/15',
  fan: 'bg-sound-fan/15',
}
