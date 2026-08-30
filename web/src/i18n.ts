import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es'
import en from '@/locales/en'

export type Locale = 'es' | 'en'

const STORAGE_KEY = 'pequedex_locale'

// Spanish is the app's real default - the two people who actually use it
// day to day speak Spanish - English is there for the portfolio/recruiter
// audience, not because the app has English-speaking users yet.
export function getStoredLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en' ? 'en' : 'es'
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
