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

// Mirrors --bg from base.css - keeps the Android status bar/toolbar color
// (driven by <meta name="theme-color">) matching the app's actual
// background instead of a stale fixed color, in an installed PWA.
const THEME_COLOR: Record<'light' | 'dark', string> = {
  light: '#fbf7f2',
  dark: '#1c1b22',
}

// 'system' leaves data-theme unset so the prefers-color-scheme media query
// in base.css decides - only an explicit light/dark choice overrides it.
export function applyTheme(theme: Theme): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }

  // #theme-color-override has no `media` attribute, so once it has content
  // it wins over the two prefers-color-scheme tags in index.html regardless
  // of the OS setting - clearing its content on 'system' lets those two
  // take back over, same "explicit choice beats OS default" rule as
  // data-theme above.
  const override = document.getElementById('theme-color-override')
  if (override) {
    override.setAttribute('content', theme === 'system' ? '' : THEME_COLOR[theme])
  }
}
