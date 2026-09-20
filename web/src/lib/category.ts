export type Category = 'feed' | 'sleep' | 'diaper' | 'growth' | 'milestone'

export const ALL_CATEGORIES: Category[] = ['feed', 'sleep', 'diaper', 'growth', 'milestone']

// Numero minimo de categorias que la barra de accesos debe mantener
// visibles - coincide con el `min:3` del backend (ver
// UpdateActionBarCategoriesRequest) para que el frontend nunca deje
// deseleccionar por debajo de lo que el servidor aceptaria.
export const MIN_ACTION_BAR_CATEGORIES = 3

// Tailwind's scanner needs these class names to appear literally in source
// somewhere - a template literal like `text-${category}` would never match,
// so every category/utility combination is spelled out here once.
export const categoryText: Record<Category, string> = {
  feed: 'text-feed',
  sleep: 'text-sleep',
  diaper: 'text-diaper',
  growth: 'text-growth',
  milestone: 'text-milestone',
}

export const categoryBg: Record<Category, string> = {
  feed: 'bg-feed/15',
  sleep: 'bg-sleep/15',
  diaper: 'bg-diaper/15',
  growth: 'bg-growth/15',
  milestone: 'bg-milestone/15',
}

// Solid (non-tinted) background - used where a toggled-on state needs to
// read clearly as "on" against a muted/outlined "off" state (see the
// action-bar picker in DashboardView.vue), rather than the softer tint
// above used for at-rest badges.
export const categorySolidBg: Record<Category, string> = {
  feed: 'bg-feed',
  sleep: 'bg-sleep',
  diaper: 'bg-diaper',
  growth: 'bg-growth',
  milestone: 'bg-milestone',
}

// Hover-only ring in the category's own color, paired with
// `.card-interactive`'s hover lift on EntryCard - the card's rest state
// already reads as "feed" etc. via categoryBg, so the ring only needs to
// show up as extra emphasis on hover, not all the time.
export const categoryRing: Record<Category, string> = {
  feed: 'hover:ring-feed/40',
  sleep: 'hover:ring-sleep/40',
  diaper: 'hover:ring-diaper/40',
  growth: 'hover:ring-growth/40',
  milestone: 'hover:ring-milestone/40',
}
