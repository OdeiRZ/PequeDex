// Pins the test environment's language so i18n.ts's own navigator.language
// fallback (used only when no locale is stored yet) resolves
// deterministically - jsdom/Node's own default tracks the host's OS/CI
// locale (confirmed 'en-US' here, on GitHub Actions runners too), not
// Odei's own Spanish Windows. No test currently asserts hardcoded Spanish
// text against the very first render, so nothing is broken today - this
// is preventive, closing the exact gap that broke LudoDex's identical
// fallback the moment a test did assert that (see its own test-setup.ts).
Object.defineProperty(window.navigator, 'language', {
  value: 'es-ES',
  configurable: true,
})
