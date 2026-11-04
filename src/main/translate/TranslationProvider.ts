import { AppError } from '../youtube/errors'

export interface TranslationProvider {
  readonly id: string
  /**
   * Dịch một lô câu. Phải trả đúng số lượng và đúng thứ tự như đầu vào
   * (lệch số lượng → ném AppError mã COUNT_MISMATCH).
   */
  translateBatch(lines: string[], from: string, to: string): Promise<string[]>
}

export class TranslateError extends AppError {
  constructor(
    code: 'TRANSLATE_RATE_LIMIT' | 'TRANSLATE_AUTH' | 'TRANSLATE_FAILED' | 'COUNT_MISMATCH' | 'NETWORK',
    message: string,
    /** Có nên thử lại sau một lúc không */
    public retryable = false
  ) {
    super(code, message)
  }
}

/** Mã ngôn ngữ YouTube → mã dùng cho dịch vụ dịch. */
export function normalizeLang(code: string): string {
  const c = code.toLowerCase()
  if (c === 'zh-hans' || c === 'zh-cn' || c === 'zh') return 'zh-CN'
  if (c === 'zh-hant' || c === 'zh-tw') return 'zh-TW'
  if (c === 'iw') return 'he'
  return c.split(/[-_]/)[0]
}

export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  vi: 'Vietnamese',
  ja: 'Japanese',
  ko: 'Korean',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  id: 'Indonesian',
  th: 'Thai'
}

