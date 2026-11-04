import type { WordDefinition } from '../../../shared/types'
import { $ } from './dom'
import { toast } from './toast'

export interface WordPopupOptions {
  word: string
  /** Ngôn ngữ của từ và ngôn ngữ giải nghĩa */
  from: string
  to: string
  targetEl: HTMLElement
  isSaved: boolean
  onSave(def: WordDefinition): Promise<void>
}

let activeOptions: WordPopupOptions | null = null
/** Kết quả tra của popup đang mở; null khi đang tra hoặc tra lỗi (không cho lưu). */
let activeDef: WordDefinition | null = null

export function initWordPopup(): void {
  const pop = $('pop')
  $('popClose').onclick = closeWordPopup
  $('popSave').onclick = async () => {
    if (!activeOptions || !activeDef) return
    const saveBtn = $<HTMLButtonElement>('popSave')
    saveBtn.disabled = true
    try {
      await activeOptions.onSave(activeDef)
      toast(`Đã lưu “${activeOptions.word}”`)
      closeWordPopup()
    } catch {
      toast('Lỗi khi lưu từ')
      saveBtn.disabled = false
    }
  }

  document.addEventListener('click', (e) => {
    if (!pop.hidden && !pop.contains(e.target as Node) && !(e.target as HTMLElement).closest('.w')) {
      closeWordPopup()
    }
  })
}

export function closeWordPopup(): void {
  $('pop').hidden = true
  activeOptions = null
  activeDef = null
}

export async function showWordPopup(opts: WordPopupOptions): Promise<void> {
  activeOptions = opts
  activeDef = null
  const pop = $('pop')
  const wordEl = $('popWord')
  const ipaEl = $('popIpa')
  const posEl = $('popPos')
  const meanEl = $('popMean')
  const saveBtn = $<HTMLButtonElement>('popSave')

  wordEl.textContent = opts.word
  ipaEl.textContent = ''
  ipaEl.hidden = true
  posEl.textContent = ''
  posEl.hidden = true
  meanEl.textContent = 'Đang tra nghĩa…'

  saveBtn.textContent = opts.isSaved ? 'Đã lưu' : 'Lưu từ'
  saveBtn.disabled = true

  // Định vị popover
  pop.hidden = false
  const r = opts.targetEl.getBoundingClientRect()
  const pw = pop.offsetWidth || 270
  const ph = pop.offsetHeight || 160

  const left = Math.min(Math.max(16, r.left), window.innerWidth - pw - 16)
  let top = r.bottom + 8
  if (top + ph > window.innerHeight - 16) {
    top = r.top - ph - 8
  }
  pop.style.left = `${left}px`
  pop.style.top = `${Math.max(16, top)}px`

  const res = await window.api.lookupWord(opts.word, opts.from, opts.to)
  if (activeOptions !== opts) return // Người dùng đã bấm từ khác

  if (!res.ok) {
    meanEl.textContent = res.error.message
    return
  }

  const data = res.data
  wordEl.textContent = data.word || opts.word
  if (data.ipa) {
    ipaEl.textContent = data.ipa
    ipaEl.hidden = false
  }
  if (data.pos) {
    posEl.textContent = data.pos
    posEl.hidden = false
  }
  meanEl.textContent = data.meaning || 'Không tìm thấy nghĩa.'
  if (data.meaning) {
    activeDef = { ...data, word: data.word || opts.word }
    saveBtn.disabled = opts.isSaved
  }
}
