import { toAppError } from '../youtube/errors'
import { LANG_NAMES, normalizeLang, TranslateError, type TranslationProvider } from './TranslationProvider'

export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5'

/** Claude API (key nhập trong Cài đặt). Gửi/nhận mảng JSON để giữ đúng thứ tự và số lượng. */
export class ClaudeProvider implements TranslationProvider {
  readonly id = 'claude'
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async translateBatch(lines: string[], from: string, to: string): Promise<string[]> {
    if (!lines.length) return []
    if (!this.apiKey) throw new TranslateError('TRANSLATE_AUTH', 'Chưa nhập Claude API key trong Cài đặt.')
    const name = (c: string): string => LANG_NAMES[normalizeLang(c)] ?? c
    const system =
      `You translate video subtitles from ${name(from)} to ${name(to)}. ` +
      'The user message is a JSON array of strings. Reply with ONLY a JSON array of strings: ' +
      'the translations, same length and same order, natural and concise, no commentary.'

    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model || DEFAULT_CLAUDE_MODEL,
          max_tokens: 8000,
          system,
          messages: [{ role: 'user', content: JSON.stringify(lines) }]
        }),
        signal: AbortSignal.timeout(90000)
      })
    } catch (e) {
      const err = toAppError(e)
      throw new TranslateError(err.code === 'NETWORK' ? 'NETWORK' : 'TRANSLATE_FAILED', err.message, true)
    }
    if (res.status === 401 || res.status === 403) {
      throw new TranslateError('TRANSLATE_AUTH', 'Claude API key không đúng hoặc không có quyền.')
    }
    if (res.status === 429 || res.status === 529) {
      throw new TranslateError('TRANSLATE_RATE_LIMIT', 'Claude API đang giới hạn tốc độ, thử lại sau ít phút.', true)
    }
    if (!res.ok) throw new TranslateError('TRANSLATE_FAILED', `Dịch lỗi (Claude, HTTP ${res.status}).`, res.status >= 500)

    const json = (await res.json()) as { content?: { type: string; text?: string }[] }
    const text = json.content?.find((c) => c.type === 'text')?.text ?? ''
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    let arr: unknown
    try {
      arr = JSON.parse(text.slice(start, end + 1))
    } catch {
      throw new TranslateError('COUNT_MISMATCH', 'Claude trả về định dạng không đúng.')
    }
    if (!Array.isArray(arr) || arr.length !== lines.length) {
      throw new TranslateError('COUNT_MISMATCH', 'Số câu dịch không khớp số câu gốc.')
    }
    return arr.map((x) => String(x ?? ''))
  }
}

