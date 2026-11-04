import { $, esc, fmt } from './dom'
import { lastLineStartedBy, state } from './state'

export interface WordClick {
  word: string
  lineIdx: number
  el: HTMLElement
}

let onWord: ((w: WordClick) => void) | null = null
let savedWords: Set<string> = new Set()

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null

/** Tách câu thành các token, mỗi từ là một nút bấm được. */
function tokenize(text: string, lineIdx: number): string {
  const parts: { text: string; word: boolean }[] = segmenter
    ? [...segmenter.segment(text)].map((s) => ({ text: s.segment, word: !!s.isWordLike }))
    : text.split(/(\s+)/).map((t) => ({ text: t, word: /\p{L}/u.test(t) }))
  return parts
    .map((p) => {
      if (!p.word) return esc(p.text)
      const key = p.text.toLowerCase().replace(/[’']s$/, '')
      const saved = savedWords.has(key) ? ' saved' : ''
      return `<button class="w${saved}" data-w="${esc(key)}" data-line="${lineIdx}">${esc(p.text)}</button>`
    })
    .join('')
}

export function setSavedWords(words: Iterable<string>): void {
  savedWords = new Set(words)
}

export function onWordClick(cb: (w: WordClick) => void): void {
  onWord = cb
}

export function setSourceChip(text: string | null): void {
  $('srcChip').hidden = !text
  $('srcChipText').textContent = text ?? ''
}

export function initCurrentLine(): void {
  $('nowOrig').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.w')
    if (!b || !onWord) return
    onWord({ word: b.dataset.w ?? '', lineIdx: Number(b.dataset.line), el: b })
  })
  renderNow()
}

export function renderNow(): void {
  const o = $('nowOrig')
  const v = $('nowVi')
  const label = $('nowLabel')
  const L = state.lines
  if (!L.length) {
    label.textContent = 'Câu đang nói'
    o.innerHTML = state.emptyMsg ? `<span class="now-empty">${esc(state.emptyMsg)}</span>` : ''
    v.textContent = ''
    return
  }
  const i = state.idx
  const show = i >= 0 ? i : Math.max(0, lastLineStartedBy(state.t))
  const l = L[show]
  label.textContent = i >= 0 ? `Câu ${i + 1} / ${L.length} · ${fmt(l.s)}` : 'Câu gần nhất'
  o.innerHTML = tokenize(l.en, show)
  v.textContent = l.vi
}

