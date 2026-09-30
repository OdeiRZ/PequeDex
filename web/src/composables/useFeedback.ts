import { useAuthStore } from '@/stores/auth'

export type FeedbackKind = 'tap' | 'success' | 'error'

// Mismos patrones que ya usaba toast.ts en su hapticBuzz() local (10ms
// para éxito, [12, 40, 12] para error) - se mantienen tal cual, ya
// estaban calibrados, en vez de inventar otros al centralizarlos aquí.
// 'tap' es más corto porque ocurre en casi cada pulsación, no solo en
// confirmaciones puntuales.
const VIBRATION_PATTERNS: Record<FeedbackKind, number | number[]> = {
  tap: 8,
  success: 10,
  error: [12, 40, 12],
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
// audio. Volumen deliberadamente bajo en los 3 tonos: son confirmaciones
// de interfaz, no el contenido de Sonidos para dormir.
function playBlip(ctx: AudioContext, startAt: number, frequency: number, peakGain: number): void {
  const duration = 0.09
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

function playTone(kind: FeedbackKind): void {
  const ctx = getAudioCtx()
  if (!ctx) return

  const now = ctx.currentTime
  if (kind === 'tap') {
    playBlip(ctx, now, 700, 0.05)
  } else if (kind === 'success') {
    playBlip(ctx, now, 600, 0.06)
    playBlip(ctx, now + 0.08, 900, 0.06)
  } else {
    playBlip(ctx, now, 220, 0.07)
    playBlip(ctx, now + 0.1, 220, 0.07)
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
  }
}
