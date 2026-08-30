// Reference-counted, not a plain save/restore: every quick-log/settings/
// detail sheet in DashboardView.vue is its own BottomSheet instance, all
// mounted at once (only `open` toggles per instance). `<script setup>`
// code re-runs for every component instance - a `let` declared there
// would give each sheet its own private counter, unaware of the others,
// which is exactly what broke this the first time (verified by a failing
// test: closing one sheet while a second was still open unlocked scroll
// for the page underneath it). A real module's top-level state, unlike
// `<script setup>`'s, only runs once and is shared by every importer -
// which is what a *correct* shared lock actually needs.
let lockCount = 0
let previousBodyOverflow = ''

export function lockBodyScroll(): void {
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount++
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = previousBodyOverflow
  }
}
