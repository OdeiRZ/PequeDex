import type { DiaperResidueColor } from '@/stores/babies'

// Real, muted tones instead of pure CSS named colors - meconium reads
// closer to near-black than a flat "black" swatch would suggest. Shared
// between the picker in the "+ Pañal" form and the small color dot next
// to a diaper entry in the timeline (DashboardView.vue), so both always
// agree on what each color actually looks like.
export const DIAPER_RESIDUE_COLOR_HEX: Record<DiaperResidueColor, string> = {
  verde: '#5C8A3A',
  amarillo: '#E8B93F',
  marron: '#8B5A2B',
  meconio: '#1C1C1C',
}
