import { toAppError } from '../youtube/errors'
import { normalizeLang, TranslateError, type TranslationProvider } from './TranslationProvider'

/** DeepL API (key nhập trong Cài đặt). Key kết thúc bằng ":fx" là gói Free. */
export class DeepLProvider implements TranslationProvider {
  readonly id = 'deepl'
  constructor(private apiKey: string) {}

  async translateBatch(lines: string[], from: string, to: string): Promise<string[]> {
    if (!lines.length) return []
    if (!this.apiKey) {
      throw new TranslateError('TRANSLATE_AUTH', 'Chưa nhập DeepL API key trong Cài đặt.')
    }
    const host = this.apiKey.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com'
    const target = normalizeLang(to).toUpperCase()
    let res: Response
    try {
      res = await fetch(`https://${host}/v2/translate`, {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: lines,
          source_lang: normalizeLang(from).split('-')[0].toUpperCase(),
          target_lang: target === 'EN' ? 'EN-US' : target
        }),
        signal: AbortSignal.timeout(30000)
      })
    } catch (e) {
      const err = toAppError(e)
      throw new TranslateError(err.code === 'NETWORK' ? 'NETWORK' : 'TRANSLATE_FAILED', err.message, true)
    }
    if (res.status === 401 || res.status === 403) {
      throw new TranslateError('TRANSLATE_AUTH', 'DeepL API key không đúng hoặc đã hết hạn.')
    }
    if (res.status === 456) {
      throw new TranslateError('TRANSLATE_AUTH', 'DeepL: đã hết hạn mức ký tự của tháng này.')
    }
    if (res.status === 429) {
      throw new TranslateError('TRANSLATE_RATE_LIMIT', 'DeepL đang giới hạn tốc độ, thử lại sau ít phút.', true)
    }
    if (!res.ok) throw new TranslateError('TRANSLATE_FAILED', `Dịch lỗi (DeepL, HTTP ${res.status}).`, res.status >= 500)

    const json = (await res.json()) as { translations?: { text: string }[] }
    const out = json.translations?.map((t) => t.text) ?? []
    if (out.length !== lines.length) throw new TranslateError('COUNT_MISMATCH', 'Số câu dịch không khớp số câu gốc.')
    return out
  }
}

