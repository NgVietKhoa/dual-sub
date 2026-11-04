import { $ } from './dom'

let timer: ReturnType<typeof setTimeout> | undefined

export function toast(message: string, ms = 2600): void {
  const el = $('toast')
  el.textContent = message
  el.hidden = false
  clearTimeout(timer)
  timer = setTimeout(() => (el.hidden = true), ms)
}

