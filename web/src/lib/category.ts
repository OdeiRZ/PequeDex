export type Category = 'feed' | 'sleep' | 'diaper' | 'growth' | 'milestone'

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

export const categoryBorder: Record<Category, string> = {
  feed: 'border-feed',
  sleep: 'border-sleep',
  diaper: 'border-diaper',
  growth: 'border-growth',
  milestone: 'border-milestone',
}
