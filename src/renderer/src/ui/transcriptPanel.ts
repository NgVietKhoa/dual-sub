import { $, esc, fmt } from './dom'
import { state } from './state'

let lineEls: HTMLElement[] = []
let onSeekLine: (i: number) => void = () => {}

export function initTranscript(cb: (i: number) => void): void {
  onSeekLine = cb
  const list = $('tList')
  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.line')
    if (b) onSeekLine(Number(b.dataset.i))
  })
  $<HTMLInputElement>('filter').addEventListener('input', applyFilter)
  renderFoot()
}

export function renderTranscript(): void {
  const list = $('tList')
  if (!state.lines.length) {
    list.innerHTML = `<div class="empty">${esc(
      state.emptyMsg || 'Mở một video để xem transcript.'
    )}</div>`
    lineEls = []
    renderFoot()
    return
  }
  list.innerHTML = state.lines
    .map(
      (l, i) =>
        `<button class="line" type="button" data-i="${i}"><span class="ts">${fmt(l.s)}</span><span class="en">${esc(l.en)}</span><span class="vi">${esc(l.vi)}</span></button>`
    )
    .join('')
  lineEls = [...list.children] as HTMLElement[]
  applyFilter()
  renderFoot()
}

/** Cập nhật riêng bản dịch (dịch nền) mà không dựng lại cả danh sách. */
export function updateItemsTranslation(items: { i: number; text: string }[]): void {
  for (const it of items) {
    if (lineEls[it.i]) {
      const vi = lineEls[it.i].querySelector('.vi')
      if (vi) vi.textContent = it.text
    }
  }
  applyFilter()
}

export function updateTranslations(from: number, to: number): void {
  for (let i = from; i < to && i < lineEls.length; i++) {
    const vi = lineEls[i].querySelector('.vi')
    if (vi) vi.textContent = state.lines[i].vi
  }
  applyFilter()
}

function applyFilter(): void {
  const q = $<HTMLInputElement>('filter').value.trim().toLowerCase()
  lineEls.forEach((el, i) => {
    const l = state.lines[i]
    el.hidden = !!q && !(l.en.toLowerCase().includes(q) || l.vi.toLowerCase().includes(q))
  })
}

export function setActiveLine(i: number): void {
  lineEls.forEach((el, k) => {
    el.classList.toggle('active', k === i)
    el.classList.toggle('past', i >= 0 && k < i)
  })
  if (i >= 0 && $<HTMLInputElement>('follow').checked) {
    const list = $('tList')
    const el = lineEls[i]
    if (!el) return
    const top = el.offsetTop - list.offsetTop - list.clientHeight / 3
    list.scrollTo({
      top,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    })
  }
}

export function renderFoot(vocabCount?: number): void {
  const foot = $('footInfo')
  if (vocabCount !== undefined) {
    foot.textContent = `${vocabCount} từ đã lưu`
    return
  }
  const n = state.lines.length
  foot.textContent = n ? `${n} câu · ${Math.round(state.duration)} giây` : 'Chưa có transcript'
}

