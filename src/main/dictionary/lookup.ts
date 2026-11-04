import type { WordDefinition } from '../../shared/types'
import { GoogleProvider } from '../translate/google'
import { getSecrets } from '../storage/settings'
import { DeepLProvider } from '../translate/deepl'
import { ClaudeProvider } from '../translate/claude'
import type { TranslationProvider } from '../translate/TranslationProvider'

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

async function getProvider(): Promise<TranslationProvider> {
  const s = await getSecrets()
  if (s.provider === 'deepl' && s.deeplKey) return new DeepLProvider(s.deeplKey)
  if (s.provider === 'claude' && s.claudeKey) return new ClaudeProvider(s.claudeKey, s.claudeModel)
  return new GoogleProvider()
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

export async function lookupWord(rawWord: string, srcLang = 'en'): Promise<WordDefinition> {
  const word = rawWord.trim().replace(/^[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+|[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+$/g, '')
  if (!word) {
    return { word: rawWord, meaning: '' }
  }

  const lang = (srcLang || 'en').toLowerCase().split(/[-_]/)[0]
  const provider = await getProvider()

  // Đối với tiếng Anh, dùng Free Dictionary API trước
  if (lang === 'en' || lang === 'auto') {
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
          const pos = POS_MAP[rawPos.toLowerCase()] || rawPos
          const rawDef = entry.meanings?.[0]?.definitions?.[0]?.definition || ''

          // Dịch song song nghĩa từ và định nghĩa sang tiếng Việt
          const toTranslate = rawDef ? [word, rawDef] : [word]
          let trResults: string[] = []
          try {
            trResults = await provider.translateBatch(toTranslate, 'en', 'vi')
          } catch {
            // Nếu provider hiện tại lỗi, thử với Google
            trResults = await new GoogleProvider().translateBatch(toTranslate, 'en', 'vi').catch(() => [word, ''])
          }

          const wordMeaning = trResults[0] || ''
          const defMeaning = trResults[1] || ''
          let meaning = wordMeaning
          if (defMeaning && defMeaning.toLowerCase() !== wordMeaning.toLowerCase()) {
            meaning = `${wordMeaning} (${defMeaning})`
          }

          return {
            word: entry.word || word,
            ipa,
            pos,
            meaning: meaning || 'Chưa tìm thấy nghĩa tiếng Việt.'
          }
        }
      }
    } catch (e) {
      console.warn('[lookup] Free Dictionary API error/timeout, fallback to translate:', e)
    }
  }

  // Fallback hoặc ngôn ngữ khác: dịch trực tiếp từ sang tiếng Việt
  try {
    const [meaning] = await provider.translateBatch([word], lang === 'auto' ? 'en' : lang, 'vi')
    return {
      word,
      meaning: meaning || 'Không thể dịch từ này.'
    }
  } catch (e) {
    return {
      word,
      meaning: 'Lỗi khi tra nghĩa từ.'
    }
  }
}

