import type { SavedWord, WordDefinition } from '../../../shared/types'
import { $, esc } from './dom'
import { setSavedWords, renderNow } from './currentLine'
import { setVocabCount } from './tabs'
import { toast } from './toast'

let savedWords: SavedWord[] = []
let onSelectWordCallback: ((word: SavedWord) => void) | null = null

export function getSavedWordsList(): SavedWord[] {
  return savedWords
}

export function isWordSaved(word: string): boolean {
  const key = word.toLowerCase()
  return savedWords.some((w) => w.word.toLowerCase() === key)
}

export async function initSavedWords(onSelect: (word: SavedWord) => void): Promise<void> {
  onSelectWordCallback = onSelect
  const vList = $('vList')
  vList.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement
    const delBtn = target.closest<HTMLElement>('.x')
    if (delBtn) {
      e.stopPropagation()
      const id = delBtn.dataset.id
      if (id) {
        await deleteSavedWord(id)
      }
      return
    }

    const item = target.closest<HTMLElement>('.vocab-item')
    if (item && onSelectWordCallback) {
      const id = item.dataset.id
      const found = savedWords.find((w) => w.id === id)
      if (found) onSelectWordCallback(found)
    }
  })

  // Nút Xuất Anki
  $('exportBtn').onclick = async () => {
    if (!savedWords.length) {
      return toast('Lưu vài từ trước rồi xuất sang Anki.')
    }
    try {
      const res = await window.api.exportAnkiCsv()
      if (!res.ok) {
        return toast(res.error.message)
      }
      if (res.data.canceled) return
      toast(`Đã xuất ${res.data.count} từ vựng sang Anki thành công!`)
    } catch {
      toast('Không thể xuất file Anki.')
    }
  }

  await refreshSavedWords()
}

export async function refreshSavedWords(): Promise<void> {
  try {
    savedWords = await window.api.getSavedWords()
  } catch {
    savedWords = []
  }
  setVocabCount(savedWords.length)
  setSavedWords(savedWords.map((w) => w.word.toLowerCase()))
  renderSavedList()
  renderNow()
}

export async function addWord(
  def: WordDefinition,
  example: string,
  videoId: string,
  timestamp: number
): Promise<void> {
  const res = await window.api.saveWord({
    word: def.word,
    ipa: def.ipa,
    pos: def.pos,
    meaning: def.meaning,
    example,
    videoId,
    timestamp
  })
  if (res.ok) {
    await refreshSavedWords()
  } else {
    throw new Error(res.error.message)
  }
}

export async function deleteSavedWord(id: string): Promise<void> {
  const res = await window.api.deleteWord(id)
  if (res.ok) {
    await refreshSavedWords()
    toast('Đã xoá từ vựng')
  } else {
    toast(res.error.message)
  }
}

export function renderSavedList(): void {
  const vl = $('vList')
  if (!savedWords.length) {
    vl.innerHTML =
      '<div class="empty">Chưa có từ nào.<br>Bấm vào một từ trong ô “Câu đang nói” để tra nghĩa và lưu lại.</div>'
    return
  }

  vl.innerHTML = savedWords
    .map(
      (v) => `
    <div class="vocab-item" data-id="${v.id}" style="cursor:pointer" title="Bấm để phát lại đoạn video này">
      <b>${esc(v.word)}${v.ipa ? `<span class="ipa">${esc(v.ipa)}</span>` : ''}</b>
      <span class="mean">${esc(v.meaning)}</span>
      ${v.example ? `<span class="ctx">${esc(v.example)}</span>` : ''}
      <button class="x" data-id="${v.id}" type="button" aria-label="Xoá ${esc(v.word)}">Xoá</button>
    </div>`
    )
    .join('')
}

