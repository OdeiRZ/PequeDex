import { computed, ref } from 'vue'
import { i18n } from '@/i18n'
import { SOUND_CATEGORIES, SOUND_FILES, type SoundCategory } from '@/lib/soundCategory'

export type DurationOption = '15' | '30' | '45' | '60' | 'unlimited'

const DURATION_SECONDS: Record<Exclude<DurationOption, 'unlimited'>, number> = {
  '15': 15 * 60,
  '30': 30 * 60,
  '45': 45 * 60,
  '60': 60 * 60,
}

// Fracción final de la cuenta atrás en la que el volumen empieza a bajar
// antes de parar, en vez de cortar en seco.
const FADE_FRACTION = 0.1

// El ruido blanco se genera a escala completa (Math.random()*2-1, RMS de
// ~-4.8dBFS), mucho más fuerte que los ficheros mp3 reales (rain.mp3/
// fan.mp3 rondan -22.5dB de media, medido con `ffmpeg -af volumedetect`)
// - sin este factor sonaba notablemente más alto que el resto incluso al
// mínimo de volumen del dispositivo, porque la diferencia está en la
// señal generada, no en nada que el volumen del sistema pueda compensar.
// 0.13 ≈ 10^((-22.5 - -4.8) / 20), la ganancia que iguala su RMS al de
// las otras categorías.
const WHITE_NOISE_GAIN = 0.13

// Fundido de entrada al arrancar cualquier sonido, fijo e independiente de
// la duración total elegida (a diferencia del fundido de salida, que sí
// escala con FADE_FRACTION) - empezar en silencio y subir en poco más de
// un segundo evita el "golpe" de volumen al pulsar reproducir.
const FADE_IN_SECONDS = 1.5
const FADE_IN_STEP_MS = 100

const STORAGE_KEY = 'pequedex_sound_last'

interface StoredSelection {
  category: SoundCategory
  duration: DurationOption
}

function loadLast(): StoredSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'category' in parsed &&
      'duration' in parsed
    ) {
      return parsed as StoredSelection
    }
    return null
  } catch {
    return null
  }
}

function storeLast(category: SoundCategory, duration: DurationOption): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ category, duration }))
}

// Estado a nivel de módulo (singleton real, no un ref nuevo por llamada,
// mismo criterio que useTheme.ts de LudoDex) - el sonido debe seguir
// sonando si el usuario navega fuera de /sonidos, así que no puede vivir
// en el estado local de SoundsView.vue.
const initial = loadLast()
const playing = ref(false)
const category = ref<SoundCategory | null>(initial?.category ?? null)
const durationOption = ref<DurationOption>(initial?.duration ?? '30')
const remainingSeconds = ref(0)
const totalSeconds = ref(0)
const unavailable = ref<Set<SoundCategory>>(new Set())

const fadingOut = computed(
  () =>
    playing.value &&
    totalSeconds.value > 0 &&
    remainingSeconds.value / totalSeconds.value <= FADE_FRACTION,
)

let tickHandle: ReturnType<typeof setInterval> | null = null
let fadeInHandle: ReturnType<typeof setInterval> | null = null
let fadeStarted = false

// Ruta ruido blanco (Web Audio, sin fichero)
let audioCtx: AudioContext | null = null
let noiseSource: AudioBufferSourceNode | null = null
let gainNode: GainNode | null = null

// Ruta con fichero real - un único <audio> reutilizado entre categorías,
// creado una sola vez (no por reproducción) para no reenganchar el
// listener de error en cada play().
let audioEl: HTMLAudioElement | null = null

function getAudioEl(): HTMLAudioElement {
  if (audioEl) return audioEl
  audioEl = new Audio()
  audioEl.loop = true
  audioEl.addEventListener('error', () => {
    if (category.value && category.value !== 'white-noise') {
      unavailable.value.add(category.value)
    }
    stop()
  })
  return audioEl
}

function startWhiteNoise(): void {
  audioCtx = new AudioContext()
  const bufferSize = 2 * audioCtx.sampleRate
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  noiseSource = audioCtx.createBufferSource()
  noiseSource.buffer = buffer
  noiseSource.loop = true

  gainNode = audioCtx.createGain()
  gainNode.gain.value = 0
  noiseSource.connect(gainNode).connect(audioCtx.destination)
  noiseSource.start()
  gainNode.gain.linearRampToValueAtTime(WHITE_NOISE_GAIN, audioCtx.currentTime + FADE_IN_SECONDS)
}

function fadeInAudioEl(el: HTMLAudioElement): void {
  el.volume = 0
  const totalSteps = Math.round((FADE_IN_SECONDS * 1000) / FADE_IN_STEP_MS)
  let step = 0
  fadeInHandle = setInterval(() => {
    step++
    el.volume = Math.min(1, step / totalSteps)
    if (step >= totalSteps && fadeInHandle) {
      clearInterval(fadeInHandle)
      fadeInHandle = null
    }
  }, FADE_IN_STEP_MS)
}

function startFile(cat: Exclude<SoundCategory, 'white-noise'>): void {
  const el = getAudioEl()
  el.src = `${import.meta.env.BASE_URL}sounds/${SOUND_FILES[cat]}`
  el.currentTime = 0
  // Un rechazo aquí (política de autoplay, fichero ausente antes de que
  // el evento "error" llegue a dispararse) se trata igual que un 404 -
  // no hay forma de distinguir uno de otro desde fuera, y en ambos casos
  // lo correcto es lo mismo: marcar el sonido como no disponible.
  el.play().catch(() => {
    unavailable.value.add(cat)
    stop()
  })
  fadeInAudioEl(el)
}

function stopAudioGraph(): void {
  if (noiseSource) {
    try {
      noiseSource.stop()
    } catch {
      // ya parado
    }
    noiseSource.disconnect()
    noiseSource = null
  }
  if (gainNode) {
    gainNode.disconnect()
    gainNode = null
  }
  if (audioCtx) {
    void audioCtx.close()
    audioCtx = null
  }
  if (audioEl) {
    audioEl.pause()
    audioEl.currentTime = 0
    audioEl.volume = 1
  }
}

function applyFadeStep(): void {
  if (durationOption.value === 'unlimited') return

  if (category.value === 'white-noise') {
    if (!fadeStarted && gainNode && audioCtx) {
      fadeStarted = true
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + remainingSeconds.value)
    }
    return
  }

  if (audioEl) {
    const fadeWindowSeconds = Math.max(1, totalSeconds.value * FADE_FRACTION)
    audioEl.volume = Math.max(0, Math.min(1, remainingSeconds.value / fadeWindowSeconds))
  }
}

// El id interno (p.ej. "white-noise") nunca se muestra tal cual en la
// notificación/pantalla de bloqueo - se traduce con el mismo i18n que
// usa el resto de la app (i18n.global.t, no el t() de un componente,
// porque este composable no es uno) y se capitaliza la primera letra
// por si algún día una traducción no la trae ya en mayúscula.
function categoryLabel(cat: SoundCategory): string {
  const entry = SOUND_CATEGORIES.find((c) => c.id === cat)
  const label = entry ? i18n.global.t(entry.labelKey) : cat
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function setMediaSession(): void {
  try {
    if (!('mediaSession' in navigator) || !category.value) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: categoryLabel(category.value),
      artist: 'PequeDex',
    })
    navigator.mediaSession.playbackState = 'playing'
    navigator.mediaSession.setActionHandler('play', () => {
      if (category.value) play(category.value, durationOption.value)
    })
    navigator.mediaSession.setActionHandler('pause', () => stop())
  } catch {
    // navigator.mediaSession puede no existir en algunos entornos
    // (Safari antiguo, tests) - mejor esfuerzo, nunca bloqueante.
  }
}

function clearMediaSession(): void {
  try {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = 'none'
  } catch {
    // ver setMediaSession()
  }
}

function tick(): void {
  if (durationOption.value === 'unlimited') return

  remainingSeconds.value = Math.max(0, remainingSeconds.value - 1)
  if (remainingSeconds.value / totalSeconds.value <= FADE_FRACTION) {
    applyFadeStep()
  }
  if (remainingSeconds.value <= 0) {
    stop()
  }
}

function play(cat: SoundCategory, duration: DurationOption): void {
  stop()

  category.value = cat
  durationOption.value = duration
  storeLast(cat, duration)

  totalSeconds.value = duration === 'unlimited' ? 0 : DURATION_SECONDS[duration]
  remainingSeconds.value = totalSeconds.value
  fadeStarted = false

  if (cat === 'white-noise') {
    startWhiteNoise()
  } else {
    startFile(cat)
  }

  playing.value = true
  setMediaSession()
  tickHandle = setInterval(tick, 1000)
}

function stop(): void {
  if (tickHandle) {
    clearInterval(tickHandle)
    tickHandle = null
  }
  if (fadeInHandle) {
    clearInterval(fadeInHandle)
    fadeInHandle = null
  }
  stopAudioGraph()
  playing.value = false
  remainingSeconds.value = 0
  clearMediaSession()
}

function setDuration(duration: DurationOption): void {
  durationOption.value = duration
  if (!playing.value) return

  // Si ya estábamos dentro de la ventana de fundido de salida, calculado
  // con los valores de ANTES de tocar nada de lo de abajo.
  const wasFadingOut =
    totalSeconds.value > 0 && remainingSeconds.value / totalSeconds.value <= FADE_FRACTION

  // Reinicia la cuenta atrás con la nueva duración sin cortar el audio
  // que ya está sonando.
  totalSeconds.value = duration === 'unlimited' ? 0 : DURATION_SECONDS[duration]
  remainingSeconds.value = totalSeconds.value
  fadeStarted = false

  // Sin esto, alargar la duración (o pasar a "Sin límite") mientras ya
  // sonaba el fundido de salida dejaba el sonido silenciado para siempre:
  // la automatización de Web Audio del ruido blanco queda agendada en el
  // instante absoluto en que se programó y no se cancela sola solo porque
  // remainingSeconds/totalSeconds hayan cambiado, y el <audio> se queda
  // con el volumen bajado del último tick - en ningún caso hay nada que
  // los vuelva a subir una vez la cuenta atrás se ha reiniciado.
  if (wasFadingOut) {
    if (category.value === 'white-noise' && gainNode && audioCtx) {
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime)
      gainNode.gain.setValueAtTime(WHITE_NOISE_GAIN, audioCtx.currentTime)
    } else if (audioEl) {
      audioEl.volume = 1
    }
  }

  if (category.value) storeLast(category.value, duration)
}

export function useSoundPlayer() {
  return {
    playing,
    category,
    durationOption,
    remainingSeconds,
    totalSeconds,
    unavailable,
    fadingOut,
    play,
    stop,
    setDuration,
  }
}
