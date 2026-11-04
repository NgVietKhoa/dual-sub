export interface ShortcutActions {
  togglePlay(): void
  step(d: number): void
  toggleLoop(): void
  escape(): void
}

export function initShortcuts(a: ShortcutActions): void {
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement
    if (t.matches('input,select,textarea') || t.id === 'track') return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === ' ') {
      e.preventDefault()
      a.togglePlay()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      a.step(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      a.step(-1)
    } else if (e.key === 'r' || e.key === 'R') {
      a.toggleLoop()
    } else if (e.key === 'Escape') {
      a.escape()
    }
  })
}

