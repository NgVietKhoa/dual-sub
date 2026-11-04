import { TranslateError, type TranslationProvider } from './TranslationProvider'

export interface BatchItem {
  /** Chỉ số câu trong transcript */
  i: number
  text: string
}

export interface BatchOptions {
  /** Lô đầu nhỏ để hiện bản dịch gần như ngay */
  first?: number
  size?: number
  maxChars?: number
}

/** Chia thành các lô theo số câu và tổng số ký tự; giữ nguyên thứ tự. */
export function makeBatches(items: BatchItem[], { first = 8, size = 30, maxChars = 3500 }: BatchOptions = {}): BatchItem[][] {
  const batches: BatchItem[][] = []
  let cur: BatchItem[] = []
  let chars = 0
  for (const it of items) {
    const limit = batches.length === 0 ? first : size
    if (cur.length && (cur.length >= limit || chars + it.text.length > maxChars)) {
      batches.push(cur)
      cur = []
      chars = 0
    }
    cur.push(it)
    chars += it.text.length
  }
  if (cur.length) batches.push(cur)
  return batches
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export interface RunOptions {
  signal?: AbortSignal
  onBatch(done: BatchItem[]): void | Promise<void>
  /** Nghỉ giữa các lô để tránh bị giới hạn tốc độ */
  delayMs?: number
  retryDelaysMs?: number[]
  sleep?: (ms: number) => Promise<void>
  batch?: BatchOptions
}

/** Dịch một lô, thử lại khi lỗi tạm thời; nếu lệch số lượng thì chia đôi lô. */
export async function translateWithRetry(
  provider: TranslationProvider,
  texts: string[],
  from: string,
  to: string,
  opts: Pick<RunOptions, 'signal' | 'retryDelaysMs' | 'sleep'> = {}
): Promise<string[]> {
  const delays = opts.retryDelaysMs ?? [1500, 5000, 15000]
  const sleep = opts.sleep ?? defaultSleep
  for (let attempt = 0; ; attempt++) {
    if (opts.signal?.aborted) throw new DOMException('Đã huỷ', 'AbortError')
    try {
      const out = await provider.translateBatch(texts, from, to)
      if (out.length !== texts.length) throw new TranslateError('COUNT_MISMATCH', 'Số câu dịch không khớp.')
      return out
    } catch (e) {
      if (e instanceof TranslateError && e.code === 'COUNT_MISMATCH') {
        if (texts.length === 1) throw new TranslateError('TRANSLATE_FAILED', 'Không dịch được một câu.')
        const mid = Math.ceil(texts.length / 2)
        const a = await translateWithRetry(provider, texts.slice(0, mid), from, to, opts)
        const b = await translateWithRetry(provider, texts.slice(mid), from, to, opts)
        return [...a, ...b]
      }
      const retryable = e instanceof TranslateError && e.retryable
      if (!retryable || attempt >= delays.length) throw e
      await sleep(delays[attempt])
    }
  }
}

/** Dịch lần lượt từng lô; mỗi lô xong gọi onBatch (để gửi về UI và lưu cache). */
export async function translateItems(
  provider: TranslationProvider,
  items: BatchItem[],
  from: string,
  to: string,
  opts: RunOptions
): Promise<void> {
  const sleep = opts.sleep ?? defaultSleep
  const batches = makeBatches(items, opts.batch)
  for (let b = 0; b < batches.length; b++) {
    if (opts.signal?.aborted) return
    const batch = batches[b]
    const out = await translateWithRetry(provider, batch.map((x) => x.text), from, to, opts)
    if (opts.signal?.aborted) return
    await opts.onBatch(batch.map((x, k) => ({ i: x.i, text: out[k].trim() })))
    if (b < batches.length - 1) await sleep(opts.delayMs ?? 350)
  }
}

