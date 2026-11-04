import { $ } from './dom'
import { renderFoot } from './transcriptPanel'

let vocabCount = 0

export function setVocabCount(n: number): void {
  vocabCount = n
  $('vCount').textContent = String(n)
  if (!$('vList').hidden) renderFoot(n)
}

/** Danh sách "Từ đã lưu" (Phase 4 sẽ đổ dữ liệu thật vào đây). */
export function renderVocabList(): void {
  $('vList').innerHTML =
    '<div class="empty">Chưa có từ nào.<br>Bấm vào một từ trong ô “Câu đang nói” để tra nghĩa và lưu lại.</div>'
}

export function showTab(vocab: boolean): void {
  $('tabT').setAttribute('aria-selected', String(!vocab))
  $('tabV').setAttribute('aria-selected', String(vocab))
  $('tList').hidden = vocab
  $('vList').hidden = !vocab
  $('tTools').hidden = vocab
  renderFoot(vocab ? vocabCount : undefined)
}

export function initTabs(): void {
  $('tabT').onclick = () => showTab(false)
  $('tabV').onclick = () => showTab(true)
  renderVocabList()
}

