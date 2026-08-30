export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'pequedex_theme'

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function storeTheme(theme: Theme): void {
  if (theme === 'system') {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, theme)
  }
}

// 'system' leaves data-theme unset so the prefers-color-scheme media query
// in base.css decides - only an explicit light/dark choice overrides it.
export function applyTheme(theme: Theme): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}
