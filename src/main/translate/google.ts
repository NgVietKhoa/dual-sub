import { toAppError } from '../youtube/errors'
import { normalizeLang, TranslateError, type TranslationProvider } from './TranslationProvider'

const ENDPOINT = 'https://translate.googleapis.com/translate_a/t?client=gtx&dt=t'

/**
 * Google Translate miễn phí (endpoint không chính thức, không cần API key).
 * Mỗi câu gửi một tham số `q` riêng nên kết quả luôn cùng thứ tự và số lượng.
 */
export class GoogleProvider implements TranslationProvider {
  readonly id = 'google'

  async translateBatch(lines: string[], from: string, to: string): Promise<string[]> {
    if (!lines.length) return []
    const body = new URLSearchParams()
    for (const l of lines) body.append('q', l)

    const url = `${ENDPOINT}&sl=${encodeURIComponent(normalizeLang(from))}&tl=${encodeURIComponent(normalizeLang(to))}`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
        signal: AbortSignal.timeout(20000)
      })
    } catch (e) {
      const err = toAppError(e)
      throw new TranslateError(err.code === 'NETWORK' ? 'NETWORK' : 'TRANSLATE_FAILED', err.message, true)
    }

    if (res.status === 429 || res.status === 503) {
      throw new TranslateError(
        'TRANSLATE_RATE_LIMIT',
        'Google Translate miễn phí đang giới hạn tốc độ. Đợi vài phút rồi bấm “Thử dịch lại”, hoặc đổi sang DeepL/Claude trong Cài đặt.',
        true
      )
    }
    if (!res.ok) {
      throw new TranslateError('TRANSLATE_FAILED', `Dịch lỗi (Google, HTTP ${res.status}).`, res.status >= 500)
    }

    let data: unknown
    try {
      data = await res.json()
    } catch {
      throw new TranslateError('TRANSLATE_FAILED', 'Google Translate trả về dữ liệu không đọc được.', true)
    }
    if (!Array.isArray(data) || data.length !== lines.length) {
      throw new TranslateError('COUNT_MISMATCH', 'Số câu dịch không khớp số câu gốc.')
    }
    // Khi sl cố định, mỗi phần tử là chuỗi; phòng trường hợp dạng [chuỗi, ngôn ngữ]
    return data.map((x) => (Array.isArray(x) ? String(x[0] ?? '') : String(x ?? '')))
  }
}

