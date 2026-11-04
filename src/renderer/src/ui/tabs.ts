import { $ } from './dom'
import { renderFoot } from './transcriptPanel'

type Tab = 'T' | 'V' | 'H'

let current: Tab = 'T'
let vocabCount = 0
let watchedCount = 0

/** Dòng chân của khung bên phải theo tab đang mở. */
function renderTabFoot(): void {
  if (current === 'T') return renderFoot()
  $('footInfo').textContent = current === 'V' ? `${vocabCount} từ đã lưu` : `${watchedCount} video đã xem`
}

export function setVocabCount(n: number): void {
  vocabCount = n
  $('vCount').textContent = String(n)
  renderTabFoot()
}

export function setWatchedCount(n: number): void {
  watchedCount = n
  $('hCount').textContent = String(n)
  renderTabFoot()
}

export function showTab(tab: Tab): void {
  current = tab
  for (const t of ['T', 'V', 'H'] as const) {
    $(`tab${t}`).setAttribute('aria-selected', String(t === tab))
    $(`${t.toLowerCase()}List`).hidden = t !== tab
  }
  $('tTools').hidden = tab !== 'T'
  renderTabFoot()
}

export function initTabs(): void {
  $('tabT').onclick = () => showTab('T')
  $('tabV').onclick = () => showTab('V')
  $('tabH').onclick = () => showTab('H')
}
