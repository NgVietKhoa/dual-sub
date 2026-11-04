import type { WordDefinition } from '../../shared/types'
import { GoogleProvider } from '../translate/google'
import { createProvider } from '../translate/service'

const POS_MAP: Record<string, string> = {
  noun: 'danh từ',
  verb: 'động từ',
  adjective: 'tính từ',
  adverb: 'trạng từ',
  pronoun: 'đại từ',
  preposition: 'giới từ',
  conjunction: 'liên từ',
  interjection: 'thán từ',
  exclamation: 'thán từ',
  determiner: 'từ hạn định',
  article: 'mạo từ',
  numeral: 'số từ'
}

/** Dịch bằng provider trong Cài đặt; provider lỗi (thiếu key, hết hạn mức...) thì thử Google. */
async function translate(lines: string[], from: string, to: string): Promise<string[]> {
  const provider = await createProvider()
  return provider.translateBatch(lines, from, to).catch(() => new GoogleProvider().translateBatch(lines, from, to))
}

interface FreeDictEntry {
  word?: string
  phonetic?: string
  phonetics?: { text?: string }[]
  meanings?: {
    partOfSpeech?: string
    definitions?: { definition?: string; example?: string }[]
  }[]
}

/** Tra từ `rawWord` (ngôn ngữ `from` của video) và giải nghĩa sang ngôn ngữ `to`. */
export async function lookupWord(rawWord: string, from: string, to: string): Promise<WordDefinition> {
  const word = rawWord.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  if (!word) {
    return { word: rawWord, meaning: '' }
  }

  // Tiếng Anh: dùng Free Dictionary API trước để có IPA, loại từ, định nghĩa
  if (from.toLowerCase().split(/[-_]/)[0] === 'en') {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`, {
        signal: AbortSignal.timeout(6000)
      })
      if (res.ok) {
        const data = (await res.json()) as FreeDictEntry[]
        const entry = data[0]
        if (entry) {
          const ipa = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || ''
          const rawPos = entry.meanings?.[0]?.partOfSpeech || ''
          const pos = (to === 'vi' && POS_MAP[rawPos.toLowerCase()]) || rawPos
          const rawDef = entry.meanings?.[0]?.definitions?.[0]?.definition || ''

          const [wordMeaning = '', defMeaning = ''] = await translate(rawDef ? [word, rawDef] : [word], from, to).catch(
            (): string[] => []
          )
          let meaning = wordMeaning
          if (defMeaning && defMeaning.toLowerCase() !== wordMeaning.toLowerCase()) {
            meaning = `${wordMeaning} (${defMeaning})`
          }

          return {
            word: entry.word || word,
            ipa,
            pos,
            meaning
          }
        }
      }
    } catch (e) {
      console.warn('[lookup] Free Dictionary API error/timeout, fallback to translate:', e)
    }
  }

  // Fallback hoặc ngôn ngữ khác: dịch trực tiếp từ. meaning rỗng = không tìm thấy nghĩa.
  const [meaning = ''] = await translate([word], from, to)
  return { word, meaning }
}
