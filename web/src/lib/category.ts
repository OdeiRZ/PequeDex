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
