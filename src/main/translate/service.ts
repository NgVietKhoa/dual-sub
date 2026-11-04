import type { TranslateDone, TranslateProgress } from '../../shared/types'
import { getEntry, saveEntry } from '../storage/cache'
import { getSecrets } from '../storage/settings'
import { AppError, toAppError } from '../youtube/errors'
import { translateItems } from './batcher'
import { ClaudeProvider } from './claude'
import { DeepLProvider } from './deepl'
import { GoogleProvider } from './google'
import type { TranslationProvider } from './TranslationProvider'

export async function createProvider(): Promise<TranslationProvider> {
  const s = await getSecrets()
  if (s.provider === 'deepl') return new DeepLProvider(s.deeplKey)
  if (s.provider === 'claude') return new ClaudeProvider(s.claudeKey, s.claudeModel)
  return new GoogleProvider()
}

export interface JobSink {
  progress(p: TranslateProgress): void
  done(d: TranslateDone): void
}

/** Chỉ chạy một việc dịch tại một thời điểm; bắt đầu việc mới sẽ huỷ việc cũ. */
export class TranslateJobs {
  private controller: AbortController | null = null

  cancel(): void {
    this.controller?.abort()
    this.controller = null
  }

  /** Trả về sau khi kiểm tra đầu vào; việc dịch chạy nền, kết quả báo qua sink. */
  async start(videoId: string, preferred: string, to: string, sink: JobSink): Promise<void> {
    this.cancel()
    const entry = await getEntry(videoId, preferred)
    if (!entry) throw new AppError('NO_TRANSCRIPT', 'Chưa có transcript để dịch.')

    const controller = new AbortController()
    this.controller = controller
    const cues = entry.payload.cues
    const total = cues.length
    const from = entry.payload.lang

    // Cache cũ có thể lệch độ dài (đổi thuật toán gộp câu) → bỏ
    let tr = entry.translations[to]
    if (!tr || tr.length !== total) tr = entry.translations[to] = new Array<string>(total).fill('')

    const countDone = (): number => tr.reduce((n, x) => n + (x ? 1 : 0), 0)
    const cachedItems = tr.flatMap((text, i) => (text ? [{ i, text }] : []))
    if (cachedItems.length) sink.progress({ videoId, to, items: cachedItems, done: cachedItems.length, total })

    const pending = cues.flatMap((c, i) => (tr[i] ? [] : [{ i, text: c.text }]))
    if (!pending.length) {
      sink.done({ videoId, to })
      return
    }

    // Chạy nền, không chặn lời gọi IPC
    void (async () => {
      let error: string | undefined
      try {
        const provider = await createProvider()
        await translateItems(provider, pending, from, to, {
          signal: controller.signal,
          onBatch: async (items) => {
            for (const it of items) tr[it.i] = it.text
            sink.progress({ videoId, to, items, done: countDone(), total })
            await saveEntry(entry)
          }
        })
      } catch (e) {
        if (controller.signal.aborted) return
        error = toAppError(e).message
      }
      if (controller.signal.aborted) return
      if (this.controller === controller) this.controller = null
      sink.done({ videoId, to, error })
    })()
  }
}

