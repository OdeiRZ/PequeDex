export type Category = 'feed' | 'sleep' | 'diaper' | 'growth' | 'milestone' | 'temperature'

// Las categorías visibles por defecto (usuario sin barra personalizada,
// `action_bar_categories` a null). 'temperature' existe pero NO va aquí:
// se activa a mano desde "Barra de accesos", porque solo hace falta
// cuando el bebé está malito, no a diario.
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
  temperature: 'text-temperature',
}

export const categoryBg: Record<Category, string> = {
  feed: 'bg-feed/15',
  sleep: 'bg-sleep/15',
  diaper: 'bg-diaper/15',
  growth: 'bg-growth/15',
  milestone: 'bg-milestone/15',
  temperature: 'bg-temperature/15',
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
  temperature: 'bg-temperature',
}

// Fondo sólido para poner TEXTO O ICONOS BLANCOS encima (tarjetas del resumen,
// chips activos de "Tu cuenta"): el tono "fuerte" de assets/base.css, que da al
// menos 4,8:1 con blanco en los dos temas. Las barras de las gráficas siguen con
// categorySolidBg, sin texto encima.
export const categoryStrongBg: Record<Category, string> = {
  feed: 'bg-feed-strong',
  sleep: 'bg-sleep-strong',
  diaper: 'bg-diaper-strong',
  growth: 'bg-growth-strong',
  milestone: 'bg-milestone-strong',
  temperature: 'bg-temperature-strong',
}

// Ring in the category's own color, paired with `.card-interactive`'s
// hover/active lift on EntryCard - the card's rest state already reads
// as "feed" etc. via categoryBg, so the ring only needs to show up as
// extra emphasis on hover/press, not all the time. `active:` alongside
// `hover:` since a touch tap never matches `:hover` - without it this
// ring never appeared at all on a phone.
export const categoryRing: Record<Category, string> = {
  feed: 'hover:ring-feed/40 active:ring-feed/40',
  sleep: 'hover:ring-sleep/40 active:ring-sleep/40',
  diaper: 'hover:ring-diaper/40 active:ring-diaper/40',
  growth: 'hover:ring-growth/40 active:ring-growth/40',
  milestone: 'hover:ring-milestone/40 active:ring-milestone/40',
  temperature: 'hover:ring-temperature/40 active:ring-temperature/40',
}
