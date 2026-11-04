import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import type { ExportResult, SavedWord } from '../../shared/types'
import { getSavedWords } from './words'

function escapeCsvField(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

export function formatWordsToCsv(words: SavedWord[]): string {
  const header = ['Front', 'Back', 'Example', 'Source']
  const rows: string[] = [header.join(',')]

  for (const w of words) {
    let front = w.word
    if (w.ipa) front += ` [${w.ipa}]`
    if (w.pos) front += ` (${w.pos})`

    const back = w.meaning
    const example = w.example || ''
    const source = w.videoId ? `https://youtu.be/${w.videoId}?t=${Math.floor(w.timestamp || 0)}` : ''

    rows.push(
      [escapeCsvField(front), escapeCsvField(back), escapeCsvField(example), escapeCsvField(source)].join(',')
    )
  }

  // Thêm UTF-8 BOM (\uFEFF) để Excel và Anki nhận diện tiếng Việt chính xác
  return '\uFEFF' + rows.join('\r\n')
}

export async function exportAnkiCsv(win?: BrowserWindow): Promise<ExportResult> {
  const words = await getSavedWords()
  if (!words.length) {
    return { canceled: false, count: 0 }
  }

  const { canceled, filePath } = await dialog.showSaveDialog(win ?? BrowserWindow.getFocusedWindow()!, {
    title: 'Xuất từ vựng cho Anki',
    defaultPath: 'song-ngu-anki-words.csv',
    filters: [{ name: 'CSV (Comma delimited)', extensions: ['csv'] }]
  })

  if (canceled || !filePath) {
    return { canceled: true, count: 0 }
  }

  const csvContent = formatWordsToCsv(words)
  await writeFile(filePath, csvContent, 'utf8')

  return {
    canceled: false,
    count: words.length,
    filePath
  }
}

