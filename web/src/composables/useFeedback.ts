import { useAuthStore } from '@/stores/auth'

export type FeedbackKind =
  'tap' | 'success' | 'error' | 'cancel' | 'select' | 'nav' | 'navBack' | 'theme'

// Patrones de vibración, uno por tipo - success/error vienen de lo que ya
// tenía toast.ts antes de esta feature (10ms / [12, 40, 12]), se mantienen
// tal cual. El resto son cortos y sutiles a propósito (ocurren en casi
// cada interacción, no solo en confirmaciones puntuales): 'select' lleva
// un patrón de dos pulsos para que se note como un "tic-tic" distinto de
// un único 'tap', y 'theme'/'nav' son un pulso algo más largo que 'tap' -
// marcan un cambio más notable (de modo, de sección) que una pulsación
// cualquiera.
const VIBRATION_PATTERNS: Record<FeedbackKind, number | number[]> = {
  tap: 8,
  success: 10,
  error: [12, 40, 12],
  cancel: 6,
  select: [5, 18, 5],
  nav: 14,
  navBack: 10,
  theme: 16,
}

function vibrate(kind: FeedbackKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return

  try {
    navigator.vibrate(VIBRATION_PATTERNS[kind])
  } catch {
    // Ignorado - la háptica es un extra, nunca algo que merezca romper
    // la interacción real del usuario.
  }
}

// Un único AudioContext reutilizado entre llamadas (no uno nuevo por
// pulsación) - mismo motivo que evitar abrir un AudioContext por click
// en cualquier otro sitio: acumularían sin cerrarse nunca.
let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    // AudioContext puede no existir en algunos entornos (tests, navegadores
    // muy antiguos) - la háptica de arriba sigue funcionando igualmente.
    return null
  }
}

// Un tono corto con envolvente de ataque/caída (en vez de un simple on/off)
// para que no suene como un clic seco - mismo GainNode + OscillatorNode que
// ya usa useSoundPlayer.ts para el ruido blanco, sin ningún fichero de
// audio. Volumen deliberadamente bajo en todos los tonos: son
// confirmaciones de interfaz, no el contenido de Sonidos para dormir.
function playBlip(
  ctx: AudioContext,
  startAt: number,
  frequency: number,
  peakGain: number,
  duration = 0.09,
): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.012)
  gain.gain.linearRampToValueAtTime(0, startAt + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

// Como playBlip, pero deslizando la frecuencia en vez de mantenerla fija -
// un "swoosh" en vez de un pitido, para 'cancel' (desliza hacia abajo,
// como un paso atrás) y 'nav' (desliza hacia arriba, como entrar en un
// sitio nuevo). Textura claramente distinta a los tonos de tono fijo, no
// solo una frecuencia distinta.
function playSweep(
  ctx: AudioContext,
  startAt: number,
  fromFreq: number,
  toFreq: number,
  peakGain: number,
  duration: number,
): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(fromFreq, startAt)
  oscillator.frequency.linearRampToValueAtTime(toFreq, startAt + duration)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.015)
  gain.gain.linearRampToValueAtTime(0, startAt + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

function playTone(kind: FeedbackKind): void {
  const ctx = getAudioCtx()
  if (!ctx) return

  const now = ctx.currentTime
  switch (kind) {
    case 'tap':
      playBlip(ctx, now, 700, 0.05)
      break
    case 'success':
      playBlip(ctx, now, 600, 0.06)
      playBlip(ctx, now + 0.08, 900, 0.06)
      break
    case 'error':
      playBlip(ctx, now, 220, 0.07)
      playBlip(ctx, now + 0.1, 220, 0.07)
      break
    case 'cancel':
      // Un único tono bajando - "dar un paso atrás", ni alarmante como
      // error (grave y doble) ni neutro como tap, a medio camino.
      playSweep(ctx, now, 500, 320, 0.045, 0.11)
      break
    case 'select':
      // Dos blips muy cortos y agudos seguidos - el "tic-tic" de un
      // dial/selector, distinto del blip único de tap.
      playBlip(ctx, now, 950, 0.04, 0.045)
      playBlip(ctx, now + 0.055, 950, 0.04, 0.045)
      break
    case 'nav':
      // Arpegio de 3 notas rápidas y ascendentes - "entrando" en una
      // sección nueva (Contracciones, Sonidos para dormir...). Notas
      // discretas en vez de un barrido continuo (que sonaba más a
      // "silbido" que a confirmación): más parecido al timbre de
      // cambiar de sala/canal de una app de chat.
      playBlip(ctx, now, 494, 0.045, 0.06)
      playBlip(ctx, now + 0.05, 587, 0.045, 0.06)
      playBlip(ctx, now + 0.1, 740, 0.05, 0.08)
      break
    case 'navBack':
      // El mismo arpegio de 'nav', mismas 3 notas, tocadas al revés -
      // "saliendo" de la sección en vez de entrando. Más corto en
      // conjunto (notas más próximas entre sí) para que se lea como un
      // repliegue rápido, no como una entrada espejada a cámara lenta.
      playBlip(ctx, now, 740, 0.045, 0.06)
      playBlip(ctx, now + 0.045, 587, 0.045, 0.06)
      playBlip(ctx, now + 0.09, 494, 0.05, 0.08)
      break
    case 'theme':
      // Un timbre suave de dos notas superpuestas, más largo que el
      // resto - un cambio de modo (día/noche) es menos frecuente que un
      // tap o un select, puede permitirse sonar un poco más presente.
      playBlip(ctx, now, 520, 0.05, 0.16)
      playBlip(ctx, now + 0.05, 780, 0.04, 0.16)
      break
  }
}

function isEnabled(): boolean {
  // Comprobado en cada llamada, no cacheado - activar/desactivar el
  // ajuste en "Tu cuenta" debe tener efecto inmediato sin recargar.
  return useAuthStore().user?.interaction_feedback_enabled ?? true
}

function fire(kind: FeedbackKind): void {
  if (!isEnabled()) return
  vibrate(kind)
  playTone(kind)
}

export function useFeedback() {
  return {
    tap: () => fire('tap'),
    success: () => fire('success'),
    error: () => fire('error'),
    cancel: () => fire('cancel'),
    select: () => fire('select'),
    nav: () => fire('nav'),
    navBack: () => fire('navBack'),
    theme: () => fire('theme'),
    // Solo vibración, sin tono - para un "preaviso" a mitad de un gesto
    // en curso (el swipe-to-delete de EntryCard.vue). Un sonido ahí, a
    // mitad de un arrastre que el usuario aún puede cancelar, se sentiría
    // fuera de lugar; un pulso háptico breve no.
    warnVibrate: () => {
      if (!isEnabled()) return
      vibrate('cancel')
    },
  }
}
