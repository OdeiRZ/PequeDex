import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es'
import en from '@/locales/en'

export type Locale = 'es' | 'en'

const STORAGE_KEY = 'pequedex_locale'

// An explicit choice (made from "Tu cuenta", the only place to change it
// now that there's no header toggle) always wins. Without one yet -
// notably on login/register, where nobody's account exists to hold a
// preference - fall back to the browser's own language instead of
// hardcoding Spanish, so a recruiter browsing the portfolio in English
// sees these screens in English too.
export function getStoredLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'es') return stored

  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es'
}

export function storeLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale)
}

export const i18n = createI18n({
  legacy: false,
  locale: getStoredLocale(),
  fallbackLocale: 'es',
  messages: { es, en },
})

// Keeps <html lang> in sync with the active locale (accessibility/SEO),
// including the very first paint - index.html hardcodes lang="es" as a
// static fallback for when JS hasn't run yet.
document.documentElement.lang = i18n.global.locale.value
watch(i18n.global.locale, (locale) => {
  document.documentElement.lang = locale
})
