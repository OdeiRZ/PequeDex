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
