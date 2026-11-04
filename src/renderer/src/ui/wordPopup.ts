import type { WordDefinition } from '../../../shared/types'
import { $ } from './dom'
import { toast } from './toast'

export interface WordPopupOptions {
  word: string
  context: string
  videoId: string
  timestamp: number
  srcLang: string
  targetEl: HTMLElement
  isSaved: boolean
  onSave(def: WordDefinition): Promise<void>
}

let activeOptions: WordPopupOptions | null = null

export function initWordPopup(): void {
  const pop = $('pop')
  $('popClose').onclick = closeWordPopup
  $('popSave').onclick = async () => {
    if (!activeOptions) return
    const saveBtn = $<HTMLButtonElement>('popSave')
    saveBtn.disabled = true
    try {
      await activeOptions.onSave({
        word: $('popWord').textContent || activeOptions.word,
        ipa: $('popIpa').textContent || undefined,
        pos: $('popPos').textContent || undefined,
        meaning: $('popMean').textContent || ''
      })
      saveBtn.textContent = 'Đã lưu'
      toast(`Đã lưu “${activeOptions.word}”`)
      closeWordPopup()
    } catch (e) {
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
}

export async function showWordPopup(opts: WordPopupOptions): Promise<void> {
  activeOptions = opts
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
  saveBtn.disabled = opts.isSaved

  // Định vị popover
  pop.hidden = false
  const r = opts.targetEl.getBoundingClientRect()
  const pw = pop.offsetWidth || 270
  const ph = pop.offsetHeight || 160

  let left = Math.min(Math.max(16, r.left), window.innerWidth - pw - 16)
  let top = r.bottom + 8
  if (top + ph > window.innerHeight - 16) {
    top = r.top - ph - 8
  }
  pop.style.left = `${left}px`
  pop.style.top = `${Math.max(16, top)}px`

  // Gọi tra nghĩa từ
  try {
    const res = await window.api.lookupWord(opts.word, opts.srcLang)
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
  } catch (e) {
    if (activeOptions === opts) {
      meanEl.textContent = 'Lỗi kết nối khi tra từ.'
    }
  }
}

