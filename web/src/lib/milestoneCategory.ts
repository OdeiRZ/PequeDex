import type { MilestoneCategory } from '@/stores/babies'

// Emoji, not an icon set - matches this app's existing 👶-over-custom-icon
// convention (see the dashboard header) and needs no new assets per category.
export const milestoneCategoryEmoji: Record<MilestoneCategory, string> = {
  sonrisa: '😊',
  diente: '🦷',
  pasos: '👣',
  palabra: '🗣️',
  otro: '⭐',
}

export const milestoneCategories: MilestoneCategory[] = [
  'sonrisa',
  'diente',
  'pasos',
  'palabra',
  'otro',
]
